"""
DBWriter: All WRITE (INSERT/UPDATE/DELETE) operations.
Every method that modifies database state lives here.
Methods call db.flush() to get IDs but do NOT call db.commit().
Commit responsibility belongs to the service layer via DBUtils.commit().
"""
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)
from typing import Optional, List, Dict, Any, Sequence, Union
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import text

from models.team import Team
from models.user import User
from models.user_scores import UserScores
from models.matches import Match
from models.groups import Group
from models.predictions import (
    MatchPrediction,
    GroupStagePrediction,
    ThirdPlacePrediction,
    KnockoutStagePrediction,
    KnockoutStagePredictionDraft,
)
from models.results import (
    MatchResult,
    GroupStageResult,
    ThirdPlaceResult,
    KnockoutStageResult,
)
from models.league import League, LeagueMembership
from models.predictions import BonusPrediction
from models.tournament_config import TournamentConfig
from models.statistics import ThirdPlaceGroupCounts
from services.predictions.enums import (
    MatchPredictionStatus,
    PredictionType,
    GroupPredictionStatus,
    ThirdPlacePredictionStatus,
)


class DBWriter:
    """All WRITE operations to database. No reads allowed."""

    # ═══════════════════════════════════════════════════════
    # TEAMS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_team(db: Session, name: str) -> Team:
        team = Team(name=name)
        db.add(team)
        db.flush()
        db.refresh(team)
        return team

    @staticmethod
    def update_team_eliminated(db: Session, team: Team, is_eliminated: bool) -> Team:
        team.is_eliminated = is_eliminated
        db.flush()
        return team

    @staticmethod
    def update_team_group(db: Session, team: Team, group_letter: str, group_position: int) -> Team:
        team.group_letter = group_letter
        team.group_position = group_position
        db.flush()
        return team

    # ═══════════════════════════════════════════════════════
    # USERS & SCORES
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_user(db: Session, username: str, password_hash: str, name: str, email: str) -> User:
        user = User(
            username=username,
            password_hash=password_hash,
            name=name,
            email=email
        )
        db.add(user)
        db.flush()
        db.refresh(user)
        return user

    @staticmethod
    def update_user_last_login(db: Session, user: User, last_login: datetime) -> User:
        user.last_login = last_login
        db.flush()
        return user

    @staticmethod
    def create_password_reset_token(db: Session, user_id: int, otp_code: str, expires_at: datetime) -> Any:
        from models.password_reset_token import PasswordResetToken
        token = PasswordResetToken(user_id=user_id, otp_code=otp_code, expires_at=expires_at)
        db.add(token)
        db.flush()
        return token

    @staticmethod
    def invalidate_password_reset_tokens(db: Session, user_id: int) -> None:
        """Mark all tokens for this user as used."""
        from models.password_reset_token import PasswordResetToken
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id
        ).update({"is_used": True})
        db.flush()

    @staticmethod
    def update_user_password(db: Session, user: User, new_password_hash: str) -> User:
        user.password_hash = new_password_hash
        db.flush()
        return user

    @staticmethod
    def create_user_scores(db: Session, user_id: int, free_changes: int = 0) -> UserScores:
        scores = UserScores(
            user_id=user_id,
            matches_score=0,
            groups_score=0,
            third_place_score=0,
            knockout_score=0,
            bonus_score=0,
            bonus_penalty=0,
            classic_total_score=0,
            penalty=0,
            total_points=0,
            free_changes=free_changes,
        )
        db.add(scores)
        db.flush()
        db.refresh(scores)
        return scores

    @staticmethod
    def update_user_scores(db: Session, scores: UserScores, **kwargs) -> UserScores:
        for key, value in kwargs.items():
            if hasattr(scores, key) and value is not None:
                setattr(scores, key, value)
        db.flush()
        return scores

    @staticmethod
    def bulk_grant_free_changes(db: Session, grant: int) -> int:
        """
        Add `grant` free changes to ALL users in a single UPDATE query.
        Returns the number of rows updated.
        """
        from sqlalchemy import text
        result = db.execute(
            text("UPDATE user_scores SET free_changes = COALESCE(free_changes, 0) + :grant"),
            {"grant": grant}
        )
        db.flush()
        return result.rowcount

    @staticmethod
    def reset_user_scores(db: Session, scores: UserScores) -> UserScores:
        scores.matches_score = 0
        scores.groups_score = 0
        scores.third_place_score = 0
        scores.knockout_score = 0
        scores.bonus_score = 0
        scores.classic_total_score = 0
        scores.penalty = 0
        scores.groups_penalty = 0
        scores.third_place_penalty = 0
        scores.knockout_penalty = 0
        scores.bonus_penalty = 0
        scores.has_used_bracket_reset = False
        scores.total_points = 0
        db.flush()
        return scores

    @staticmethod
    def delete_user_account(db: Session, user_id: int) -> None:
        """Delete all user data in FK-safe order, then the user record."""
        from sqlalchemy import delete
        from models.password_reset_token import PasswordResetToken

        leagues_owned = db.query(League).filter(League.created_by == user_id).all()
        for league in leagues_owned:
            members = db.query(LeagueMembership).filter(LeagueMembership.league_id == league.id).all()
            others = [m for m in members if m.user_id != user_id]
            if not others:
                DBWriter.delete_league(db, league.id)
            else:
                others.sort(key=lambda m: m.joined_at)
                DBWriter.update_league_owner(db, league.id, others[0].user_id)

        db.execute(delete(KnockoutStagePredictionDraft).where(KnockoutStagePredictionDraft.user_id == user_id))
        db.execute(delete(KnockoutStagePrediction).where(KnockoutStagePrediction.user_id == user_id))
        db.execute(delete(MatchPrediction).where(MatchPrediction.user_id == user_id))
        db.execute(delete(GroupStagePrediction).where(GroupStagePrediction.user_id == user_id))
        db.execute(delete(ThirdPlacePrediction).where(ThirdPlacePrediction.user_id == user_id))
        db.execute(delete(BonusPrediction).where(BonusPrediction.user_id == user_id))
        db.execute(delete(LeagueMembership).where(LeagueMembership.user_id == user_id))
        db.execute(delete(UserScores).where(UserScores.user_id == user_id))
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
        db.execute(delete(User).where(User.id == user_id))
        db.commit()

    # ═══════════════════════════════════════════════════════
    # MATCHES
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_match(db: Session, **kwargs) -> Match:
        match = Match(**kwargs)
        db.add(match)
        db.flush()
        db.refresh(match)
        return match

    @staticmethod
    def update_match(db: Session, match: Match, **kwargs) -> Match:
        for key, value in kwargs.items():
            if hasattr(match, key) and value is not None:
                setattr(match, key, value)
        db.flush()
        return match

    @staticmethod
    def set_match_status(db: Session, match: Match, status: str) -> Match:
        match.status = status
        db.flush()
        return match

    # ═══════════════════════════════════════════════════════
    # GROUPS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_group(db: Session, name: str) -> Group:
        group = Group(name=name)
        db.add(group)
        db.flush()
        db.refresh(group)
        return group

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Match
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_match_prediction(db: Session, user_id: int, match_id: int,
                                home_score: Optional[int], away_score: Optional[int],
                                predicted_winner: Optional[int]) -> MatchPrediction:
        prediction = MatchPrediction(
            user_id=user_id,
            match_id=match_id,
            home_score=home_score,
            away_score=away_score,
            predicted_winner=predicted_winner
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction

    @staticmethod
    def bulk_create_match_predictions(db: Session, user_id: int, match_ids: List[int]) -> None:
        """
        Bulk-insert empty MatchPrediction rows for the given match_ids.
        home_score=None, away_score=None, predicted_winner=None.
        Caller must ensure idempotency (e.g. check existence before calling).
        """
        if not match_ids:
            return
        rows = [
            {
                "user_id": user_id,
                "match_id": match_id,
                "home_score": None,
                "away_score": None,
                "predicted_winner": None,
                "is_tempted": False,
            }
            for match_id in match_ids
        ]
        db.bulk_insert_mappings(MatchPrediction, rows)
        db.flush()

    @staticmethod
    def update_match_prediction(db: Session, prediction: MatchPrediction, **kwargs) -> MatchPrediction:
        for key, value in kwargs.items():
            if not hasattr(prediction, key):
                continue
            # Allow 0 for predicted_winner (draw), but skip other None values
            if key == "predicted_winner":
                setattr(prediction, key, value)
            elif value is not None:
                setattr(prediction, key, value)
        db.flush()
        return prediction

    @staticmethod
    def update_match_prediction_status(
        db: Session,
        prediction: MatchPrediction,
        status: Union[str, MatchPredictionStatus],
    ) -> MatchPrediction:
        """Set the status field on a match prediction."""
        prediction.status = (
            status.value if isinstance(status, MatchPredictionStatus) else status
        )
        db.flush()
        return prediction

    @staticmethod
    def reset_match_prediction_points(db: Session) -> int:
        return db.query(MatchPrediction).update({MatchPrediction.points: 0})

    @staticmethod
    def reset_match_prediction_statuses(db: Session) -> int:
        """Reset all match prediction statuses to pending (when results are deleted)."""
        return db.query(MatchPrediction).update({
            MatchPrediction.status: MatchPredictionStatus.PENDING.value
        })

    @staticmethod
    def set_match_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(MatchPrediction).update({MatchPrediction.is_editable: is_editable})

    @staticmethod
    def add_prediction_penalty(
        db: Session,
        prediction_id: int,
        prediction_type: PredictionType,
        penalty_delta: int,
        changes_delta: int,
    ) -> None:
        """
        Update penalty_points and changes_count on a specific prediction row.
        Routes to the correct table based on prediction_type.
        Uses direct ORM query - no service imports allowed here.
        """
        if prediction_type == PredictionType.GROUPS:
            model = GroupStagePrediction
        elif prediction_type == PredictionType.THIRD_PLACE:
            model = ThirdPlacePrediction
        elif prediction_type == PredictionType.KNOCKOUT:
            model = KnockoutStagePrediction
        elif prediction_type == PredictionType.BONUS:
            model = BonusPrediction
        else:
            logging.warning("add_prediction_penalty: unknown prediction_type=%s", prediction_type)
            return

        prediction = db.query(model).filter(model.id == prediction_id).first()
        if not prediction:
            logging.warning(
                "add_prediction_penalty: prediction not found id=%s type=%s",
                prediction_id,
                prediction_type.value,
            )
            return

        prediction.penalty_points = (prediction.penalty_points or 0) + penalty_delta
        prediction.changes_count = (prediction.changes_count or 0) + changes_delta
        db.flush()

    # ═══════════════════════════════════════════════════════
    # MATCH SCORING (BULK)
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def bulk_update_match_prediction_scoring(
        db: Session,
        match_id: int,
        home: int,
        away: int,
        winner_id: Optional[int],
        update_status: bool,
        exact_pts: int = 3,
        correct_pts: int = 1,
    ) -> int:
        """
        Bulk SQL: update match_predictions points/status + user_scores.
        Returns number of users with non-zero delta.
        Caller must commit.
        """
        rows = db.execute(text("""
            WITH base AS (
                SELECT
                    mp.id                          AS pred_id,
                    mp.user_id,
                    COALESCE(mp.points, 0)         AS old_points,
                    mp.is_tempted,
                    CASE
                        WHEN mp.home_score IS NULL OR mp.away_score IS NULL THEN 0
                        WHEN mp.home_score = :home AND mp.away_score = :away THEN :exact_pts
                        WHEN :winner_id IS NULL AND mp.predicted_winner = 0  THEN :correct_pts
                        WHEN :winner_id IS NOT NULL
                         AND mp.predicted_winner = :winner_id               THEN :correct_pts
                        ELSE 0
                    END                            AS base_points,
                    CASE
                        WHEN mp.home_score IS NULL OR mp.away_score IS NULL THEN 'pending'
                        WHEN mp.home_score = :home AND mp.away_score = :away THEN 'exact'
                        WHEN :winner_id IS NULL AND mp.predicted_winner = 0  THEN 'correct_outcome'
                        WHEN :winner_id IS NOT NULL
                         AND mp.predicted_winner = :winner_id               THEN 'correct_outcome'
                        ELSE 'wrong'
                    END                            AS new_status
                FROM match_predictions mp
                WHERE mp.match_id = :match_id
            )
            SELECT
                pred_id,
                user_id,
                old_points,
                CASE WHEN is_tempted = TRUE AND base_points > 0 THEN base_points * 2 ELSE base_points END AS new_points,
                new_status
            FROM base
        """), {
            "match_id": match_id,
            "home": home,
            "away": away,
            "winner_id": winner_id,
            "exact_pts": exact_pts,
            "correct_pts": correct_pts,
        }).fetchall()

        if not rows:
            return 0

        pred_ids = [r.pred_id for r in rows]
        new_points = [r.new_points for r in rows]

        db.execute(text("""
            UPDATE match_predictions mp
            SET points = c.new_points
            FROM unnest(CAST(:pred_ids AS int[]), CAST(:new_points AS int[]))
                 AS c(pred_id, new_points)
            WHERE mp.id = c.pred_id
        """), {"pred_ids": pred_ids, "new_points": new_points})

        if update_status:
            new_statuses = [r.new_status for r in rows]
            db.execute(text("""
                UPDATE match_predictions mp
                SET status = c.new_status
                FROM unnest(CAST(:pred_ids AS int[]), CAST(:new_statuses AS text[]))
                     AS c(pred_id, new_status)
                WHERE mp.id = c.pred_id
            """), {"pred_ids": pred_ids, "new_statuses": new_statuses})

        user_deltas: dict[int, int] = defaultdict(int)
        for r in rows:
            delta = r.new_points - r.old_points
            if delta != 0:
                user_deltas[r.user_id] += delta

        if user_deltas:
            user_ids = list(user_deltas.keys())
            deltas = list(user_deltas.values())
            db.execute(text("""
                INSERT INTO user_scores
                    (user_id, matches_score, total_points, classic_total_score,
                     groups_score, third_place_score, knockout_score, bonus_score,
                     bonus_penalty, groups_penalty, third_place_penalty,
                     knockout_penalty, free_changes, free_changes_used,
                     penalty, has_used_bracket_reset)
                SELECT u, d, d, d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false
                FROM unnest(CAST(:user_ids AS int[]), CAST(:deltas AS int[])) AS t(u, d)
                ON CONFLICT (user_id) DO UPDATE
                    SET matches_score = user_scores.matches_score + EXCLUDED.matches_score,
                        total_points  = user_scores.total_points  + EXCLUDED.total_points,
                        classic_total_score = user_scores.classic_total_score + EXCLUDED.matches_score
            """), {"user_ids": user_ids, "deltas": deltas})

        db.flush()
        return len(user_deltas)

    @staticmethod
    def bulk_update_knockout_stage_statuses(
        db: Session,
        match_id: int,
        stage: str,
        winner_team_id: int,
        loser_team_id: int,
        full_points: int,
        partial_points: int,
    ) -> int:
        """
        Bulk SQL: classify and update knockout_stage_predictions status+points
        for all predictions in `stage`, then apply knockout_score deltas to user_scores.

        Skips predictions already settled: correct_full / correct_partial / incorrect.

        Classification rules:
          winner_team_id IS NULL or = loser_team_id          -> incorrect,       0 pts
          winner_team_id = winner AND template_match_id = match_id -> correct_full,  full_points
          winner_team_id = winner AND template_match_id != match_id -> correct_partial, partial_points
          anything else (other team, still alive)            -> no change (excluded by WHERE new_status IS NOT NULL)

        Returns number of users whose knockout_score changed.
        Caller must flush/commit.
        """
        rows = db.execute(text("""
            WITH classified AS (
                SELECT
                    ksp.id                                AS pred_id,
                    ksp.user_id,
                    COALESCE(ksp.points, 0)               AS old_points,
                    CASE
                        WHEN ksp.winner_team_id IS NULL
                          OR ksp.winner_team_id = :loser_team_id
                                                          THEN 'incorrect'
                        WHEN ksp.winner_team_id = :winner_team_id
                         AND ksp.template_match_id = :match_id
                                                          THEN 'correct_full'
                        WHEN ksp.winner_team_id = :winner_team_id
                         AND ksp.template_match_id != :match_id
                                                          THEN 'correct_partial'
                        ELSE NULL
                    END AS new_status
                FROM knockout_stage_predictions ksp
                WHERE ksp.stage = :stage
                  AND ksp.status NOT IN ('correct_full', 'correct_partial', 'incorrect')
            )
            SELECT
                pred_id,
                user_id,
                old_points,
                new_status,
                CASE new_status
                    WHEN 'correct_full'    THEN :full_points
                    WHEN 'correct_partial' THEN :partial_points
                    ELSE 0
                END AS new_points
            FROM classified
            WHERE new_status IS NOT NULL
        """), {
            "stage": stage,
            "match_id": match_id,
            "winner_team_id": winner_team_id,
            "loser_team_id": loser_team_id,
            "full_points": full_points,
            "partial_points": partial_points,
        }).fetchall()

        if not rows:
            return 0

        pred_ids = [r.pred_id for r in rows]
        new_statuses = [r.new_status for r in rows]
        new_pts = [r.new_points for r in rows]

        # Bulk update status + points on predictions
        db.execute(text("""
            UPDATE knockout_stage_predictions ksp
            SET status = c.new_status,
                points = c.new_points
            FROM unnest(
                CAST(:pred_ids     AS int[]),
                CAST(:new_statuses AS text[]),
                CAST(:new_pts      AS int[])
            ) AS c(pred_id, new_status, new_points)
            WHERE ksp.id = c.pred_id
        """), {
            "pred_ids": pred_ids,
            "new_statuses": new_statuses,
            "new_pts": new_pts,
        })

        # Compute per-user delta (in Python — no DB round-trip)
        user_deltas: dict[int, int] = defaultdict(int)
        for r in rows:
            delta = r.new_points - r.old_points
            if delta != 0:
                user_deltas[r.user_id] += delta

        if user_deltas:
            user_ids = list(user_deltas.keys())
            deltas = list(user_deltas.values())
            # Matches the column order of the existing INSERT in bulk_update_match_prediction_scoring.
            # knockout_score gets the delta (d); matches_score = 0; classic_total_score untouched (not += knockout).
            db.execute(text("""
                INSERT INTO user_scores
                    (user_id, matches_score, total_points, classic_total_score,
                     groups_score, third_place_score, knockout_score, bonus_score,
                     bonus_penalty, groups_penalty, third_place_penalty,
                     knockout_penalty, free_changes, free_changes_used,
                     penalty, has_used_bracket_reset)
                SELECT u, 0, d, 0, 0, 0, d, 0, 0, 0, 0, 0, 0, 0, 0, false
                FROM unnest(CAST(:user_ids AS int[]), CAST(:deltas AS int[])) AS t(u, d)
                ON CONFLICT (user_id) DO UPDATE
                    SET knockout_score = user_scores.knockout_score + EXCLUDED.knockout_score,
                        total_points   = user_scores.total_points   + EXCLUDED.total_points
            """), {"user_ids": user_ids, "deltas": deltas})

        return len(user_deltas)

    @staticmethod
    def bulk_invalidate_knockout_loser_later_stages(
        db: Session,
        later_stages: List[str],
        loser_team_id: int,
    ) -> None:
        """
        Bulk SQL: set status=invalid, points=0 for all non-settled predictions
        in later_stages where winner_team_id = loser_team_id.
        No scoring delta needed (points -> 0 means delta handled separately if needed).
        Caller must flush/commit.
        """
        if not later_stages:
            return

        db.execute(text("""
            UPDATE knockout_stage_predictions
            SET status = 'invalid',
                points = 0
            WHERE stage = ANY(CAST(:later_stages AS text[]))
              AND status NOT IN ('correct_full', 'correct_partial', 'incorrect')
              AND winner_team_id = :loser_team_id
        """), {"later_stages": later_stages, "loser_team_id": loser_team_id})

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Group
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_group_prediction(db: Session, user_id: int, group_id: int,
                                first: Optional[int], second: Optional[int],
                                third: Optional[int], fourth: Optional[int],
                                status: str = "pending") -> GroupStagePrediction:
        prediction = GroupStagePrediction(
            user_id=user_id,
            group_id=group_id,
            first_place=first,
            second_place=second,
            third_place=third,
            fourth_place=fourth,
            status=status
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction

    @staticmethod
    def update_group_prediction(db: Session, prediction: GroupStagePrediction, **kwargs) -> GroupStagePrediction:
        for key, value in kwargs.items():
            if hasattr(prediction, key) and value is not None:
                setattr(prediction, key, value)
        db.flush()
        return prediction

    @staticmethod
    def update_group_prediction_accuracy(
        db: Session,
        prediction: GroupStagePrediction,
        first_correct: bool,
        second_correct: bool,
        third_correct: bool,
        fourth_correct: bool,
        correct_positions_count: int
    ) -> GroupStagePrediction:
        """Set all accuracy fields on a group prediction."""
        prediction.first_correct = first_correct
        prediction.second_correct = second_correct
        prediction.third_correct = third_correct
        prediction.fourth_correct = fourth_correct
        prediction.correct_positions_count = correct_positions_count
        db.flush()
        return prediction

    @staticmethod
    def delete_group_predictions_by_user(db: Session, user_id: int) -> int:
        count = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).delete()
        db.flush()
        return count

    @staticmethod
    def reset_group_prediction_points(db: Session) -> int:
        return db.query(GroupStagePrediction).update({GroupStagePrediction.points: 0})

    @staticmethod
    def reset_group_prediction_penalties(db: Session) -> int:
        return db.query(GroupStagePrediction).update({
            GroupStagePrediction.penalty_points: 0,
            GroupStagePrediction.changes_count: 0,
        })

    @staticmethod
    def bulk_update_group_prediction_scoring(
        db: Session,
        group_id: int,
        first: int,
        second: int,
        third: int,
        fourth: int,
        pts_first: int,
        pts_second: int,
        pts_third: int,
        pts_fourth: int,
    ) -> int:
        """
        Bulk SQL: compute accuracy + points for all group_stage_predictions of a given group,
        update predictions table, then upsert user_scores.groups_score + total_points.
        Returns number of users with a non-zero delta.
        Caller must commit.
        """
        rows = db.execute(text("""
            WITH base AS (
                SELECT
                    gsp.id                              AS pred_id,
                    gsp.user_id,
                    COALESCE(gsp.points, 0)             AS old_points,
                    (gsp.first_place  = :first)         AS first_correct,
                    (gsp.second_place = :second)        AS second_correct,
                    (gsp.third_place  = :third)         AS third_correct,
                    (gsp.fourth_place = :fourth)        AS fourth_correct,
                    (
                        CASE WHEN gsp.first_place  = :first  THEN :pts_first  ELSE 0 END +
                        CASE WHEN gsp.second_place = :second THEN :pts_second ELSE 0 END +
                        CASE WHEN gsp.third_place  = :third  THEN :pts_third  ELSE 0 END +
                        CASE WHEN gsp.fourth_place = :fourth THEN :pts_fourth ELSE 0 END
                    )                                   AS new_points,
                    (
                        (gsp.first_place  = :first)::int +
                        (gsp.second_place = :second)::int +
                        (gsp.third_place  = :third)::int +
                        (gsp.fourth_place = :fourth)::int
                    )                                   AS correct_positions_count
                FROM group_stage_predictions gsp
                WHERE gsp.group_id = :group_id
            )
            SELECT * FROM base
        """), {
            "group_id": group_id,
            "first": first, "second": second, "third": third, "fourth": fourth,
            "pts_first": pts_first, "pts_second": pts_second,
            "pts_third": pts_third, "pts_fourth": pts_fourth,
        }).fetchall()

        if not rows:
            return 0

        pred_ids         = [r.pred_id              for r in rows]
        new_points_list  = [r.new_points           for r in rows]
        first_correct    = [r.first_correct        for r in rows]
        second_correct   = [r.second_correct       for r in rows]
        third_correct    = [r.third_correct        for r in rows]
        fourth_correct   = [r.fourth_correct       for r in rows]
        correct_counts   = [r.correct_positions_count for r in rows]

        # Bulk update predictions: points + accuracy fields
        db.execute(text("""
            UPDATE group_stage_predictions gsp
            SET
                points                  = c.new_points,
                first_correct           = c.first_correct,
                second_correct          = c.second_correct,
                third_correct           = c.third_correct,
                fourth_correct          = c.fourth_correct,
                correct_positions_count = c.correct_count,
                status                  = 'settled'
            FROM unnest(
                CAST(:pred_ids       AS int[]),
                CAST(:new_points     AS int[]),
                CAST(:first_correct  AS bool[]),
                CAST(:second_correct AS bool[]),
                CAST(:third_correct  AS bool[]),
                CAST(:fourth_correct AS bool[]),
                CAST(:correct_counts AS int[])
            ) AS c(pred_id, new_points, first_correct, second_correct,
                   third_correct, fourth_correct, correct_count)
            WHERE gsp.id = c.pred_id
        """), {
            "pred_ids":       pred_ids,
            "new_points":     new_points_list,
            "first_correct":  first_correct,
            "second_correct": second_correct,
            "third_correct":  third_correct,
            "fourth_correct": fourth_correct,
            "correct_counts": correct_counts,
        })

        # Compute per-user delta in Python (no extra DB round-trip)
        user_deltas: dict[int, int] = defaultdict(int)
        for r in rows:
            delta = r.new_points - r.old_points
            if delta != 0:
                user_deltas[r.user_id] += delta

        if user_deltas:
            user_ids = list(user_deltas.keys())
            deltas   = list(user_deltas.values())
            db.execute(text("""
                INSERT INTO user_scores
                    (user_id, matches_score, total_points, classic_total_score,
                     groups_score, third_place_score, knockout_score, bonus_score,
                     bonus_penalty, groups_penalty, third_place_penalty,
                     knockout_penalty, free_changes, free_changes_used,
                     penalty, has_used_bracket_reset)
                SELECT u, 0, d, 0, d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false
                FROM unnest(CAST(:user_ids AS int[]), CAST(:deltas AS int[])) AS t(u, d)
                ON CONFLICT (user_id) DO UPDATE
                    SET groups_score  = user_scores.groups_score  + EXCLUDED.groups_score,
                        total_points  = user_scores.total_points  + EXCLUDED.total_points
            """), {"user_ids": user_ids, "deltas": deltas})

        db.flush()
        return len(user_deltas)

    @staticmethod
    def set_group_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(GroupStagePrediction).update({GroupStagePrediction.is_editable: is_editable})

    @staticmethod
    def set_bonus_groups_editable(db: Session, is_editable: bool) -> None:
        from models.predictions import BonusPrediction
        db.query(BonusPrediction).update({BonusPrediction.groups_is_editable: is_editable})
        db.flush()

    @staticmethod
    def set_bonus_knockout_editable(db: Session, is_editable: bool) -> None:
        from models.predictions import BonusPrediction
        db.query(BonusPrediction).update({BonusPrediction.knockout_is_editable: is_editable})
        db.flush()

    @staticmethod
    def set_bonus_tournament_editable(db: Session, is_editable: bool) -> None:
        from models.predictions import BonusPrediction
        db.query(BonusPrediction).update({BonusPrediction.tournament_is_editable: is_editable})
        db.flush()

    @staticmethod
    def update_bonus_question_status(
        db: Session,
        prediction_id: int,
        q_field: str,
        status: str,
        score_delta: int,
    ) -> None:
        from models.predictions import BonusPrediction
        from models.user_scores import UserScores

        pred = db.query(BonusPrediction).filter(BonusPrediction.id == prediction_id).first()
        if not pred:
            return
        setattr(pred, q_field, status)
        pred.bonus_score = (pred.bonus_score or 0) + score_delta
        db.flush()

        if score_delta != 0:
            score_row = db.query(UserScores).filter(UserScores.user_id == pred.user_id).first()
            if score_row:
                new_bonus = (score_row.bonus_score or 0) + score_delta
                new_total = (score_row.total_points or 0) + score_delta
                new_classic = (score_row.matches_score or 0) + new_bonus
                DBWriter.update_user_scores(
                    db, score_row,
                    bonus_score=new_bonus,
                    total_points=new_total,
                    classic_total_score=new_classic,
                )

    @staticmethod
    def set_group_prediction_status(
        db: Session, prediction: GroupStagePrediction, status: Union[str, GroupPredictionStatus]
    ) -> GroupStagePrediction:
        """Set the status field on a group prediction."""
        prediction.status = status
        db.flush()
        return prediction

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Third Place
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_third_place_prediction(db: Session, user_id: int, team_ids: List[Optional[int]],
                                     status: str = "pending") -> ThirdPlacePrediction:
        prediction = ThirdPlacePrediction(
            user_id=user_id,
            first_team_qualifying=team_ids[0],
            second_team_qualifying=team_ids[1],
            third_team_qualifying=team_ids[2],
            fourth_team_qualifying=team_ids[3],
            fifth_team_qualifying=team_ids[4],
            sixth_team_qualifying=team_ids[5],
            seventh_team_qualifying=team_ids[6],
            eighth_team_qualifying=team_ids[7],
            status=status
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction

    @staticmethod
    def update_third_place_prediction(db: Session, prediction: ThirdPlacePrediction,
                                      team_ids: List[int]) -> ThirdPlacePrediction:
        prediction.first_team_qualifying = team_ids[0]
        prediction.second_team_qualifying = team_ids[1]
        prediction.third_team_qualifying = team_ids[2]
        prediction.fourth_team_qualifying = team_ids[3]
        prediction.fifth_team_qualifying = team_ids[4]
        prediction.sixth_team_qualifying = team_ids[5]
        prediction.seventh_team_qualifying = team_ids[6]
        prediction.eighth_team_qualifying = team_ids[7]
        db.flush()
        return prediction

    @staticmethod
    def update_third_place_prediction_fields(db: Session, prediction: ThirdPlacePrediction, **kwargs) -> ThirdPlacePrediction:
        for key, value in kwargs.items():
            if hasattr(prediction, key) and value is not None:
                setattr(prediction, key, value)
        db.flush()
        return prediction

    @staticmethod
    def replace_third_place_team(
        db: Session, prediction: ThirdPlacePrediction, old_team_id: int, new_team_id: int
    ) -> bool:
        qualifying_fields = [attr for attr in dir(prediction) if attr.endswith('_team_qualifying')]
        for field_name in qualifying_fields:
            if getattr(prediction, field_name) == old_team_id:
                setattr(prediction, field_name, new_team_id)
                db.flush()
                return True
        return False

    @staticmethod
    def update_third_place_prediction_changed_groups(
        db: Session, prediction: ThirdPlacePrediction, changed_groups: Optional[str]
    ) -> ThirdPlacePrediction:
        prediction.changed_groups = changed_groups
        db.flush()
        return prediction

    @staticmethod
    def update_third_place_correct_groups(db: Session, prediction: ThirdPlacePrediction, correct_groups_count: int) -> ThirdPlacePrediction:
        """Set the correct_groups_count field on a third place prediction."""
        prediction.correct_groups_count = correct_groups_count
        db.flush()
        return prediction

    @staticmethod
    def delete_third_place_predictions_by_user(db: Session, user_id: int) -> int:
        count = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).delete()
        db.flush()
        return count

    @staticmethod
    def reset_third_place_prediction_points(db: Session) -> int:
        return db.query(ThirdPlacePrediction).update({ThirdPlacePrediction.points: 0})

    @staticmethod
    def reset_third_place_prediction_penalties(db: Session) -> int:
        return db.query(ThirdPlacePrediction).update({
            ThirdPlacePrediction.penalty_points: 0,
            ThirdPlacePrediction.changes_count: 0,
        })

    @staticmethod
    def bulk_update_third_place_prediction_scoring(
        db: Session,
        qualifying_team_ids: list[int],
        minimum_groups: int,
        bonus_per_extra: int,
    ) -> int:
        """
        Bulk SQL: for every third_place_prediction, count how many of its 8 predicted teams
        share a group_letter with any of the 8 qualifying_team_ids, then compute points,
        update predictions, and upsert user_scores.third_place_score + total_points.

        Scoring (matches Python logic exactly):
          correct_count <= minimum_groups  → 0 pts
          correct_count >  minimum_groups  → (correct_count - minimum_groups) * bonus_per_extra

        Returns number of users with a non-zero delta.
        Caller must commit.
        """
        # Resolve group letters for the qualifying teams — small fixed-size query (8 rows)
        letter_rows = db.execute(text("""
            SELECT DISTINCT group_letter
            FROM teams
            WHERE id = ANY(CAST(:ids AS int[]))
              AND group_letter IS NOT NULL
        """), {"ids": qualifying_team_ids}).fetchall()

        qualifying_letters = [r.group_letter for r in letter_rows]

        if not qualifying_letters:
            return 0

        rows = db.execute(text("""
            WITH pred_letters AS (
                -- Unnest the 8 team fields into rows, join to teams to get group_letter
                SELECT
                    tp.id       AS pred_id,
                    tp.user_id,
                    COALESCE(tp.points, 0) AS old_points,
                    t.group_letter
                FROM third_place_predictions tp
                JOIN LATERAL (
                    VALUES
                        (tp.first_team_qualifying),
                        (tp.second_team_qualifying),
                        (tp.third_team_qualifying),
                        (tp.fourth_team_qualifying),
                        (tp.fifth_team_qualifying),
                        (tp.sixth_team_qualifying),
                        (tp.seventh_team_qualifying),
                        (tp.eighth_team_qualifying)
                ) AS slot(team_id) ON TRUE
                JOIN teams t ON t.id = slot.team_id
                WHERE t.group_letter IS NOT NULL
            ),
            pred_correct AS (
                SELECT
                    pred_id,
                    user_id,
                    old_points,
                    COUNT(*) FILTER (
                        WHERE group_letter = ANY(CAST(:qualifying_letters AS text[]))
                    ) AS correct_count
                FROM pred_letters
                GROUP BY pred_id, user_id, old_points
            )
            SELECT
                pred_id,
                user_id,
                old_points,
                correct_count::int AS correct_count,
                CASE
                    WHEN correct_count <= :minimum_groups THEN 0
                    ELSE (correct_count - :minimum_groups) * :bonus_per_extra
                END AS new_points
            FROM pred_correct
        """), {
            "qualifying_letters": qualifying_letters,
            "minimum_groups":     minimum_groups,
            "bonus_per_extra":    bonus_per_extra,
        }).fetchall()

        if not rows:
            return 0

        pred_ids        = [r.pred_id       for r in rows]
        new_points_list = [r.new_points    for r in rows]
        correct_counts  = [r.correct_count for r in rows]

        # Bulk update predictions: points + correct_groups_count + status
        db.execute(text("""
            UPDATE third_place_predictions tp
            SET
                points               = c.new_points,
                correct_groups_count = c.correct_count,
                status               = 'settled'
            FROM unnest(
                CAST(:pred_ids      AS int[]),
                CAST(:new_points    AS int[]),
                CAST(:correct_counts AS int[])
            ) AS c(pred_id, new_points, correct_count)
            WHERE tp.id = c.pred_id
        """), {
            "pred_ids":       pred_ids,
            "new_points":     new_points_list,
            "correct_counts": correct_counts,
        })

        # Per-user delta
        user_deltas: dict[int, int] = defaultdict(int)
        for r in rows:
            delta = r.new_points - r.old_points
            if delta != 0:
                user_deltas[r.user_id] += delta

        if user_deltas:
            user_ids = list(user_deltas.keys())
            deltas   = list(user_deltas.values())
            db.execute(text("""
                INSERT INTO user_scores
                    (user_id, matches_score, total_points, classic_total_score,
                     groups_score, third_place_score, knockout_score, bonus_score,
                     bonus_penalty, groups_penalty, third_place_penalty,
                     knockout_penalty, free_changes, free_changes_used,
                     penalty, has_used_bracket_reset)
                SELECT u, 0, d, 0, 0, d, 0, 0, 0, 0, 0, 0, 0, 0, 0, false
                FROM unnest(CAST(:user_ids AS int[]), CAST(:deltas AS int[])) AS t(u, d)
                ON CONFLICT (user_id) DO UPDATE
                    SET third_place_score = user_scores.third_place_score + EXCLUDED.third_place_score,
                        total_points      = user_scores.total_points      + EXCLUDED.total_points
            """), {"user_ids": user_ids, "deltas": deltas})

        db.flush()
        return len(user_deltas)

    @staticmethod
    def set_third_place_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(ThirdPlacePrediction).update({ThirdPlacePrediction.is_editable: is_editable})

    @staticmethod
    def set_third_place_prediction_status(
        db: Session, prediction: ThirdPlacePrediction, status: Union[str, ThirdPlacePredictionStatus]
    ) -> ThirdPlacePrediction:
        """Set the status field on a third place prediction."""
        prediction.status = status
        db.flush()
        return prediction

    @staticmethod
    def increment_third_place_group_count(db: Session, row: ThirdPlaceGroupCounts, group_letter: str) -> None:
        """Increment counter for a group letter (A-L)."""
        field = f"group_{group_letter.lower()}"
        if hasattr(row, field):
            current = getattr(row, field) or 0
            setattr(row, field, current + 1)
            db.flush()

    @staticmethod
    def decrement_third_place_group_count(db: Session, row: ThirdPlaceGroupCounts, group_letter: str) -> None:
        """Decrement counter for a group letter (A-L). Won't go below 0."""
        field = f"group_{group_letter.lower()}"
        if hasattr(row, field):
            current = getattr(row, field) or 0
            setattr(row, field, max(0, current - 1))
            db.flush()

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Knockout
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def bulk_update_knockout_statuses_for_template(
        db: Session,
        tmpl_id: int,
        possible_ids: List[int],
        eliminated_ids: List[int],
        invalid_status: str,
        valid_status: str,
        unreachable_status: str,
        settled: tuple,
    ) -> None:
        """
        Bulk-update knockout_stage_predictions status for a single template_match_id.
        Three UPDATE statements:
          - INVALID:     winner IS NULL or winner is eliminated
          - VALID:       winner in possible_ids and not eliminated
          - UNREACHABLE: winner not in possible_ids and not eliminated
        Skips predictions already settled (correct_full/correct_partial/incorrect).
        Caller must flush/commit.
        """
        from sqlalchemy import text, bindparam

        settled_bind = bindparam("settled", expanding=True)
        elim_empty = len(eliminated_ids) == 0

        # INVALID
        db.execute(
            text("""
                UPDATE knockout_stage_predictions
                SET status = :invalid
                WHERE template_match_id = :tmpl_id
                  AND status NOT IN :settled
                  AND (
                    winner_team_id IS NULL
                    OR winner_team_id = ANY(CAST(:elim AS int[]))
                  )
            """).bindparams(settled_bind),
            {
                "invalid": invalid_status,
                "tmpl_id": tmpl_id,
                "settled": settled,
                "elim": eliminated_ids,
            },
        )

        # VALID
        db.execute(
            text("""
                UPDATE knockout_stage_predictions
                SET status = :valid
                WHERE template_match_id = :tmpl_id
                  AND status NOT IN :settled
                  AND winner_team_id IS NOT NULL
                  AND winner_team_id = ANY(CAST(:possible AS int[]))
                  AND (
                    :elim_empty = true
                    OR winner_team_id != ALL(CAST(:elim AS int[]))
                  )
            """).bindparams(settled_bind),
            {
                "valid": valid_status,
                "tmpl_id": tmpl_id,
                "settled": settled,
                "possible": possible_ids,
                "elim": eliminated_ids,
                "elim_empty": elim_empty,
            },
        )

        # UNREACHABLE
        db.execute(
            text("""
                UPDATE knockout_stage_predictions
                SET status = :unreachable
                WHERE template_match_id = :tmpl_id
                  AND status NOT IN :settled
                  AND winner_team_id IS NOT NULL
                  AND winner_team_id != ALL(CAST(:possible AS int[]))
                  AND (
                    :elim_empty = true
                    OR winner_team_id != ALL(CAST(:elim AS int[]))
                  )
            """).bindparams(settled_bind),
            {
                "unreachable": unreachable_status,
                "tmpl_id": tmpl_id,
                "settled": settled,
                "possible": possible_ids,
                "elim": eliminated_ids,
                "elim_empty": elim_empty,
            },
        )

    @staticmethod
    def create_knockout_prediction(db: Session, user_id: int, knockout_result_id: int,
                                   template_match_id: int, stage: str,
                                   is_draft: bool = False, **kwargs):
        model = KnockoutStagePredictionDraft if is_draft else KnockoutStagePrediction
        prediction = model(
            user_id=user_id,
            knockout_result_id=knockout_result_id,
            template_match_id=template_match_id,
            stage=stage,
            **kwargs
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction

    @staticmethod
    def update_knockout_prediction(db: Session, prediction, **kwargs):
        # Fields that are allowed to be set to None (clearing is intentional)
        NULLABLE_FIELDS = {"winner_team_id", "team1_id", "team2_id"}
        for key, value in kwargs.items():
            if not hasattr(prediction, key):
                continue
            if key in NULLABLE_FIELDS:
                # Allow explicit None to clear these fields
                setattr(prediction, key, value)
            elif value is not None:
                setattr(prediction, key, value)
        db.flush()
        return prediction

    @staticmethod
    def set_draft_modified_flags(
        db: Session,
        draft,
        is_team1_modified: Optional[bool] = None,
        is_team2_modified: Optional[bool] = None,
        is_winner_modified: Optional[bool] = None,
    ) -> None:
        """Set modified tracking flags on a draft prediction."""
        if is_team1_modified is not None:
            draft.is_team1_modified = is_team1_modified
        if is_team2_modified is not None:
            draft.is_team2_modified = is_team2_modified
        if is_winner_modified is not None:
            draft.is_winner_modified = is_winner_modified
        db.flush()

    @staticmethod
    def delete_knockout_prediction(db: Session, prediction) -> None:
        db.delete(prediction)
        db.flush()

    @staticmethod
    def delete_knockout_predictions(db: Session, predictions: Sequence[KnockoutStagePrediction]) -> None:
        for prediction in predictions:
            db.delete(prediction)
        db.flush()

    @staticmethod
    def delete_all_drafts_for_user(db: Session, user_id: int) -> int:
        count = db.query(KnockoutStagePredictionDraft).filter(
            KnockoutStagePredictionDraft.user_id == user_id
        ).delete()
        db.flush()
        return count

    @staticmethod
    def set_prediction_status(prediction, status: str) -> None:
        prediction.status = status
        prediction.updated_at = datetime.utcnow()

    @staticmethod
    def reset_knockout_prediction_points(db: Session) -> int:
        return db.query(KnockoutStagePrediction).update({KnockoutStagePrediction.points: 0})

    @staticmethod
    def reset_knockout_predictions_to_pre_result_state(db: Session) -> int:
        """
        Bulk-reset all knockout predictions to pre-result state.
        - points = 0, is_editable = True, is_team1_valid = True, is_team2_valid = True
        - status = 'valid' where winner_team_id IS NOT NULL
        - status = 'invalid' where winner_team_id IS NULL
        Two bulk UPDATE queries, no Python loop.
        Returns total count updated.
        """
        count_with_winner = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.winner_team_id.isnot(None)
        ).update({
            KnockoutStagePrediction.points: 0,
            KnockoutStagePrediction.is_editable: True,
            KnockoutStagePrediction.is_team1_valid: True,
            KnockoutStagePrediction.is_team2_valid: True,
            KnockoutStagePrediction.status: 'valid',
        }, synchronize_session=False)

        count_without_winner = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.winner_team_id.is_(None)
        ).update({
            KnockoutStagePrediction.points: 0,
            KnockoutStagePrediction.is_editable: True,
            KnockoutStagePrediction.is_team1_valid: True,
            KnockoutStagePrediction.is_team2_valid: True,
            KnockoutStagePrediction.status: 'invalid',
        }, synchronize_session=False)

        db.flush()
        return count_with_winner + count_without_winner

    @staticmethod
    def reset_knockout_prediction_penalties(db: Session) -> int:
        return db.query(KnockoutStagePrediction).update({
            KnockoutStagePrediction.penalty_points: 0,
            KnockoutStagePrediction.changes_count: 0,
        })

    @staticmethod
    def set_knockout_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(KnockoutStagePrediction).update(
            {KnockoutStagePrediction.is_editable: is_editable}
        )

    @staticmethod
    def set_knockout_predictions_editable_by_stage(db: Session, stage: str, is_editable: bool) -> int:
        return db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.stage == stage
        ).update({KnockoutStagePrediction.is_editable: is_editable})

    # ═══════════════════════════════════════════════════════
    # BONUS PREDICTIONS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def bulk_update_bonus_scores(db: Session) -> None:
        """
        Bulk-upsert user_scores.bonus_score from bonus_predictions.bonus_score.
        Sets total_points and classic_total_score accordingly.
        Call after updating bonus_predictions.bonus_score in Python loop + db.flush().
        Caller must commit.
        """
        from sqlalchemy import text
        db.execute(text("""
            INSERT INTO user_scores
                (user_id, matches_score, total_points, classic_total_score,
                 groups_score, third_place_score, knockout_score, bonus_score,
                 bonus_penalty, groups_penalty, third_place_penalty,
                 knockout_penalty, free_changes, free_changes_used,
                 penalty, has_used_bracket_reset)
            SELECT
                bp.user_id,
                0,
                COALESCE(bp.bonus_score, 0),
                COALESCE(bp.bonus_score, 0),
                0, 0, 0,
                COALESCE(bp.bonus_score, 0),
                0, 0, 0, 0, 0, 0, 0, false
            FROM bonus_predictions bp
            ON CONFLICT (user_id) DO UPDATE SET
                bonus_score         = EXCLUDED.bonus_score,
                total_points        = user_scores.total_points - user_scores.bonus_score + EXCLUDED.bonus_score,
                classic_total_score = user_scores.matches_score + EXCLUDED.bonus_score
        """))

    @staticmethod
    def create_bonus_prediction(db: Session, user_id: int) -> BonusPrediction:
        """Create empty bonus prediction for a user, with correct editability for current stage."""
        from services.stage_manager import StageManager, Stage
        current_stage = StageManager.get_current_stage(db)

        # Bonus locks entirely at GROUP_CYCLE_1 and beyond
        is_editable = current_stage == Stage.PRE_GROUP_STAGE

        pred = BonusPrediction(
            user_id=user_id,
            groups_is_editable=is_editable,
            knockout_is_editable=is_editable,
            tournament_is_editable=is_editable,
        )
        db.add(pred)
        db.flush()
        db.refresh(pred)
        return pred

    @staticmethod
    def update_bonus_prediction(db: Session, pred: BonusPrediction, **kwargs) -> BonusPrediction:
        """Update bonus prediction fields. Uses generic **kwargs pattern like other update methods."""
        for key, value in kwargs.items():
            if hasattr(pred, key) and value is not None:
                setattr(pred, key, value)
        db.flush()
        return pred

    @staticmethod
    def reset_bonus_prediction_points(db: Session) -> int:
        """Reset points to 0 for all bonus predictions. Returns count updated."""
        count = db.query(BonusPrediction).update({BonusPrediction.points: 0})
        db.flush()
        return count

    @staticmethod
    def set_bonus_interim_value(db: Session, field_key: str, value: str | None) -> None:
        """Set a single interim value on bonus_results row (id=1)."""
        from models.results import BonusResults
        row = db.query(BonusResults).filter_by(id=1).first()
        if not row:
            row = BonusResults(id=1)
            db.add(row)
        setattr(row, f"{field_key}_interim", value)
        db.flush()

    @staticmethod
    def set_bonus_interim_values_bulk(db: Session, updates: dict[str, str | None]) -> None:
        """Set multiple interim values at once."""
        from models.results import BonusResults
        row = db.query(BonusResults).filter_by(id=1).first()
        if not row:
            row = BonusResults(id=1)
            db.add(row)
        for field_key, value in updates.items():
            setattr(row, f"{field_key}_interim", value)
        db.flush()

    @staticmethod
    def reset_bonus_prediction_penalties(db: Session) -> int:
        """Reset penalty_points and changes_count to 0 for all bonus predictions."""
        count = db.query(BonusPrediction).update({
            BonusPrediction.penalty_points: 0,
            BonusPrediction.changes_count: 0
        })
        db.flush()
        return count

    # ═══════════════════════════════════════════════════════
    # RESULTS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_match_result(
        db: Session,
        match_id: int,
        home_score: int,
        away_score: int,
        winner_id: Optional[int] = None,
        home_score_120: Optional[int] = None,
        away_score_120: Optional[int] = None,
        home_penalties: Optional[int] = None,
        away_penalties: Optional[int] = None,
        outcome_type: Optional[str] = None
    ) -> MatchResult:
        result = MatchResult(
            match_id=match_id,
            home_team_score=home_score,
            away_team_score=away_score,
            home_team_score_120=home_score_120,
            away_team_score_120=away_score_120,
            home_team_penalties=home_penalties,
            away_team_penalties=away_penalties,
            outcome_type=outcome_type,
            winner_team_id=winner_id
        )
        db.add(result)
        db.flush()
        db.refresh(result)
        return result

    @staticmethod
    def update_match_result(db: Session, result: MatchResult, **kwargs) -> MatchResult:
        for key, value in kwargs.items():
            if hasattr(result, key):
                setattr(result, key, value)
        db.flush()
        return result

    @staticmethod
    def reset_round32_match_teams(db: Session) -> int:
        """Reset home_team_id and away_team_id to None for all round32 matches. Returns count reset."""
        matches = db.query(Match).filter(Match.stage == 'round32').all()
        count = 0
        for match in matches:
            if match.home_team_id is not None or match.away_team_id is not None:
                match.home_team_id = None
                match.away_team_id = None
                count += 1
        db.flush()
        return count

    @staticmethod
    def delete_match_results_by_match_ids(db: Session, match_ids: List[int]) -> int:
        """Delete all MatchResult rows for the given match IDs. Returns count deleted."""
        if not match_ids:
            return 0
        count = db.query(MatchResult).filter(MatchResult.match_id.in_(match_ids)).delete(synchronize_session=False)
        db.flush()
        return count

    @staticmethod
    def ensure_match_result_exists(db: Session, match_id: int) -> None:
        """Ensure a match_result row exists for this match. If not, insert 0-0."""
        existing = db.query(MatchResult).filter(MatchResult.match_id == match_id).first()
        if not existing:
            db.add(MatchResult(match_id=match_id, home_team_score=0, away_team_score=0))
            logger.info(f"[SYNC] Created 0-0 result row for match {match_id}")

    @staticmethod
    def mark_match_result_finalized(db: Session, match: Match) -> None:
        """Mark that the match result has been finalized from external sync."""
        match.status = "finished"
        db.flush()

    @staticmethod
    def create_group_stage_result(db: Session, group_id: int,
                                  first: int, second: int,
                                  third: int, fourth: int) -> GroupStageResult:
        result = GroupStageResult(
            group_id=group_id,
            first_place=first,
            second_place=second,
            third_place=third,
            fourth_place=fourth
        )
        db.add(result)
        db.flush()
        db.refresh(result)
        return result

    @staticmethod
    def update_group_stage_result(db: Session, result: GroupStageResult, **kwargs) -> GroupStageResult:
        for key, value in kwargs.items():
            if hasattr(result, key) and value is not None:
                setattr(result, key, value)
        db.flush()
        return result

    @staticmethod
    def create_third_place_result(db: Session, **kwargs) -> ThirdPlaceResult:
        result = ThirdPlaceResult(**kwargs)
        db.add(result)
        db.flush()
        db.refresh(result)
        return result

    @staticmethod
    def update_third_place_result(db: Session, result: ThirdPlaceResult, **kwargs) -> ThirdPlaceResult:
        for key, value in kwargs.items():
            if hasattr(result, key) and value is not None:
                setattr(result, key, value)
        db.flush()
        return result

    @staticmethod
    def create_knockout_result(db: Session, match_id: int, team1_id: int,
                               team2_id: int, winner_id: int = None) -> KnockoutStageResult:
        result = KnockoutStageResult(
            match_id=match_id,
            team_1=team1_id,
            team_2=team2_id,
            winner_team_id=winner_id
        )
        db.add(result)
        db.flush()
        db.refresh(result)
        return result

    @staticmethod
    def update_knockout_result(db: Session, result: KnockoutStageResult, **kwargs) -> KnockoutStageResult:
        for key, value in kwargs.items():
            if hasattr(result, key) and value is not None:
                setattr(result, key, value)
        db.flush()
        return result

    # ═══════════════════════════════════════════════════════
    # LEAGUES
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_league(db: Session, name: str, created_by: int,
                      invite_code: str, score_mode: str = "multi", **kwargs) -> League:
        from models.league import LeagueScoreMode
        score_mode_enum = LeagueScoreMode(score_mode) if isinstance(score_mode, str) else score_mode
        league = League(name=name, created_by=created_by, invite_code=invite_code, score_mode=score_mode_enum, **kwargs)
        db.add(league)
        db.flush()
        db.refresh(league)
        return league

    @staticmethod
    def create_league_membership(db: Session, league_id: int, user_id: int) -> LeagueMembership:
        membership = LeagueMembership(league_id=league_id, user_id=user_id)
        db.add(membership)
        db.flush()
        db.refresh(membership)
        return membership

    @staticmethod
    def update_league_owner(db: Session, league_id: int, new_owner_id: int) -> None:
        league = db.query(League).filter(League.id == league_id).first()
        if league:
            league.created_by = new_owner_id
            db.flush()

    @staticmethod
    def delete_league_membership(db: Session, membership: LeagueMembership) -> None:
        db.delete(membership)
        db.flush()

    @staticmethod
    def delete_league(db: Session, league_id: int) -> None:
        """Delete a league by ID. Cascades to memberships."""
        league = db.query(League).filter(League.id == league_id).first()
        if league:
            db.delete(league)
            db.flush()

    # ═══════════════════════════════════════════════════════
    # TOURNAMENT CONFIG
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def update_tournament_stage(db: Session, config: TournamentConfig, stage: str) -> TournamentConfig:
        config.current_stage = stage
        db.flush()
        return config
