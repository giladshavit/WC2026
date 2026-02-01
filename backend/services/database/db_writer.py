"""
DBWriter: All WRITE (INSERT/UPDATE/DELETE) operations.
Every method that modifies database state lives here.
Methods call db.flush() to get IDs but do NOT call db.commit().
Commit responsibility belongs to the service layer via DBUtils.commit().
"""
from typing import Optional, List, Dict, Any, Sequence
from datetime import datetime
from sqlalchemy.orm import Session

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
    def update_match_prediction(db: Session, prediction: MatchPrediction, **kwargs) -> MatchPrediction:
        for key, value in kwargs.items():
            if hasattr(prediction, key) and value is not None:
                setattr(prediction, key, value)
        db.flush()
        return prediction

    @staticmethod
    def reset_match_prediction_points(db: Session) -> int:
        return db.query(MatchPrediction).update({MatchPrediction.points: 0})

    @staticmethod
    def set_match_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(MatchPrediction).update({MatchPrediction.is_editable: is_editable})

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Group
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_group_prediction(db: Session, user_id: int, group_id: int,
                                first: int, second: int, third: int, fourth: int) -> GroupStagePrediction:
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
    def set_group_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(GroupStagePrediction).update({GroupStagePrediction.is_editable: is_editable})

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Third Place
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def create_third_place_prediction(db: Session, user_id: int, team_ids: List[int]) -> ThirdPlacePrediction:
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
    def set_third_place_predictions_editable(db: Session, is_editable: bool) -> int:
        return db.query(ThirdPlacePrediction).update({ThirdPlacePrediction.is_editable: is_editable})

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
        winner_id: int,
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

    # ═══════════════════════════════════════════════════════
    # TOURNAMENT CONFIG
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def update_tournament_stage(db: Session, config: TournamentConfig, stage: str) -> TournamentConfig:
        config.current_stage = stage
        db.flush()
        return config
