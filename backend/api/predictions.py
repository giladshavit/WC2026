from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from dataclasses import dataclass

from services.prediction_service import PredictionService, PlacesPredictions
from services.group_service import GroupService
from services.stage_manager import StageManager, Stage
from services.match_service import MatchService
from models.predictions import KnockoutStagePrediction, ThirdPlacePrediction
from database import get_db

router = APIRouter()

# Pydantic models for request validation
class MatchPredictionRequest(BaseModel):
    home_score: int = None
    away_score: int = None
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

class BatchKnockoutPredictionUpdate(BaseModel):
    prediction_id: int
    winner_team_number: int  # 1 or 2
    winner_team_name: str

class BatchKnockoutPredictionRequest(BaseModel):
    user_id: int
    predictions: List[BatchKnockoutPredictionUpdate]

# ========================================
# Match Predictions Endpoints
# ========================================

@router.get("/predictions/matches", response_model=List[Dict[str, Any]])
def get_matches_with_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all matches with the user's predictions
    """
    return MatchService.get_all_matches_with_predictions(db, user_id)

@router.post("/predictions/matches/batch", response_model=Dict[str, Any])
def create_or_update_batch_match_predictions(
    batch_request: BatchPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update multiple match predictions
    """
    print(f"Received batch request: {batch_request}")
    print(f"User ID: {batch_request.user_id}")
    print(f"Predictions: {batch_request.predictions}")
    
    result = PredictionService.create_or_update_batch_predictions(
        db, batch_request.user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ========================================
# Group Stage Predictions Endpoints
# ========================================

@router.get("/predictions/groups", response_model=List[Dict[str, Any]])
def get_group_stage_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all groups with teams and user's predictions for group stage
    Returns complete data needed for group predictions UI
    """
    return PredictionService.get_group_predictions(db, user_id)

@router.post("/predictions/groups/batch", response_model=Dict[str, Any])
def create_or_update_batch_group_predictions(
    batch_request: BatchGroupPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update multiple group predictions (batch)
    Only accepts complete predictions (all 4 positions filled)
    """
    # Check if group predictions are editable at current stage
    current_stage = StageManager.get_current_stage(db)
    if current_stage.value > Stage.GROUP_CYCLE_2.value:
        raise HTTPException(
            status_code=403,
            detail=f"Group predictions are no longer editable. Current stage: {current_stage.name}"
        )
    
    result = PredictionService.create_or_update_batch_group_predictions(
        db, batch_request.user_id, batch_request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ========================================
# Group Endpoints (Legacy - for backward compatibility)
# ========================================

@router.get("/groups", response_model=List[Dict[str, Any]])
def get_groups_with_teams(db: Session = Depends(get_db)):
    """
    Get all groups with their teams (without predictions)
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
        # Check if group predictions are editable at current stage
        current_stage = StageManager.get_current_stage(db)
        if current_stage.value > Stage.GROUP_CYCLE_2.value:
            raise HTTPException(
                status_code=403,
                detail=f"Group predictions are no longer editable. Current stage: {current_stage.name}"
            )
        
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

@router.get("/predictions/stage/current", response_model=Dict[str, Any])
async def get_current_stage_info(db: Session = Depends(get_db)):
    """Get current tournament stage information for penalty calculations."""
    current_stage = StageManager.get_current_stage(db)
    
    return {
        "current_stage": current_stage.name,
        "stage_value": current_stage.value,
        "penalty_per_change": current_stage.get_penalty_for(),
        "description": f"Current stage: {current_stage.name}"
    }

@router.post("/predictions/third-place", response_model=Dict[str, Any])
def create_or_update_third_place_prediction(
    third_place_prediction: ThirdPlacePredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update a third-place prediction
    """
    # Check if third place predictions are editable at current stage
    current_stage = StageManager.get_current_stage(db)
    if current_stage.value > Stage.GROUP_CYCLE_3.value:
        raise HTTPException(
            status_code=403,
            detail=f"Third place predictions are no longer editable. Current stage: {current_stage.name}"
        )
    
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
        script_path = os.path.join(os.path.dirname(__file__), "..", "utils", "build_round32_by_prediction.py")
        python_path = os.path.join(os.path.dirname(__file__), "..", "venv", "bin", "python")
        user_id_arg = str(third_place_prediction.user_id)
        
        print(f"🔧 Running bracket build script...")
        print(f"Script path: {script_path}")
        print(f"Python path: {python_path}")
        print(f"User ID: {user_id_arg}")
        
        process_result = subprocess.run(
            [python_path, script_path, user_id_arg],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(__file__))
        )
        
        print(f"Script return code: {process_result.returncode}")
        if process_result.stdout:
            print(f"Script stdout: {process_result.stdout}")
        if process_result.stderr:
            print(f"Script stderr: {process_result.stderr}")
        
        if process_result.returncode == 0:
            result["bracket_rebuilt"] = True
            result["message"] = result.get("message", "") + " Bracket rebuilt automatically."
        else:
            result["bracket_rebuilt"] = False
            result["bracket_error"] = f"Script failed with return code {process_result.returncode}: {process_result.stderr}"
        
    except Exception as e:
        # Do not fail if the script errors - just add a note
        result["bracket_rebuilt"] = False
        result["bracket_error"] = str(e)
        print(f"❌ Exception running bracket script: {e}")
    
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
    # Check if match predictions are editable (they can be edited until group cycle 1 starts)
    current_stage = StageManager.get_current_stage(db)
    if current_stage.value > Stage.PRE_GROUP_STAGE.value:
        raise HTTPException(
            status_code=403,
            detail=f"Match predictions are no longer editable. Current stage: {current_stage.name}"
        )
    
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
        # Check if knockout prediction is editable
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.id == prediction_id
        ).first()
        
        if not prediction:
            raise HTTPException(status_code=404, detail="Knockout prediction not found")
        
        if not prediction.is_editable:
            raise HTTPException(
                status_code=403,
                detail=f"This knockout prediction is no longer editable. Stage: {prediction.stage}"
            )
        
        result = PredictionService.update_knockout_prediction_winner(db, prediction_id, request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating prediction: {str(e)}")

@router.post("/predictions/knockout/batch", response_model=Dict[str, Any])
async def update_batch_knockout_predictions(
    request: BatchKnockoutPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Update multiple knockout predictions at once with penalty calculation
    """
    current_stage = StageManager.get_current_stage(db)
    if current_stage.value > Stage.ROUND32.value:
        raise HTTPException(
            status_code=403,
            detail=f"Knockout predictions are no longer editable. Current stage: {current_stage.name}"
        )
    
    result = PredictionService.update_batch_knockout_predictions(
        db, request.user_id, request.predictions
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Return success even if some predictions failed, but log the errors
    if not result.get("success", False):
        # Log errors but don't fail the entire request
        print(f"Some predictions failed: {result.get('errors', [])}")
    
    return result