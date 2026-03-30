import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from dataclasses import dataclass

from services.predictions import PredictionService
from services.predictions.knockout_service import KnockoutService

logger = logging.getLogger(__name__)
from services.database import DBReader, DBUtils
from services.stage_manager import StageManager, Stage
from services.predictions.match_prediction_service import MatchPredictionService
from services.temptation_service import get_temptation_suggestions
from database import get_db

router = APIRouter()

# Pydantic models for request validation
class MatchPredictionRequest(BaseModel):
    home_score: int = None
    away_score: int = None
    predicted_winner: int = None  # Optional, will be calculated automatically


class MatchPredictionBatchItem(BaseModel):
    match_id: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    is_tempted: Optional[bool] = False

    class Config:
        extra = "allow"  # Allow extra fields for backward compatibility


class BatchPredictionRequest(BaseModel):
    predictions: List[MatchPredictionBatchItem]
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
    logger.info(f"[DEBUG] get_matches_with_predictions CALLED user_id={user_id}")
    return MatchPredictionService.get_all_matches_with_predictions(db, user_id)


@router.get("/predictions/matches/{match_id}/temptation-suggestions", response_model=Dict[str, Any])
def get_temptation_suggestions_endpoint(
    match_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Get temptation suggestions for a match (statistically rare predicted outcomes).
    Returns up to 3 suggested scores if the feature is available (>= 100 predictions).
    """
    suggestions = get_temptation_suggestions(db, match_id)
    if suggestions is None:
        return {"available": False, "suggestions": []}
    return {"available": True, "suggestions": suggestions}


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
    
    # Convert to list of dicts for service (includes is_tempted)
    predictions_data = [p.model_dump() for p in batch_request.predictions]
    result = PredictionService.create_or_update_batch_predictions(
        db, batch_request.user_id, predictions_data
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
    
    # Create empty knockout predictions for later stages if they don't exist
    # This ensures the bracket displays correctly even without predictions for later stages
    try:
        from services.predictions.third_place_prediction_service import ThirdPlacePredictionService
        ThirdPlacePredictionService._create_empty_knockout_predictions_if_needed(db, third_place_prediction.user_id)
        print(f"✅ Created empty knockout predictions for later stages for user {third_place_prediction.user_id}")
    except Exception as e:
        # Don't fail if this errors - just log it
        print(f"⚠️ Warning: Failed to create empty knockout predictions: {e}")
    
    # Create empty knockout predictions for later stages if they don't exist
    # This ensures the bracket displays correctly even without predictions for later stages
    try:
        from services.predictions.third_place_prediction_service import ThirdPlacePredictionService
        ThirdPlacePredictionService._create_empty_knockout_predictions_if_needed(db, third_place_prediction.user_id)
        print(f"✅ Created empty knockout predictions for later stages for user {third_place_prediction.user_id}")
    except Exception as e:
        # Don't fail if this errors - just log it
        print(f"⚠️ Warning: Failed to create empty knockout predictions: {e}")
    
    return result

# ========================================
# Knockout Predictions Endpoints
# ========================================

@router.get("/predictions/knockout/all", response_model=Dict[str, Any])
def get_all_knockout_predictions(
    user_id: int = 1,
    is_draft: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Returns all 5 knockout stages in a single request.
    Response format: { stages: { round32: [...], round16: [...], ... }, knockout_score, knockout_penalty, free_changes, can_edit_drafts }
    """
    try:
        result = PredictionService.get_all_knockout_predictions(db, user_id, is_draft=is_draft)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching knockout predictions: {str(e)}")

@router.get("/predictions/knockout", response_model=Dict[str, Any])
def get_knockout_predictions(
    user_id: int = 1,  # TODO: should come from authentication
    stage: str = None,
    is_draft: bool = Query(False, description="If True, returns draft predictions instead of regular ones"),
    db: Session = Depends(get_db)
):
    """
    Get all user's knockout predictions. If stage is provided, filter by stage.
    If is_draft is True, returns draft predictions instead of regular ones.
    """
    try:
        result = PredictionService.get_knockout_predictions(db, user_id, stage, is_draft=is_draft)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching knockout predictions: {str(e)}")

@router.post("/predictions/knockout/batch", response_model=Dict[str, Any])
async def update_batch_knockout_predictions(
    request: BatchKnockoutPredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Update multiple knockout predictions at once
    """
    current_stage = StageManager.get_current_stage(db)
    if current_stage.value > Stage.ROUND32.value:
        raise HTTPException(
            status_code=403,
            detail=f"Knockout predictions are no longer editable. Current stage: {current_stage.name}"
        )
    
    # Use prediction service wrapper (routes to refactor service internally)
    result = PredictionService.update_batch_knockout_predictions(
        db, request.user_id, request.predictions, is_draft=False
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Return success even if some predictions failed, but log the errors
    if not result.get("success", False):
        # Log errors but don't fail the entire request
        print(f"Some predictions failed: {result.get('errors', [])}")
    
    return result


@router.get("/predictions/knockout/draft-changes-count")
def get_draft_changes_count(
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Count how many draft predictions differ from originals. Returns change count + penalty."""
    try:
        result = PredictionService.count_draft_changes(db, user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting changes: {str(e)}")


@router.post("/predictions/knockout/commit-drafts")
def commit_drafts(
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Commit all drafts to real predictions with penalty."""
    try:
        result = PredictionService.commit_drafts(db, user_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Cannot commit"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error committing drafts: {str(e)}")


@router.post("/predictions/knockout/reset-drafts")
def reset_drafts(
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Reset all drafts - delete and recreate from current predictions."""
    try:
        result = PredictionService.reset_drafts(db, user_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Cannot reset"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error resetting drafts: {str(e)}")


@router.put("/predictions/knockout/{prediction_id}")
def update_knockout_prediction_winner(
    prediction_id: int,
    request: UpdateKnockoutPredictionRequest,
    is_draft: bool = False,
    db: Session = Depends(get_db)
):
    """
    Update a knockout prediction - choose winner and update next stages
    """
    try:
        # Pre-checks (match existing behavior)
        prediction = DBReader.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
        
        if not prediction:
            raise HTTPException(status_code=404, detail="Knockout prediction not found")
        
        # Draft predictions are always editable; for regular predictions enforce is_editable
        if not is_draft and not getattr(prediction, 'is_editable', True):
            raise HTTPException(
                status_code=403,
                detail=f"This knockout prediction is no longer editable. Stage: {prediction.stage}"
            )

        # Use prediction service wrapper (routes to refactor service internally)
        return PredictionService.update_knockout_prediction_winner(
            db, prediction_id, request.winner_team_number, request.winner_team_name, is_draft=is_draft
        )
        
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error updating prediction: {str(e)}")


@router.post("/predictions/knockout/{prediction_id}/create-draft")
def create_draft_from_prediction(
    prediction_id: int,
    user_id: int = 1,  # TODO: should come from authentication
    db: Session = Depends(get_db)
):
    """
    Create a draft prediction by copying from existing prediction.
    Priority: result data first, then prediction data.
    """
    try:
        result = PredictionService.create_draft_from_prediction(db, user_id, prediction_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error creating draft: {str(e)}")


@router.post("/predictions/knockout/create-all-drafts")
def create_all_drafts_from_predictions(
    user_id: int = 1,  # TODO: should come from authentication
    db: Session = Depends(get_db)
):
    """
    Create draft predictions for all user's knockout predictions.
    Priority: result data first, then prediction data.
    """
    try:
        result = PredictionService.create_all_drafts_from_predictions(db, user_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Cannot create drafts"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error creating drafts: {str(e)}")


@router.delete("/predictions/knockout/delete-all-drafts")
def delete_all_drafts_for_user(
    user_id: int = 1,  # TODO: should come from authentication
    db: Session = Depends(get_db)
):
    """
    Delete all draft predictions for a specific user.
    Called when exiting edit mode.
    """
    try:
        from services.predictions import PredictionService
        result = PredictionService.delete_all_drafts_for_user(db, user_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error deleting drafts: {str(e)}")


@router.get("/knockout/bracket-reset/preview", response_model=Dict[str, Any])
def preview_bracket_reset(user_id: int, db: Session = Depends(get_db)):
    """Preview the penalty cost for a bracket reset without applying it."""
    return KnockoutService.preview_bracket_reset(db, user_id)


@router.post("/knockout/bracket-reset/apply", response_model=Dict[str, Any])
def apply_bracket_reset(user_id: int, db: Session = Depends(get_db)):
    """Apply bracket reset for the user (PRE_ROUND32 only, one-time)."""
    try:
        return KnockoutService.apply_bracket_reset(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error applying bracket reset: {str(e)}")


