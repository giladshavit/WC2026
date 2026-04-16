from typing import Optional

from fastapi import APIRouter, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from services.auth_service import AuthService
from services.stage_manager import StageManager, Stage

router = APIRouter()
security = HTTPBearer(auto_error=False)


@router.get("/config")
async def get_app_config(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
):
    """Get application configuration including current stage and penalty settings"""
    is_admin = False
    if credentials:
        try:
            user = AuthService.get_current_user(db, credentials.credentials)
            is_admin = user.username == "admin" and (user.email == "giladshavit1@gmail.com" or user.email == "admin@temp.com")
        except Exception:
            pass
    try:
        current_stage = StageManager.get_current_stage(db)
        penalty_per_change = current_stage.get_penalty_for()
        stage_timeline = StageManager.get_stage_timeline(db)

        return {
            "current_stage": current_stage.name,
            "penalty_per_change": penalty_per_change,
            "stage_timeline": stage_timeline,
            "is_admin": is_admin,
        }
    except Exception as e:
        return {
            "current_stage": "PRE_GROUP_STAGE",
            "penalty_per_change": 0,
            "stage_timeline": [],
            "is_admin": is_admin,
            "error": str(e),
        }
