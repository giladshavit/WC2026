"""Bonus prediction API router."""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from services.auth_service import AuthService
from services.predictions.bonus_prediction_service import BonusPredictionService
from services.predictions.bonus_service import BONUS_FIELD_MAP
from services.statistics import BonusStatisticsService
from models.predictions import BonusPrediction
from models.user import User

router = APIRouter(prefix="/predictions/bonus", tags=["Bonus Predictions"])
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        token = credentials.credentials
        return AuthService.get_current_user(db, token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


class BonusPredictionUpdateRequest(BaseModel):
    class Config:
        extra = "allow"


class BonusResultStats(BaseModel):
    field_key: str
    settled: bool
    correct: int
    incorrect: int
    pending: int
    total: int


class BonusOutcomeStats(BaseModel):
    field_key: str
    settled: bool
    correct: int
    incorrect: int
    total_answered: int
    correct_pct: int
    incorrect_pct: int


# GET /predictions/bonus
@router.get("", response_model=Dict[str, Any])
def get_bonus_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get or create bonus prediction for current user."""
    pred = BonusPredictionService.get_or_create_bonus_prediction(db, current_user.id)
    return BonusPredictionService._to_response(pred, db)


# PUT /predictions/bonus
@router.put("", response_model=Dict[str, Any])
def update_bonus_prediction(
    body: BonusPredictionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update bonus prediction with changed fields only."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return BonusPredictionService.update_bonus_prediction(db, current_user.id, updates)


# GET /predictions/bonus/options
@router.get("/options", response_model=Dict[str, Any])
def get_bonus_options(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all enum options for every question (for UI dropdowns)."""
    return BonusPredictionService.get_options(db)


# GET /predictions/bonus/statistics/{field_key}/results
@router.get("/statistics/{field_key}/results", response_model=BonusResultStats)
def get_bonus_result_statistics(field_key: str, db: Session = Depends(get_db)):
    """
    Returns correct/incorrect/pending counts for a settled bonus question.
    field_key: g1, g2, g3, g4, g5, k1, k2, k3, t1, t2
    No auth required — statistics are public.
    """
    if field_key not in BONUS_FIELD_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown field_key: {field_key}")
    _, status_col = BONUS_FIELD_MAP[field_key]

    predictions = db.query(BonusPrediction).all()
    correct = 0
    incorrect = 0
    pending = 0
    for pred in predictions:
        status_val = getattr(pred, status_col, "pending") or "pending"
        if status_val == "correct":
            correct += 1
        elif status_val in ("incorrect", "wrong"):
            incorrect += 1
        else:
            pending += 1

    return BonusResultStats(
        field_key=field_key,
        settled=correct + incorrect > 0,
        correct=correct,
        incorrect=incorrect,
        pending=pending,
        total=len(predictions),
    )


# GET /predictions/bonus/statistics/{field_key}/outcomes
@router.get("/statistics/{field_key}/outcomes", response_model=BonusOutcomeStats)
def get_bonus_question_outcomes(field_key: str, db: Session = Depends(get_db)):
    """
    Returns correct/incorrect outcome stats for users who answered this question.
    Excludes users who left it blank. Only meaningful after the question is settled.
    """
    if field_key not in ["g1", "g2", "g3", "g4", "g5", "k1", "k2", "k3", "t1", "t2"]:
        raise HTTPException(status_code=404, detail="Unknown field_key")
    return BonusStatisticsService.get_question_outcome_stats(db, field_key)


# GET /predictions/bonus/statistics/{field_key}
@router.get("/statistics/{field_key}", response_model=Dict[str, Any])
def get_bonus_statistics(field_key: str, db: Session = Depends(get_db)):
    """
    Returns answer distribution (%) for a single bonus question.
    field_key: g1, g2, g3, g4, g5, k1, k2, k3, t1, t2
    No auth required — statistics are public.
    """
    return BonusStatisticsService.get_question_statistics(db, field_key)
