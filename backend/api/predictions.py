from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from dataclasses import dataclass

from services.prediction_service import PredictionService, PlacesPredictions
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
    team_ids: List[int]  # List of 8 team IDs that will advance
    user_id: int

class BatchGroupPredictionRequest(BaseModel):
    user_id: int
    predictions: List[Dict[str, Any]]  # List of group predictions

class UpdateKnockoutPredictionRequest(BaseModel):
    winner_team_number: int  # 1 or 2
    winner_team_name: str

@router.get("/groups", response_model=List[Dict[str, Any]])
def get_groups_with_teams(db: Session = Depends(get_db)):
    """
    Get all groups with their teams
    """
    return GroupService.get_all_groups_with_teams(db)

@router.get("/groups/{group_name}", response_model=Dict[str, Any])
def get_group_with_teams(group_name: str, db: Session = Depends(get_db)):
    """
    Get a specific group with its teams
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
    Create or update a group prediction
    """
    try:
        # Create PlacesPredictions object
        places = PlacesPredictions(
            first_place=group_prediction.first_place,
            second_place=group_prediction.second_place,
            third_place=group_prediction.third_place,
            fourth_place=group_prediction.fourth_place
        )
        
        result = PredictionService.create_or_update_group_prediction(
            db, 
            group_prediction.user_id, 
            group_prediction.group_id, 
            places
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating group prediction: {str(e)}"
        )

@router.get("/users/{user_id}/group-predictions", response_model=List[Dict[str, Any]])
def get_user_group_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all user's group predictions
    """
    return PredictionService.get_group_predictions(db, user_id)

@router.post("/predictions/group-stage/batch", response_model=Dict[str, Any])
def create_or_update_batch_group_predictions(
    batch_request: BatchGroupPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update multiple group predictions
    """
    result = PredictionService.create_or_update_batch_group_predictions(
        db, batch_request.user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/predictions/third-place", response_model=Dict[str, Any])
def create_or_update_third_place_prediction(
    third_place_prediction: ThirdPlacePredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update a third-place prediction
    """
    result = PredictionService.create_or_update_third_place_prediction(
        db, third_place_prediction.user_id, third_place_prediction.team_ids
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Run script to build the bracket automatically
    try:
        import subprocess
        import os
        
        # Execute the bracket build script
        script_path = os.path.join(os.path.dirname(__file__), "..", "utils", "build_knockout_bracket.py")
        python_path = os.path.join(os.path.dirname(__file__), "..", "venv", "bin", "python")
        
        subprocess.run(
            [python_path, script_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(__file__))
        )
        
        result["bracket_rebuilt"] = True
        result["message"] = result.get("message", "") + " Bracket rebuilt automatically."
        
    except Exception as e:
        # Do not fail if the script errors - just add a note
        result["bracket_rebuilt"] = False
        result["bracket_error"] = str(e)
    
    return result

@router.get("/users/{user_id}/third-place-predictions", response_model=List[Dict[str, Any]])
def get_user_third_place_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get user's third-place predictions
    """
    return PredictionService.get_third_place_predictions(db, user_id)

@router.get("/users/{user_id}/third-place-eligible-teams", response_model=List[Dict[str, Any]])
def get_third_place_eligible_teams(user_id: int, db: Session = Depends(get_db)):
    """
    Get the 12 teams that are third-place candidates based on the user's group predictions
    """
    return PredictionService.get_third_place_eligible_teams(db, user_id)

@router.get("/users/{user_id}/predictions", response_model=Dict[str, Any])
def get_user_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all user's predictions
    """
    result = PredictionService.get_user_predictions(db, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

@router.put("/matches/{match_id}/predictions", response_model=Dict[str, Any])
def create_or_update_match_prediction(
    match_id: int, 
    prediction: MatchPredictionRequest, 
    user_id: int,  # TODO: should come from authentication
    db: Session = Depends(get_db)
):
    """
    Create or update a single match prediction
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
    Update a single prediction (home_score or away_score)
    """
    user_id = 1  # TODO: should come from authentication
    
    # Fetch current prediction
    current_prediction = PredictionService.get_match_prediction(db, user_id, match_id)
    
    if not current_prediction:
        # Create a new prediction
        home_score = prediction_data.get('home_score', 0)
        away_score = prediction_data.get('away_score', 0)
        result = PredictionService.create_or_update_match_prediction(
            db, user_id, match_id, home_score, away_score
        )
    else:
        # Update existing prediction
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
    Create or update multiple predictions
    """
    result = PredictionService.create_or_update_batch_predictions(
        db, batch_request.user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/predictions/knockout")
def get_knockout_predictions(
    user_id: int = 1,  # TODO: should come from authentication
    stage: str = None, 
    db: Session = Depends(get_db)
):
    """
    Get all user's knockout predictions. If stage is provided, filter by stage.
    """
    try:
        result = PredictionService.get_knockout_predictions(db, user_id, stage)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching knockout predictions: {str(e)}")

@router.put("/predictions/knockout/{prediction_id}")
def update_knockout_prediction_winner(
    prediction_id: int,
    request: UpdateKnockoutPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Update a knockout prediction - choose winner and update next stages
    """
    try:
        result = PredictionService.update_knockout_prediction_winner(db, prediction_id, request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating prediction: {str(e)}")

@staticmethod
def update_group_prediction_basic(db, existing_prediction, places: PlacesPredictions):
    """
    Basic update of places
    """
    existing_prediction.first_place = places.first_place
    existing_prediction.second_place = places.second_place
    existing_prediction.third_place = places.third_place
    existing_prediction.fourth_place = places.fourth_place
    db.commit()

@staticmethod
def handle_third_place_change(db, user_id, old_third_place, new_third_place):
    """
    Handle change in 3rd place
    """
    third_place_changed = old_third_place != new_third_place
    
    if third_place_changed:
        PredictionService.update_third_place_predictions(db, user_id, old_third_place, new_third_place)
    
    return third_place_changed

@staticmethod
def update_third_place_predictions(db, user_id, old_third_place, new_third_place):
    """
    Update third-place predictions
    """
    # Fetch existing third-place qualifying predictions
    third_place_prediction = db.query(ThirdPlacePrediction).filter(
        ThirdPlacePrediction.user_id == user_id
    ).first()

    if third_place_prediction:
        # Check if the old third-place team is selected
        old_team_selected = False
        new_team_selected = False

        # Check if the new team is already selected
        for i in range(1, 9):  # first_team_qualifying to eighth_team_qualifying
            team_field = getattr(third_place_prediction,
                                 f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i - 1]}_team_qualifying")
            if team_field == old_third_place:
                old_team_selected = True
                # Replace old team with new team
                setattr(third_place_prediction,
                        f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i - 1]}_team_qualifying",
                        new_third_place)
                break
            elif team_field == new_third_place:
                new_team_selected = True

        # If the new team is already selected and the old team is also selected - swap them
        if new_team_selected and old_team_selected:
            # Find the position of the new team and swap with the old team
            for i in range(1, 9):
                team_field = getattr(third_place_prediction,
                                     f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i - 1]}_team_qualifying")
                if team_field == new_third_place:
                    setattr(third_place_prediction,
                            f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i - 1]}_team_qualifying",
                            old_third_place)
                    break

        db.commit()