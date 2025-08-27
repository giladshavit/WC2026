from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel

from ..services.prediction_service import PredictionService
from ..database import get_db

router = APIRouter()

# Pydantic models for request validation
class MatchPredictionRequest(BaseModel):
    home_score: int
    away_score: int

class BatchPredictionRequest(BaseModel):
    predictions: List[Dict[str, Any]]

@router.get("/users/{user_id}/predictions", response_model=Dict[str, Any])
def get_user_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    מביא את כל הניחושים של המשתמש
    """
    result = PredictionService.get_user_predictions(db, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

@router.put("/matches/{match_id}/predictions", response_model=Dict[str, Any])
def create_or_update_match_prediction(
    match_id: int, 
    prediction: MatchPredictionRequest, 
    user_id: int,  # TODO: זה צריך לבוא מ-authentication
    db: Session = Depends(get_db)
):
    """
    יצירה או עדכון ניחוש למשחק בודד
    """
    result = PredictionService.create_or_update_match_prediction(
        db, user_id, match_id, prediction.home_score, prediction.away_score
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/predictions/batch", response_model=Dict[str, Any])
def create_or_update_batch_predictions(
    batch_request: BatchPredictionRequest,
    user_id: int,  # TODO: זה צריך לבוא מ-authentication
    db: Session = Depends(get_db)
):
    """
    יצירה או עדכון ניחושים מרובים
    """
    result = PredictionService.create_or_update_batch_predictions(
        db, user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result
