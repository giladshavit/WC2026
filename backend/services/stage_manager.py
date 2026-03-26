import logging
from enum import Enum
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.tournament_config import TournamentConfig
from services.database import DBReader, DBWriter, DBUtils

logger = logging.getLogger(__name__)


class Stage(Enum):
    """Tournament stages"""
    PRE_GROUP_STAGE = 0
    GROUP_CYCLE_1 = 1
    GROUP_CYCLE_2 = 2
    GROUP_CYCLE_3 = 3
    PRE_ROUND32 = 4
    ROUND32 = 5
    PRE_ROUND16 = 6
    ROUND16 = 7
    PRE_QUARTER = 8
    QUARTER = 9
    PRE_SEMI = 10
    SEMI = 11
    THIRD_PLACE = 12
    PRE_FINAL = 13
    FINAL = 14
    TOURNAMENT_OVER = 15

    def get_penalty_for(self) -> int:
        """Get penalty points for editing at this stage"""
        penalty_map = {
            Stage.PRE_GROUP_STAGE: 0,
            Stage.GROUP_CYCLE_1: 1,
            Stage.GROUP_CYCLE_2: 1,
            Stage.GROUP_CYCLE_3: 2,
            Stage.PRE_ROUND32: 2,
            Stage.ROUND32: 2,
            Stage.PRE_ROUND16: 3,
            Stage.ROUND16: 3,
            Stage.PRE_QUARTER: 3,
            Stage.QUARTER: 3,
            Stage.PRE_SEMI: 4,
            Stage.SEMI: 4,
            Stage.THIRD_PLACE: 4,
            Stage.PRE_FINAL: 4,
            Stage.FINAL: 4,
            Stage.TOURNAMENT_OVER: 4,
        }
        return penalty_map.get(self, 0)

    def free_changes_grant(self) -> int:
        """
        Returns how many free changes to GRANT when entering this stage.
        Only specific stages grant free changes. All others return 0.
        """
        grant_map = {
            Stage.GROUP_CYCLE_1: 12,
            Stage.PRE_ROUND32: 8,
            Stage.PRE_ROUND16: 4,
            Stage.PRE_QUARTER: 2,
            Stage.PRE_SEMI: 1,
        }
        return grant_map.get(self, 0)

    def is_knockout_active(self) -> bool:
        """Returns True for stages where knockout matches are actively being played."""
        return self in (
            Stage.ROUND32,
            Stage.ROUND16,
            Stage.QUARTER,
            Stage.SEMI,
            Stage.FINAL,
            Stage.THIRD_PLACE,
            Stage.PRE_FINAL,
            Stage.TOURNAMENT_OVER,
        )

    def is_between_knockout_stages(self) -> bool:
        """Returns True when not in active knockout stage."""
        return not self.is_knockout_active()

    def is_group_stage(self) -> bool:
        """Returns True for group cycle stages."""
        return self in (Stage.GROUP_CYCLE_1, Stage.GROUP_CYCLE_2, Stage.GROUP_CYCLE_3)

    def is_pre_tournament(self) -> bool:
        """Returns True only for pre-tournament stage."""
        return self == Stage.PRE_GROUP_STAGE

    def can_create_knockout_drafts(self) -> bool:
        """Returns True when knockout drafts can be created."""
        return not self.is_knockout_active()

    def can_edit_knockout_predictions_directly(self) -> bool:
        """Returns True only for PRE_GROUP_STAGE. Once tournament starts, knockout predictions can only be changed via draft system."""
        return self == Stage.PRE_GROUP_STAGE

    @property
    def knockout_stage_name(self) -> Optional[str]:
        """Returns the knockout stage DB string for this stage, or None if not a knockout stage."""
        mapping = {
            Stage.ROUND32: 'round32',
            Stage.ROUND16: 'round16',
            Stage.QUARTER: 'quarter',
            Stage.SEMI: 'semi',
            Stage.FINAL: 'final',
            Stage.THIRD_PLACE: 'third_place',
        }
        return mapping.get(self, None)


