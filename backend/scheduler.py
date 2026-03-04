from apscheduler.schedulers.background import BackgroundScheduler
from services.external.match_sync_service import MatchSyncService
import logging

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler(timezone="UTC")


def start_scheduler():
    # Every minute — sync live scores (self-gating via is_within_active_window)
    scheduler.add_job(
        MatchSyncService.sync_live_matches,
        trigger="cron",
        hour="9-23,0-8",
        minute="*",
        id="sync_live_matches",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    # Every 5 minutes — catch finished matches
    scheduler.add_job(
        MatchSyncService.sync_finished_matches,
        trigger="cron",
        hour="9-23,0-8",
        minute="*/5",
        id="sync_finished_matches",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    scheduler.start()
    logger.info("✅ Match sync scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("🛑 Match sync scheduler stopped")
