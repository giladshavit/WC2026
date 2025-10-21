from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.stage_manager import StageManager, Stage

router = APIRouter()

@router.get("/config")
async def get_app_config(db: Session = Depends(get_db)):
    """Get application configuration including current stage and penalty settings"""
    try:
        current_stage = StageManager.get_current_stage(db)
        
        # Get penalty for current stage
        penalty_per_change = current_stage.get_penalty_for()
        
        return {
            "current_stage": current_stage.name,
            "penalty_per_change": penalty_per_change
        }
    except Exception as e:
        return {
            "current_stage": "PRE_GROUP_STAGE",
            "penalty_per_change": 0,
            "error": str(e)
        }