class StageManager:
    """Tournament stage management and penalty system"""

    STAGE_TRANSITION_MAP_FINISHED: dict[int, Stage] = {
        72: Stage.PRE_ROUND32,
        88: Stage.PRE_ROUND16,
        96: Stage.PRE_QUARTER,
        100: Stage.PRE_SEMI,
        102: Stage.THIRD_PLACE,
        103: Stage.PRE_FINAL,
        104: Stage.TOURNAMENT_OVER,
    }

    STAGE_TRANSITION_MAP_LIVE: dict[int, Stage] = {
        1: Stage.GROUP_CYCLE_1,
        25: Stage.GROUP_CYCLE_2,
        49: Stage.GROUP_CYCLE_3,
        73: Stage.ROUND32,
        89: Stage.ROUND16,
        97: Stage.QUARTER,
        101: Stage.SEMI,
        104: Stage.FINAL,
    }

    # Combined (live wins on duplicate match ids, e.g. 104 live vs 104 finished)
    STAGE_TRANSITION_MAP: dict[int, tuple[str, Stage]] = {
        **{k: ("finished", v) for k, v in STAGE_TRANSITION_MAP_FINISHED.items()},
        **{k: ("live", v) for k, v in STAGE_TRANSITION_MAP_LIVE.items()},
    }

    @staticmethod
    def maybe_advance_stage_for_match(db: Session, match_id: int, new_status: str) -> bool:
        """
        Check if a match status change should trigger a stage transition.
        Only transitions FORWARD (never downgrade the stage).
        Returns True if a stage transition occurred.
        """
        if new_status == "live":
            target_stage = StageManager.STAGE_TRANSITION_MAP_LIVE.get(match_id)
        elif new_status == "finished":
            target_stage = StageManager.STAGE_TRANSITION_MAP_FINISHED.get(match_id)
        else:
            return False

        if target_stage is None:
            return False

        current_stage = StageManager.get_current_stage(db)
        if target_stage.value <= current_stage.value:
            return False

        StageManager.set_current_stage(target_stage, db)
        logger.info(f"[StageAutoTransition] Match {match_id} → {new_status} → Stage: {target_stage.name}")
        return True

    @staticmethod
    def get_current_stage(db: Session = None) -> Stage:
        """Get current tournament stage"""
        if db is None:
            from database import get_db
            db = next(get_db())
        
        stage_name = TournamentConfig.get_config(db, 'current_stage', 'PRE_GROUP_STAGE')
        try:
            return Stage[stage_name]
        except KeyError:
            return Stage.PRE_GROUP_STAGE
    
    @staticmethod
    def set_current_stage(stage: Stage, db: Session) -> None:
        """Update current tournament stage and update prediction editability"""
        # Save to database
        TournamentConfig.set_config(db, 'current_stage', stage.name)

        # Grant free changes when entering stages that provide them
        grant = stage.free_changes_grant()
        if grant > 0:
            all_scores = DBReader.get_all_user_scores(db)
            for user_scores in all_scores:
                new_free = (user_scores.free_changes or 0) + grant
                DBWriter.update_user_scores(db, user_scores, free_changes=new_free)

        # Update prediction editability based on new stage
        StageManager._update_prediction_editability(stage, db)
    
    @staticmethod
    def advance_stage(db: Session) -> Stage:
        """Advance to next stage"""
        current = StageManager.get_current_stage(db)
        
        # Get next stage
        stages = list(Stage)
        current_index = stages.index(current)
        
        if current_index < len(stages) - 1:
            next_stage = stages[current_index + 1]
            StageManager.set_current_stage(next_stage, db)
            return next_stage
        else:
            return current  # Already at final stage
    
    @staticmethod
    def reset_stage(db: Session) -> Stage:
        """Reset to PRE_GROUP_STAGE and restore all editability."""
        StageManager.set_current_stage(Stage.PRE_GROUP_STAGE, db)
        return Stage.PRE_GROUP_STAGE
    
    @staticmethod
    def _block_knockout_predictions_by_stage(db: Session, stage: Stage) -> None:
        """Block knockout predictions for the given stage enum value."""
        stage_name = stage.knockout_stage_name
        if stage_name:
            DBWriter.set_knockout_predictions_editable_by_stage(db, stage_name, False)
    
    @staticmethod
    def _update_prediction_editability(current_stage: Stage, db: Session) -> None:
        """
        Update is_editable for all predictions based on current stage.
        Called automatically by set_current_stage.
        """
        if current_stage == Stage.PRE_GROUP_STAGE:
            # Everything open
            DBWriter.set_group_predictions_editable(db, True)
            DBWriter.set_third_place_predictions_editable(db, True)
            DBWriter.set_knockout_predictions_editable(db, True)
            DBWriter.set_bonus_groups_editable(db, True)
            DBWriter.set_bonus_knockout_editable(db, True)
            DBWriter.set_bonus_tournament_editable(db, True)

        elif current_stage == Stage.GROUP_CYCLE_1:
            # Tournament starts: close all bonus sections
            DBWriter.set_bonus_groups_editable(db, False)
            DBWriter.set_bonus_knockout_editable(db, False)
            DBWriter.set_bonus_tournament_editable(db, False)

        elif current_stage == Stage.GROUP_CYCLE_2:
            # No changes
            pass

        elif current_stage == Stage.GROUP_CYCLE_3:
            # Close groups and third place only
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)

        elif current_stage == Stage.PRE_ROUND32:
            pass

        elif current_stage == Stage.THIRD_PLACE:
            pass  # no editability changes

        elif current_stage == Stage.PRE_FINAL:
            pass  # no editability changes

        elif current_stage == Stage.TOURNAMENT_OVER:
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)
            DBWriter.set_knockout_predictions_editable(db, False)
            DBWriter.set_bonus_groups_editable(db, False)
            DBWriter.set_bonus_knockout_editable(db, False)
            DBWriter.set_bonus_tournament_editable(db, False)

        elif current_stage.is_knockout_active():
            # Active knockout stage: close everything
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)
            DBWriter.set_knockout_predictions_editable(db, False)
            DBWriter.set_bonus_groups_editable(db, False)
            DBWriter.set_bonus_knockout_editable(db, False)
            DBWriter.set_bonus_tournament_editable(db, False)

        elif current_stage == Stage.PRE_ROUND16:
            # Close round32, open round16 through final
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round32', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round16', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'quarter', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'semi', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'final', True)

        elif current_stage == Stage.PRE_QUARTER:
            # Close round32 + round16, open quarter through final
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round32', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round16', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'quarter', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'semi', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'final', True)

        elif current_stage == Stage.PRE_SEMI:
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round32', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round16', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'quarter', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'semi', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'final', True)

        DBUtils.commit(db)
    
    @staticmethod
    def get_stage_timeline(db: Session) -> list[dict]:
        """
        Returns list of dicts with stage window info.
        All datetimes are UTC ISO strings.
        Returns empty list if matches not yet loaded.
        """
        from datetime import timedelta

        def get_date(match_id: int):
            m = DBReader.get_match(db, match_id)
            return m.date if m else None

        def iso(dt):
            if dt is None:
                return None
            from datetime import timezone
            # Normalize to UTC and always use Z suffix
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            s = dt.isoformat()
            return s + 'Z'

        m1 = get_date(1)
        m25 = get_date(25)
        m49 = get_date(49)
        m72 = get_date(72)
        m73 = get_date(73)
        m88 = get_date(88)
        m89 = get_date(89)
        m96 = get_date(96)
        m97 = get_date(97)
        m100 = get_date(100)
        m101 = get_date(101)
        m102 = get_date(102)
        m103 = get_date(103)
        m104 = get_date(104)

        if m1 is None:
            return []

        THREE_HOURS = timedelta(hours=3)

        return [
            {"stage": "PRE_GROUP_STAGE", "label": "Pre-Tournament", "start": None, "end": iso(m1)},
            {"stage": "GROUP_CYCLE_1", "label": "Matchday 1", "start": iso(m1), "end": iso(m25)},
            {"stage": "GROUP_CYCLE_2", "label": "Matchday 2", "start": iso(m25), "end": iso(m49)},
            {"stage": "GROUP_CYCLE_3", "label": "Matchday 3", "start": iso(m49), "end": iso(m72 + THREE_HOURS)},
            {"stage": "PRE_ROUND32", "label": "Pre Round of 32", "start": iso(m72 + THREE_HOURS) if m72 else iso(m73), "end": iso(m73)},
            {"stage": "ROUND32", "label": "Round of 32", "start": iso(m73), "end": iso(m88 + THREE_HOURS) if m88 else None},
            {"stage": "PRE_ROUND16", "label": "Pre Round of 16", "start": iso(m88 + THREE_HOURS) if m88 else None, "end": iso(m89)},
            {"stage": "ROUND16", "label": "Round of 16", "start": iso(m89), "end": iso(m96 + THREE_HOURS) if m96 else None},
            {"stage": "PRE_QUARTER", "label": "Pre Quarter-Final", "start": iso(m96 + THREE_HOURS) if m96 else None, "end": iso(m97)},
            {"stage": "QUARTER", "label": "Quarter-Final", "start": iso(m97), "end": iso(m100 + THREE_HOURS) if m100 else None},
            {"stage": "PRE_SEMI", "label": "Pre Semi-Final", "start": iso(m100 + THREE_HOURS) if m100 else None, "end": iso(m101)},
            {"stage": "SEMI", "label": "Semi-Final", "start": iso(m101), "end": iso(m102 + THREE_HOURS) if m102 else None},
            {"stage": "THIRD_PLACE", "label": "3rd Place Match", "start": iso(m102 + THREE_HOURS) if m102 else None, "end": iso(m103 + THREE_HOURS) if m103 else None},
            {"stage": "PRE_FINAL", "label": "Pre Final", "start": iso(m103 + THREE_HOURS) if m103 else None, "end": iso(m104)},
            {"stage": "FINAL", "label": "Final", "start": iso(m104), "end": iso(m104 + THREE_HOURS) if m104 else None},
            {"stage": "TOURNAMENT_OVER", "label": "Tournament Over", "start": iso(m104 + THREE_HOURS) if m104 else None, "end": None},
        ]

    @staticmethod
    def get_penalty_for_edit() -> int:
        """Get penalty for editing at current stage"""
        current_stage = StageManager.get_current_stage()
        return current_stage.get_penalty_for()

    @staticmethod
    def can_create_knockout_drafts(db: Session) -> Tuple[bool, str]:
        """Check if knockout drafts can be created right now."""
        stage = StageManager.get_current_stage(db)
        if stage.can_create_knockout_drafts():
            return (True, "OK")
        return (False, f"Cannot create drafts during active knockout stage: {stage.name}")
