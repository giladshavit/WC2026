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
    predicted_winner: int = None  # Optional, will be calculated automatically

class BatchPredictionRequest(BaseModel):
    predictions: List[Dict[str, Any]]
    user_id: int

class GroupPredictionRequest(BaseModel):
    group_id: int
    first_place: int
    second_place: int
    third_place: int
    fourth_place: int
    user_id: int

class ThirdPlacePredictionRequest(BaseModel):
    team_ids: List[int]  # רשימה של 8 team IDs שיעלו
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
        db, group_prediction.user_id, group_prediction.group_id, 
        group_prediction.first_place, group_prediction.second_place, 
        group_prediction.third_place, group_prediction.fourth_place
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
        db, third_place_prediction.user_id, third_place_prediction.team_ids
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

@router.put("/predictions/{match_id}", response_model=Dict[str, Any])
def update_single_prediction(
    match_id: int,
    prediction_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    עדכון ניחוש בודד (home_score או away_score)
    """
    user_id = 1  # TODO: זה צריך לבוא מ-authentication
    
    # מביא את החיזוי הנוכחי
    current_prediction = PredictionService.get_match_prediction(db, user_id, match_id)
    
    if not current_prediction:
        # יוצר חיזוי חדש
        home_score = prediction_data.get('home_score', 0)
        away_score = prediction_data.get('away_score', 0)
        result = PredictionService.create_or_update_match_prediction(
            db, user_id, match_id, home_score, away_score
        )
    else:
        # מעדכן חיזוי קיים
        home_score = prediction_data.get('home_score', current_prediction.get('home_score', 0))
        away_score = prediction_data.get('away_score', current_prediction.get('away_score', 0))
        result = PredictionService.create_or_update_match_prediction(
            db, user_id, match_id, home_score, away_score
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