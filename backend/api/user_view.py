from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services.user_view_service import UserViewService

router = APIRouter(tags=["user_view"])


@router.get("/users/{user_id}/profile", response_model=Dict[str, Any])
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_profile(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/predictions/matches", response_model=Dict[str, Any])
def get_user_match_predictions(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_match_predictions(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/predictions/groups", response_model=Dict[str, Any])
def get_user_group_predictions(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_group_predictions(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/predictions/third-place", response_model=Dict[str, Any])
def get_user_third_place_predictions(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_third_place_predictions(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/predictions/knockout", response_model=Dict[str, Any])
def get_user_knockout_predictions(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_knockout_predictions(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/predictions/bonus", response_model=Dict[str, Any])
def get_user_bonus_prediction(user_id: int, db: Session = Depends(get_db)):
    try:
        return UserViewService.get_user_bonus_prediction(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
