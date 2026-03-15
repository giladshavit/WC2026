from enum import Enum
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.tournament_config import TournamentConfig
from services.database import DBWriter, DBUtils

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
    SEMI = 10
    FINAL = 11
    
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
            Stage.SEMI: 3,
            Stage.FINAL: 3,
        }
        return penalty_map.get(self, 0)

    def is_knockout_active(self) -> bool:
        """Returns True for stages where knockout matches are actively being played."""
        return self in (Stage.ROUND32, Stage.ROUND16, Stage.QUARTER, Stage.SEMI, Stage.FINAL)

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
        }
        return mapping.get(self, None)


class StageManager:
    """Tournament stage management and penalty system"""
    
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
        print(f"[DEBUG] set_current_stage CALLED with stage={stage.name}", flush=True)
        # Save to database
        TournamentConfig.set_config(db, 'current_stage', stage.name)
        
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
        print(f"[DEBUG] _update_prediction_editability ENTERED with stage={current_stage.name}", flush=True)

        if current_stage == Stage.PRE_GROUP_STAGE:
            print(f"[DEBUG] _update_prediction_editability: PRE_GROUP_STAGE - everything open")
            # Everything open
            DBWriter.set_group_predictions_editable(db, True)
            DBWriter.set_third_place_predictions_editable(db, True)
            DBWriter.set_knockout_predictions_editable(db, True)
            DBWriter.set_bonus_groups_editable(db, True)
            DBWriter.set_bonus_knockout_editable(db, True)
            DBWriter.set_bonus_tournament_editable(db, True)

        elif current_stage in (Stage.GROUP_CYCLE_1, Stage.GROUP_CYCLE_2):
            print(f"[DEBUG] _update_prediction_editability: {current_stage.name} - no changes")
            # Nothing changes
            pass

        elif current_stage == Stage.GROUP_CYCLE_3:
            print(f"[DEBUG] _update_prediction_editability: GROUP_CYCLE_3 - close groups + third place")
            # Close groups and third place only
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)
            DBWriter.set_bonus_groups_editable(db, False)

        elif current_stage == Stage.PRE_ROUND32:
            print(f"[DEBUG] _update_prediction_editability: PRE_ROUND32 - no changes")
            pass

        elif current_stage.is_knockout_active():
            print(f"[DEBUG] _update_prediction_editability: {current_stage.name} (knockout active) - close everything")
            # Active knockout stage: close everything
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)
            DBWriter.set_knockout_predictions_editable(db, False)
            DBWriter.set_bonus_groups_editable(db, False)
            DBWriter.set_bonus_knockout_editable(db, False)
            DBWriter.set_bonus_tournament_editable(db, False)

        elif current_stage == Stage.PRE_ROUND16:
            print(f"[DEBUG] _update_prediction_editability: PRE_ROUND16 - close round32, open rest")
            # Close round32, open round16 through final
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round32', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round16', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'quarter', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'semi', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'final', True)
            DBWriter.set_bonus_knockout_editable(db, True)
            DBWriter.set_bonus_tournament_editable(db, True)

        elif current_stage == Stage.PRE_QUARTER:
            print(f"[DEBUG] _update_prediction_editability: PRE_QUARTER - close round32+round16, open rest")
            # Close round32 + round16, open quarter through final
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round32', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'round16', False)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'quarter', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'semi', True)
            DBWriter.set_knockout_predictions_editable_by_stage(db, 'final', True)
            DBWriter.set_bonus_groups_editable(db, False)
            DBWriter.set_bonus_knockout_editable(db, False)
            DBWriter.set_bonus_tournament_editable(db, False)

        DBUtils.commit(db)
    
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
