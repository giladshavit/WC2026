"""
DBWriter: All WRITE (INSERT/UPDATE/DELETE) operations.
Every method that modifies database state lives here.
Methods call db.flush() to get IDs but do NOT call db.commit().
Commit responsibility belongs to the service layer via DBUtils.commit().
"""
import logging
from collections import defaultdict
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
from models.tournament_config import TournamentConfig
from models.statistics import ThirdPlaceGroupCounts
from services.predictions.enums import MatchPredictionStatus, PredictionType


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
    def create_user_scores(db: Session, user_id: int) -> UserScores:
        scores = UserScores(
            user_id=user_id,
            matches_score=0,
            groups_score=0,
            third_place_score=0,
            knockout_score=0,
            penalty=0,
            total_points=0
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
    def reset_user_scores(db: Session, scores: UserScores) -> UserScores:
        scores.matches_score = 0
        scores.groups_score = 0
        scores.third_place_score = 0
        scores.knockout_score = 0
        scores.penalty = 0
        scores.total_points = 0
        db.flush()
        return scores

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
            if hasattr(prediction, key) and value is not None:
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
        prediction.status = status
        db.flush()
        return prediction

    @staticmethod
    def reset_match_prediction_points(db: Session) -> int:
        return db.query(MatchPrediction).update({MatchPrediction.points: 0})

    @staticmethod
    def reset_match_prediction_statuses(db: Session) -> int:
        """Reset all match prediction statuses to pending (when results are deleted)."""
        return db.query(MatchPrediction).update({
            MatchPrediction.status: MatchPredictionStatus.PENDING
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
                        WHEN mp.home_score = :home AND mp.away_score = :away THEN 3
                        WHEN :winner_id IS NOT NULL
                         AND mp.predicted_winner = :winner_id               THEN 1
                        ELSE 0
                    END                            AS base_points,
                    CASE
                        WHEN mp.home_score IS NULL OR mp.away_score IS NULL THEN 'pending'
                        WHEN mp.home_score = :home AND mp.away_score = :away THEN 'exact'
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
        }).fetchall()

        if not rows:
            return 0

        pred_ids = [r.pred_id for r in rows]
        new_points = [r.new_points for r in rows]

        db.execute(text("""
            UPDATE match_predictions mp
            SET points = c.new_points
            FROM unnest(:pred_ids::int[], :new_points::int[])
                 AS c(pred_id, new_points)
            WHERE mp.id = c.pred_id
        """), {"pred_ids": pred_ids, "new_points": new_points})

        if update_status:
            new_statuses = [r.new_status for r in rows]
            db.execute(text("""
                UPDATE match_predictions mp
                SET status = c.new_status
                FROM unnest(:pred_ids::int[], :new_statuses::text[])
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
                    (user_id, matches_score, total_points,
                     groups_score, third_place_score, knockout_score, penalty)
                SELECT u, d, d, 0, 0, 0, 0
                FROM unnest(:user_ids::int[], :deltas::int[]) AS t(u, d)
                ON CONFLICT (user_id) DO UPDATE
                    SET matches_score = user_scores.matches_score + EXCLUDED.matches_score,
                        total_points  = user_scores.total_points  + EXCLUDED.total_points
            """), {"user_ids": user_ids, "deltas": deltas})

        db.flush()
        return len(user_deltas)

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Group
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_group_prediction(db: Session, user_id: int, group_id: int,
                                first: Optional[int], second: Optional[int],
                                third: Optional[int], fourth: Optional[int]) -> GroupStagePrediction:
        prediction = GroupStagePrediction(
            user_id=user_id,
            group_id=group_id,
            first_place=first,
            second_place=second,
            third_place=third,
            fourth_place=fourth
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
    def set_group_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(GroupStagePrediction).update({GroupStagePrediction.is_editable: is_editable})

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Third Place
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_third_place_prediction(db: Session, user_id: int, team_ids: List[Optional[int]]) -> ThirdPlacePrediction:
        prediction = ThirdPlacePrediction(
            user_id=user_id,
            first_team_qualifying=team_ids[0],
            second_team_qualifying=team_ids[1],
            third_team_qualifying=team_ids[2],
            fourth_team_qualifying=team_ids[3],
            fifth_team_qualifying=team_ids[4],
            sixth_team_qualifying=team_ids[5],
            seventh_team_qualifying=team_ids[6],
            eighth_team_qualifying=team_ids[7]
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
    def set_third_place_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(ThirdPlacePrediction).update({ThirdPlacePrediction.is_editable: is_editable})

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
        for key, value in kwargs.items():
            if hasattr(prediction, key) and value is not None:
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
                      invite_code: str, **kwargs) -> League:
        league = League(name=name, created_by=created_by, invite_code=invite_code, **kwargs)
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
