from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel

from services.prediction_service import PredictionService
from services.group_service import GroupService
from database import get_db

router = APIRouter()

# Pydantic models for request validation
class MatchPredictionRequest(BaseModel):
    home_score: int
    away_score: int

class BatchPredictionRequest(BaseModel):
    predictions: List[Dict[str, Any]]
    user_id: int

class GroupPredictionRequest(BaseModel):
    group_id: int
    positions: List[int]  # רשימה של 4 team IDs בסדר המקומות
    user_id: int

class ThirdPlacePredictionRequest(BaseModel):
    advancing_team_ids: List[int]  # רשימה של 8 team IDs שיעלו
    user_id: int

@router.get("/groups", response_model=List[Dict[str, Any]])
def get_groups_with_teams(db: Session = Depends(get_db)):
    """
    מביא את כל הבתים עם הקבוצות שלהם
    """
    return GroupService.get_all_groups_with_teams(db)

@router.get("/groups/{group_name}", response_model=Dict[str, Any])
def get_group_with_teams(group_name: str, db: Session = Depends(get_db)):
    """
    מביא בית ספציפי עם הקבוצות שלו
    """
    result = GroupService.get_group_with_teams(db, group_name)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

@router.post("/predictions/group-stage", response_model=Dict[str, Any])
def create_or_update_group_prediction(
    group_prediction: GroupPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    יצירה או עדכון ניחוש לשלב הבתים
    """
    result = PredictionService.create_or_update_group_prediction(
        db, group_prediction.user_id, group_prediction.group_id, group_prediction.positions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/users/{user_id}/group-predictions", response_model=List[Dict[str, Any]])
def get_user_group_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    מביא את כל ניחושי הבתים של המשתמש
    """
    return PredictionService.get_group_predictions(db, user_id)

@router.post("/predictions/third-place", response_model=Dict[str, Any])
def create_or_update_third_place_prediction(
    third_place_prediction: ThirdPlacePredictionRequest,
    db: Session = Depends(get_db)
):
    """
    יצירה או עדכון ניחוש למקומות 3
    """
    result = PredictionService.create_or_update_third_place_prediction(
        db, third_place_prediction.user_id, third_place_prediction.advancing_team_ids
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/users/{user_id}/third-place-predictions", response_model=List[Dict[str, Any]])
def get_user_third_place_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    מביא את ניחושי המקומות 3 של המשתמש
    """
    return PredictionService.get_third_place_predictions(db, user_id)

@router.get("/users/{user_id}/third-place-eligible-teams", response_model=List[Dict[str, Any]])
def get_third_place_eligible_teams(user_id: int, db: Session = Depends(get_db)):
    """
    מביא את 12 הקבוצות שמגיעות ממקום 3 לפי ניחושי הבתים של המשתמש
    """
    return PredictionService.get_third_place_eligible_teams(db, user_id)

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
    db: Session = Depends(get_db)
):
    """
    יצירה או עדכון ניחושים מרובים
    """
    result = PredictionService.create_or_update_batch_predictions(
        db, batch_request.user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result
