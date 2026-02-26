from enum import Enum
from typing import Tuple
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
            Stage.GROUP_CYCLE_2: 2,
            Stage.GROUP_CYCLE_3: 3,
            Stage.PRE_ROUND32: 4,
            Stage.ROUND32: 5,
            Stage.PRE_ROUND16: 6,
            Stage.ROUND16: 7,
            Stage.PRE_QUARTER: 8,
            Stage.QUARTER: 9,
            Stage.SEMI: 10,
            Stage.FINAL: 11
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
        """Reset to first stage and make all predictions editable"""
        StageManager.set_current_stage(Stage.PRE_GROUP_STAGE, db)
        
        # Make all predictions editable
        DBWriter.set_match_predictions_editable(db, True)
        DBWriter.set_group_predictions_editable(db, True)
        DBWriter.set_third_place_predictions_editable(db, True)
        DBWriter.set_knockout_predictions_editable(db, True)
        
        DBUtils.commit(db)
        return Stage.PRE_GROUP_STAGE
    
    @staticmethod
    def _block_knockout_predictions_by_stage(db: Session, stage_name: str) -> None:
        """Helper function to block knockout predictions by stage name"""
        DBWriter.set_knockout_predictions_editable_by_stage(db, stage_name, False)
    
    @staticmethod
    def _update_prediction_editability(current_stage: Stage, db: Session) -> None:
        """Update is_editable field for all predictions based on current stage"""

        # Knockout predictions: only directly editable at PRE_GROUP_STAGE
        # After tournament starts, all changes must go through the draft system
        if current_stage != Stage.PRE_GROUP_STAGE:
            DBWriter.set_knockout_predictions_editable(db, False)

        # Switch case for each stage
        if current_stage == Stage.PRE_GROUP_STAGE:
            # All predictions editable - do nothing
            pass
            
        elif current_stage == Stage.GROUP_CYCLE_1:
            # All predictions still editable - do nothing
            pass
            
        elif current_stage == Stage.GROUP_CYCLE_2:
            # All predictions still editable - do nothing
            pass
            
        elif current_stage == Stage.GROUP_CYCLE_3:
            # Block group stage and third place predictions
            DBWriter.set_group_predictions_editable(db, False)
            DBWriter.set_third_place_predictions_editable(db, False)
            
        elif current_stage == Stage.PRE_ROUND32:
            # No additional blocking - do nothing
            pass
            
        elif current_stage == Stage.ROUND32:
            # Block round32 knockout predictions
            StageManager._block_knockout_predictions_by_stage(db, 'round32')
            
        elif current_stage == Stage.PRE_ROUND16:
            # No additional blocking - do nothing
            pass
            
        elif current_stage == Stage.ROUND16:
            # Block round16 knockout predictions
            StageManager._block_knockout_predictions_by_stage(db, 'round16')
            
        elif current_stage == Stage.PRE_QUARTER:
            # No additional blocking - do nothing
            pass
            
        elif current_stage == Stage.QUARTER:
            # Block quarter knockout predictions
            StageManager._block_knockout_predictions_by_stage(db, 'quarter')
            
        elif current_stage == Stage.SEMI:
            # Block semi knockout predictions
            StageManager._block_knockout_predictions_by_stage(db, 'semi')
            
        elif current_stage == Stage.FINAL:
            # Block final knockout predictions
            StageManager._block_knockout_predictions_by_stage(db, 'final')
        
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
