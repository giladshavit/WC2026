from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from dataclasses import dataclass

from services.predictions import PredictionService, PlacesPredictions
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

@router.get("/predictions/matches", response_model=Dict[str, Any])
def get_matches_with_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all matches with the user's predictions and user scores
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

@router.get("/predictions/groups", response_model=Dict[str, Any])
def get_group_stage_predictions(user_id: int, db: Session = Depends(get_db)):
    """
    Get all groups with teams and user's predictions for group stage
    Returns complete data needed for group predictions UI including groups score
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
    try:
        print(f"📥 Received batch group prediction request for user_id: {batch_request.user_id}")
        print(f"📥 Number of predictions: {len(batch_request.predictions)}")
        print(f"📥 Predictions data: {batch_request.predictions}")
        
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
        
        print(f"✅ Batch group prediction result: {result}")
        
        if "error" in result:
            print(f"❌ Error in batch group prediction: {result['error']}")
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Exception in batch group prediction endpoint: {str(e)}")
        print(f"❌ Exception type: {type(e).__name__}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ========================================
# Third Place Predictions Endpoints
# ========================================

@router.get("/predictions/third-place", response_model=Dict[str, Any])
def get_third_place_predictions_data(user_id: int, db: Session = Depends(get_db)):
    """
    Get unified third-place data: eligible teams + predictions with is_selected field
    Returns complete data needed for third-place predictions UI
    """
    return PredictionService.get_third_place_predictions_data(db, user_id)

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

# ========================================
# Knockout Predictions Endpoints
# ========================================

@router.get("/predictions/knockout", response_model=Dict[str, Any])
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
        from services.predictions import PredictionRepository
        prediction = PredictionRepository.get_knockout_prediction_by_id(db, prediction_id)
        
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
