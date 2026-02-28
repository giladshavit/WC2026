"""
DBReader: All READ (SELECT) operations from database.
This is the ONLY place where db.query() should appear for reads.
No service should call db.query() directly — always go through DBReader.
"""
from typing import List, Optional, Sequence, Dict, Tuple
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from models.team import Team
from models.user import User
from models.user_scores import UserScores
from models.groups import Group
from models.group_template import GroupTemplate
from models.matches import Match
from models.matches_template import MatchTemplate
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
from models.third_place_combinations import ThirdPlaceCombination
from models.tournament_config import TournamentConfig
from models.statistics import ThirdPlaceGroupCounts
from models.league import League, LeagueMembership


class DBReader:
    """All READ operations from database. No mutations allowed."""

    # ═══════════════════════════════════════════════════════
    # TEAMS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_team(db: Session, team_id: int) -> Optional[Team]:
        return db.query(Team).filter(Team.id == team_id).first()

    @staticmethod
    def get_team_by_name(db: Session, name: str) -> Optional[Team]:
        return db.query(Team).filter(Team.name == name).first()

    @staticmethod
    def get_all_teams(db: Session) -> List[Team]:
        return db.query(Team).all()

    @staticmethod
    def get_teams_by_group(db: Session, group_id: int) -> List[Team]:
        return db.query(Team).filter(Team.group_id == group_id).all()

    @staticmethod
    def get_eliminated_teams(db: Session) -> List[Team]:
        return db.query(Team).filter(Team.is_eliminated == True).all()

    @staticmethod
    def get_team_group_letter(db: Session, team_id: int) -> Optional[str]:
        team = db.query(Team).filter(Team.id == team_id).first()
        return team.group_letter if team and team.group_letter else None

    # ═══════════════════════════════════════════════════════
    # USERS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def get_all_users(db: Session) -> List[User]:
        return db.query(User).all()

    @staticmethod
    def get_users_ordered_by_points(db: Session, limit: int) -> List[User]:
        return db.query(User).order_by(User.total_points.desc()).limit(limit).all()

    @staticmethod
    def get_user_scores(db: Session, user_id: int) -> Optional[UserScores]:
        return db.query(UserScores).filter(UserScores.user_id == user_id).first()

    @staticmethod
    def get_all_user_scores(db: Session) -> List[UserScores]:
        return db.query(UserScores).all()

    # ═══════════════════════════════════════════════════════
    # GROUPS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_group(db: Session, group_id: int) -> Optional[Group]:
        return db.query(Group).filter(Group.id == group_id).first()

    @staticmethod
    def get_group_by_name(db: Session, name: str) -> Optional[Group]:
        return db.query(Group).filter(Group.name == name).first()

    @staticmethod
    def get_all_groups(db: Session) -> List[Group]:
        return db.query(Group).all()

    @staticmethod
    def get_groups_ordered(db: Session) -> List[Group]:
        return db.query(Group).order_by(Group.id).all()

    @staticmethod
    def get_group_template_by_name(db: Session, group_name: str) -> Optional[GroupTemplate]:
        return db.query(GroupTemplate).filter(GroupTemplate.group_name == group_name).first()

    @staticmethod
    def get_match_and_slot_from_group_template(
        db: Session, group_id: int, position: int
    ) -> Optional[Tuple[int, int]]:
        """
        Get (match_id, team_slot) for a group's qualifier in the knockout round.

        Args:
            group_id: the group's DB id
            position: 1 (first place) or 2 (second place)

        Returns:
            Tuple of (match_id, team_slot) where team_slot is 1 or 2,
            or None if group or template not found.
        """
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            return None

        template = db.query(GroupTemplate).filter(GroupTemplate.group_name == group.name).first()
        if not template:
            return None

        if position == 1:
            return (template.first_place_match_id, template.first_place_team_slot)
        elif position == 2:
            return (template.second_place_match_id, template.second_place_team_slot)

        return None

    # ═══════════════════════════════════════════════════════
    # MATCHES & TEMPLATES
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_match(db: Session, match_id: int) -> Optional[Match]:
        return db.query(Match).filter(Match.id == match_id).first()

    @staticmethod
    def get_match_by_number(db: Session, match_number: int) -> Optional[Match]:
        return db.query(Match).filter(Match.match_number == match_number).first()

    @staticmethod
    def get_all_matches(db: Session) -> List[Match]:
        return db.query(Match).all()

    @staticmethod
    def get_matches_with_teams(db: Session) -> List[Match]:
        return db.query(Match).filter(
            and_(
                Match.home_team_id.isnot(None),
                Match.away_team_id.isnot(None)
            )
        ).all()

    @staticmethod
    def get_matches_by_stage(db: Session, stage: str) -> List[Match]:
        return db.query(Match).filter(Match.stage == stage).all()

    @staticmethod
    def get_knockout_matches_with_teams(db: Session, stages: Sequence[str]) -> List[Match]:
        return db.query(Match).filter(
            Match.stage.in_(stages)
        ).filter(
            Match.home_team_id.isnot(None),
            Match.away_team_id.isnot(None)
        ).all()

    @staticmethod
    def get_match_template(db: Session, template_id: int) -> Optional[MatchTemplate]:
        return db.query(MatchTemplate).filter(MatchTemplate.id == template_id).first()

    @staticmethod
    def get_match_templates_by_stage(db: Session, stage: str) -> List[MatchTemplate]:
        return db.query(MatchTemplate).filter(MatchTemplate.stage == stage).all()

    @staticmethod
    def get_match_templates_by_stage_ordered(db: Session, stage: str) -> List[MatchTemplate]:
        return db.query(MatchTemplate).filter(
            MatchTemplate.stage == stage
        ).order_by(MatchTemplate.id).all()

    @staticmethod
    def get_match_templates_by_stages_ordered(db: Session, stages: Sequence[str]) -> List[MatchTemplate]:
        return db.query(MatchTemplate).filter(
            MatchTemplate.stage.in_(stages)
        ).order_by(MatchTemplate.id).all()

    @staticmethod
    def get_all_knockout_templates(db: Session) -> List[MatchTemplate]:
        """Get all match templates for knockout stages (not group)."""
        return db.query(MatchTemplate).filter(
            MatchTemplate.stage != "group"
        ).all()

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Match
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_match_prediction(db: Session, user_id: int, match_id: int) -> Optional[MatchPrediction]:
        return db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()

    @staticmethod
    def get_match_predictions_by_user(db: Session, user_id: int) -> List[MatchPrediction]:
        return db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id
        ).all()

    @staticmethod
    def get_match_predictions_by_match(db: Session, match_id: int) -> List[MatchPrediction]:
        return db.query(MatchPrediction).filter(
            MatchPrediction.match_id == match_id
        ).all()

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Group
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_group_prediction(db: Session, user_id: int, group_id: int) -> Optional[GroupStagePrediction]:
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id,
            GroupStagePrediction.group_id == group_id
        ).first()

    @staticmethod
    def get_group_predictions_by_user(db: Session, user_id: int) -> List[GroupStagePrediction]:
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()

    @staticmethod
    def get_group_predictions_by_group(db: Session, group_id: int) -> List[GroupStagePrediction]:
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.group_id == group_id
        ).all()

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Third Place
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_third_place_prediction(db: Session, user_id: int) -> Optional[ThirdPlacePrediction]:
        return db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()

    @staticmethod
    def get_all_third_place_predictions(db: Session) -> List[ThirdPlacePrediction]:
        return db.query(ThirdPlacePrediction).all()

    @staticmethod
    def get_third_place_predictions_by_user(db: Session, user_id: int) -> List[ThirdPlacePrediction]:
        return db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()

    @staticmethod
    def get_third_place_combination_by_hash(db: Session, hash_key: str) -> Optional[ThirdPlaceCombination]:
        return db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()

    @staticmethod
    def get_all_third_place_combinations(db: Session) -> List[ThirdPlaceCombination]:
        return db.query(ThirdPlaceCombination).all()

    # ═══════════════════════════════════════════════════════
    # PREDICTIONS - Knockout
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_knockout_prediction_by_id(db: Session, pred_id: int, is_draft: bool = False):
        model = KnockoutStagePredictionDraft if is_draft else KnockoutStagePrediction
        return db.query(model).filter(model.id == pred_id).first()

    @staticmethod
    def get_knockout_prediction(db: Session, user_id: int, match_id: int, is_draft: bool = False):
        model = KnockoutStagePredictionDraft if is_draft else KnockoutStagePrediction
        return db.query(model).filter(
            model.user_id == user_id,
            model.template_match_id == match_id
        ).first()

    @staticmethod
    def get_knockout_prediction_by_user_and_team2(db: Session, user_id: int, team2_id: int, is_draft: bool = False):
        model = KnockoutStagePredictionDraft if is_draft else KnockoutStagePrediction
        return db.query(model).filter(
            model.user_id == user_id,
            model.team2_id == team2_id
        ).first()

    @staticmethod
    def get_knockout_predictions_by_user(db: Session, user_id: int, stage: Optional[str] = None, is_draft: bool = False):
        model = KnockoutStagePredictionDraft if is_draft else KnockoutStagePrediction
        query = db.query(model).filter(model.user_id == user_id)
        if stage:
            query = query.filter(model.stage == stage)
        return query.all()

    @staticmethod
    def get_knockout_predictions_by_stage(db: Session, stage: str) -> List[KnockoutStagePrediction]:
        return db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.stage == stage
        ).all()

    @staticmethod
    def get_knockout_predictions_by_match(db: Session, match_id: int) -> List[KnockoutStagePrediction]:
        return db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == match_id
        ).all()

    @staticmethod
    def count_knockout_exact_winners(db: Session, template_match_id: int, winner_team_id: int) -> int:
        """Count users who predicted the correct winner in this specific match."""
        return db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == template_match_id,
            KnockoutStagePrediction.winner_team_id == winner_team_id,
        ).count()

    @staticmethod
    def count_knockout_winner_in_stage_excluding_match(
        db: Session, stage: str, winner_team_id: int, exclude_match_id: int
    ) -> int:
        """Count distinct users who predicted a specific winner in a stage, excluding one match."""
        return db.query(KnockoutStagePrediction.user_id).filter(
            KnockoutStagePrediction.stage == stage,
            KnockoutStagePrediction.winner_team_id == winner_team_id,
            KnockoutStagePrediction.template_match_id != exclude_match_id,
        ).distinct().count()

    @staticmethod
    def get_all_knockout_predictions(db: Session) -> List[KnockoutStagePrediction]:
        return db.query(KnockoutStagePrediction).all()

    @staticmethod
    def get_knockout_predictions_by_user_and_matches(
        db: Session, user_id: int, match_ids: Sequence[int]
    ) -> List[KnockoutStagePrediction]:
        return db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id,
            KnockoutStagePrediction.template_match_id.in_(match_ids)
        ).all()

    @staticmethod
    def get_knockout_draft_predictions_by_user(db: Session, user_id: int):
        return db.query(KnockoutStagePredictionDraft).filter(
            KnockoutStagePredictionDraft.user_id == user_id
        ).all()

    @staticmethod
    def get_draft_modified_flags(db: Session, draft) -> dict:
        """Returns which fields the user explicitly modified in this draft."""
        return {
            "is_team1_modified": bool(getattr(draft, "is_team1_modified", False)),
            "is_team2_modified": bool(getattr(draft, "is_team2_modified", False)),
            "is_winner_modified": bool(getattr(draft, "is_winner_modified", False)),
        }

    @staticmethod
    def is_draft_winner_modified(db: Session, draft) -> bool:
        """Returns True if the user explicitly changed the winner in this draft."""
        return bool(getattr(draft, "is_winner_modified", False))

    # ═══════════════════════════════════════════════════════
    # RESULTS
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_match_result(db: Session, match_id: int) -> Optional[MatchResult]:
        return db.query(MatchResult).filter(MatchResult.match_id == match_id).first()

    @staticmethod
    def get_all_match_results(db: Session) -> List[MatchResult]:
        return db.query(MatchResult).all()

    @staticmethod
    def get_group_stage_result(db: Session, group_id: int) -> Optional[GroupStageResult]:
        return db.query(GroupStageResult).filter(GroupStageResult.group_id == group_id).first()

    @staticmethod
    def get_all_group_stage_results(db: Session) -> List[GroupStageResult]:
        return db.query(GroupStageResult).all()

    @staticmethod
    def get_third_place_result(db: Session) -> Optional[ThirdPlaceResult]:
        return db.query(ThirdPlaceResult).first()

    @staticmethod
    def get_knockout_result(db: Session, match_id: int) -> Optional[KnockoutStageResult]:
        return db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == match_id
        ).first()

    @staticmethod
    def get_knockout_result_by_id(db: Session, result_id: int) -> Optional[KnockoutStageResult]:
        return db.query(KnockoutStageResult).filter(
            KnockoutStageResult.id == result_id
        ).first()

    @staticmethod
    def get_all_knockout_results(db: Session) -> List[KnockoutStageResult]:
        return db.query(KnockoutStageResult).all()

    @staticmethod
    def any_knockout_results_exist(db: Session) -> bool:
        """Return True if any knockout stage result has both team_1 and team_2 populated."""
        return db.query(KnockoutStageResult).filter(
            KnockoutStageResult.team_1.isnot(None),
            KnockoutStageResult.team_2.isnot(None),
        ).first() is not None

    # ═══════════════════════════════════════════════════════
    # LEAGUES
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_league(db: Session, league_id: int) -> Optional[League]:
        return db.query(League).filter(League.id == league_id).first()

    @staticmethod
    def get_league_by_invite_code(db: Session, invite_code: str) -> Optional[League]:
        return db.query(League).filter(League.invite_code == invite_code).first()

    @staticmethod
    def get_leagues_by_user(db: Session, user_id: int) -> List[League]:
        return db.query(League).join(LeagueMembership).filter(
            LeagueMembership.user_id == user_id
        ).all()

    @staticmethod
    def get_league_membership(db: Session, league_id: int, user_id: int) -> Optional[LeagueMembership]:
        return db.query(LeagueMembership).filter(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == user_id
        ).first()

    @staticmethod
    def get_league_members(db: Session, league_id: int) -> List[LeagueMembership]:
        return db.query(LeagueMembership).filter(
            LeagueMembership.league_id == league_id
        ).all()

    @staticmethod
    def get_league_memberships_by_league(db: Session, league_id: int) -> List[LeagueMembership]:
        return db.query(LeagueMembership).filter(
            LeagueMembership.league_id == league_id
        ).all()

    @staticmethod
    def get_league_membership_count(db: Session, league_id: int) -> int:
        return len(db.query(LeagueMembership).filter(
            LeagueMembership.league_id == league_id
        ).all())

    @staticmethod
    def get_league_memberships_by_user(db: Session, user_id: int) -> List[LeagueMembership]:
        return db.query(LeagueMembership).filter(
            LeagueMembership.user_id == user_id
        ).all()

    @staticmethod
    def get_active_league_by_invite_code(db: Session, invite_code: str) -> Optional[League]:
        return db.query(League).filter(
            League.invite_code == invite_code,
            League.is_active == True
        ).first()

    @staticmethod
    def get_active_league_by_id(db: Session, league_id: int) -> Optional[League]:
        return db.query(League).filter(
            League.id == league_id,
            League.is_active == True
        ).first()

    @staticmethod
    def get_global_standings(db: Session):
        return db.query(User, UserScores).outerjoin(
            UserScores, User.id == UserScores.user_id
        ).order_by(desc(UserScores.total_points)).all()

    @staticmethod
    def get_league_standings(db: Session, league_id: int):
        return db.query(User, UserScores, LeagueMembership).join(
            LeagueMembership, User.id == LeagueMembership.user_id
        ).outerjoin(
            UserScores, User.id == UserScores.user_id
        ).filter(
            LeagueMembership.league_id == league_id
        ).order_by(desc(UserScores.total_points)).all()

    # ═══════════════════════════════════════════════════════
    # TOURNAMENT CONFIG
    # ═══════════════════════════════════════════════════════
    @staticmethod
    def get_tournament_config(db: Session) -> Optional[TournamentConfig]:
        return db.query(TournamentConfig).first()

    # ═══════════════════════════════════════════════════════
    # STATISTICS - User profile
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def count_match_predictions_by_status(db: Session, user_id: int) -> Dict[str, int]:
        """Count user's match predictions grouped by status. Returns dict like {'exact': 5, 'correct_outcome': 10, ...}"""
        rows = (
            db.query(MatchPrediction.status, func.count(MatchPrediction.id))
            .filter(MatchPrediction.user_id == user_id)
            .group_by(MatchPrediction.status)
            .all()
        )
        return {
            (status.value if status else "pending"): count
            for status, count in rows
        }

    @staticmethod
    def count_knockout_predictions_by_status(db: Session, user_id: int) -> Dict[str, int]:
        """Count user's knockout predictions grouped by status."""
        rows = (
            db.query(KnockoutStagePrediction.status, func.count(KnockoutStagePrediction.id))
            .filter(KnockoutStagePrediction.user_id == user_id)
            .group_by(KnockoutStagePrediction.status)
            .all()
        )
        return {str(status or 'valid'): count for status, count in rows}

    @staticmethod
    def count_group_position_correct(db: Session, user_id: int) -> Dict[str, int]:
        """Count how many times user got each position right across all judged groups."""
        predictions = (
            db.query(GroupStagePrediction)
            .filter(
                GroupStagePrediction.user_id == user_id,
                GroupStagePrediction.correct_positions_count.isnot(None)
            )
            .all()
        )
        counts = {"first": 0, "second": 0, "third": 0, "fourth": 0}
        for p in predictions:
            if p.first_correct:
                counts["first"] += 1
            if p.second_correct:
                counts["second"] += 1
            if p.third_correct:
                counts["third"] += 1
            if p.fourth_correct:
                counts["fourth"] += 1
        return counts

    @staticmethod
    def count_group_accuracy_distribution(db: Session, user_id: int) -> Dict[int, int]:
        """Count how many groups got 0/1/2/3/4 positions right. Returns {0: N, 1: N, ...}"""
        rows = (
            db.query(
                GroupStagePrediction.correct_positions_count,
                func.count(GroupStagePrediction.id)
            )
            .filter(
                GroupStagePrediction.user_id == user_id,
                GroupStagePrediction.correct_positions_count.isnot(None)
            )
            .group_by(GroupStagePrediction.correct_positions_count)
            .all()
        )
        dist = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
        for count_val, num in rows:
            if count_val in dist:
                dist[count_val] = num
        return dist

    @staticmethod
    def get_third_place_group_counts(db: Session) -> ThirdPlaceGroupCounts:
        """Get the singleton row. Creates it if missing."""
        row = db.query(ThirdPlaceGroupCounts).first()
        if not row:
            row = ThirdPlaceGroupCounts()
            db.add(row)
            db.flush()
        return row
