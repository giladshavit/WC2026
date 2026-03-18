"""
Smart match sync service.
Polls football-data.org only during active match windows.
"""

import logging
import os
from datetime import datetime, timezone, timedelta

from database import SessionLocal
from models.matches import Match, MatchStatus
from services.database import DBReader, DBWriter, DBUtils
from services.results_service import ResultsService
from services.stage_manager import StageManager
from services.external.football_data_client import FootballDataClient

logger = logging.getLogger(__name__)

# How many minutes before/after a match to keep polling
WINDOW_BEFORE_MINUTES = 5
WINDOW_AFTER_MINUTES = 180  # 3 hours


class MatchSyncService:

    @staticmethod
    def is_within_active_window() -> bool:
        """
        Check if current time (UTC) falls within any match window today.
        A window = [match.date - 5min, match.date + 3h]
        Returns True if we should poll, False if we should skip.
        """
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            matches_today = DBReader.get_matches_today(db)

            for match in matches_today:
                match_date = match.date
                # Make timezone-aware if needed
                if match_date.tzinfo is None:
                    match_date = match_date.replace(tzinfo=timezone.utc)

                window_start = match_date - timedelta(minutes=WINDOW_BEFORE_MINUTES)
                window_end = match_date + timedelta(minutes=WINDOW_AFTER_MINUTES)

                if window_start <= now <= window_end:
                    return True
            return False
        except Exception as e:
            logger.error(f"Error checking active window: {e}")
            return False
        finally:
            db.close()

    @staticmethod
    def sync_live_matches() -> None:
        if not MatchSyncService.is_within_active_window():
            logger.debug("Outside match windows — skipping sync")
            return

        client = FootballDataClient()
        competition_codes = os.getenv("SYNC_COMPETITION_CODE", "WC").split(",")
        external_matches = []
        for code in competition_codes:
            external_matches.extend(client.get_live_matches(competition_code=code.strip()))
        if not external_matches:
            logger.info("No live matches from API")
            return

        db = SessionLocal()
        try:
            for ext in external_matches:
                external_id = ext.get("id")
                if not external_id:
                    continue

                match = DBReader.get_match_by_external_id(db, external_id)
                if not match:
                    logger.warning(f"[SYNC] No local match for external_id={external_id}")
                    continue

                score = ext.get("score", {}).get("fullTime", {})
                home = score.get("home")
                away = score.get("away")
                if home is None or away is None:
                    continue

                if match.status == MatchStatus.FINISHED.value:
                    logger.debug(f"[SYNC] Match {match.id} already finished — skipping")
                    continue

                try:
                    # is_final=False: update score only, keep status=live, keep prediction status=PENDING
                    ResultsService.update_match_result(
                        db=db,
                        match_id=match.id,
                        home_team_score=home,
                        away_team_score=away,
                        is_final=False,
                    )
                    # Set status to LIVE if it was SCHEDULED
                    if match.status == MatchStatus.SCHEDULED.value:
                        DBWriter.set_match_status(db, match, MatchStatus.LIVE.value)
                        # Ensure match_result row exists with at least 0-0
                        DBWriter.ensure_match_result_exists(db, match.id)
                        StageManager.maybe_advance_stage_for_match(db, match.id, "live")
                    DBUtils.commit(db)
                except Exception as e:
                    logger.error(f"[SYNC] Failed to update match {match.id}: {e}")
                    DBUtils.rollback(db)

        except Exception as e:
            logger.error(f"[SYNC] sync_live_matches error: {e}")
        finally:
            db.close()

    @staticmethod
    def sync_finished_matches() -> None:
        if not MatchSyncService.is_within_active_window():
            return

        db = SessionLocal()
        try:
            live_matches = DBReader.get_live_unfinalized_matches(db)
            if not live_matches:
                return

            client = FootballDataClient()
            for match in live_matches:
                if not match.external_api_id:
                    continue
                ext = client.get_match(match.external_api_id)
                if not ext:
                    continue

                if FootballDataClient.map_external_status(ext.get("status", "")) == "finished":
                    score = ext.get("score", {}).get("fullTime", {})
                    home = score.get("home")
                    away = score.get("away")
                    if home is None or away is None:
                        continue
                    try:
                        # is_final=True: set status=finished, save winner, save prediction status
                        ResultsService.update_match_result(
                            db=db,
                            match_id=match.id,
                            home_team_score=home,
                            away_team_score=away,
                            is_final=True,
                        )
                        DBWriter.mark_match_result_finalized(db, match)
                        StageManager.maybe_advance_stage_for_match(db, match.id, "finished")
                        DBUtils.commit(db)
                        logger.info(f"[SYNC] Match {match.id} finalized: {home}-{away}")
                    except Exception as e:
                        logger.error(f"[SYNC] Failed to finalize match {match.id}: {e}")
                        DBUtils.rollback(db)

        except Exception as e:
            logger.error(f"[SYNC] sync_finished_matches error: {e}")
        finally:
            db.close()
