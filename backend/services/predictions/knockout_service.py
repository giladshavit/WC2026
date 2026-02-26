from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Set, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from services.database import DBReader, DBWriter, DBUtils
from .shared import PredictionStatus
from services.scoring_service import ScoringService
from services.stage_manager import StageManager, Stage
from models.results import KnockoutStageResult
from models.predictions import KnockoutStagePrediction
from models.team import Team


@dataclass
class DraftFields:
    """Field values for creating a draft from a prediction."""
    team1_id: Optional[int]
    team2_id: Optional[int]
    winner_team_id: Optional[int]
    status: Optional[str]
    is_editable: bool


class KnockoutService:
    """
    Refactored knockout prediction service with simplified, cleaner logic.
    """
    # ═══════════════════════════════════════════════════════
    # CLASS CONSTANTS
    # ═══════════════════════════════════════════════════════

    THIRD_TEAM_MAPPING = {
        '3rd_team_1': 'match_1E',
        '3rd_team_2': 'match_1I',
        '3rd_team_3': 'match_1A',
        '3rd_team_4': 'match_1L',
        '3rd_team_5': 'match_1D',
        '3rd_team_6': 'match_1G',
        '3rd_team_7': 'match_1B',
        '3rd_team_8': 'match_1K'
    }

    # ═══════════════════════════════════════════════════════
    # READ Operations
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_knockout_predictions(
        db: Session,
        user_id: int,
        stage: Optional[str] = None,
        is_draft: bool = False
    ) -> Dict[str, Any]:
        """
        Get all user's knockout predictions. If stage is provided, filter by that stage.
        If is_draft is True, returns draft predictions instead of regular ones.
        """
        predictions = DBReader.get_knockout_predictions_by_user(db, user_id, stage, is_draft=is_draft)
        
        result = [
            KnockoutService._serialize_prediction(db, prediction, is_draft, user_id)
            for prediction in predictions
        ]

        knockout_score = None
        if not is_draft:
            user_scores = DBReader.get_user_scores(db, user_id)
            knockout_score = user_scores.knockout_score if user_scores else None

        stage = StageManager.get_current_stage(db)
        return {
            "predictions": result,
            "knockout_score": knockout_score,
            "can_edit_drafts": stage.can_create_knockout_drafts(),
        }

    # ═══════════════════════════════════════════════════════
    # UPDATE Operations - Single Prediction
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def update_knockout_prediction_by_id(
        db: Session,
        prediction_id: int,
        winner_team_number: int,
        winner_team_name: Optional[str] = None,
        is_draft: bool = False
    ) -> Dict[str, Any]:
        """
        Update a knockout prediction by ID using winner team number.
        
        Args:
            db: Database session
            prediction_id: ID of the prediction to update
            winner_team_number: 1 or 2 (team1 or team2)
            winner_team_name: Optional winner team name for response
        
        Returns:
            Dict with success response
        
        Raises:
            HTTPException: If prediction not found, not editable, or invalid input
        """
        # Get prediction
        prediction = DBReader.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
        if not prediction:
            raise HTTPException(status_code=404, detail="Knockout prediction not found")
        
        # Draft predictions are always editable, so only check for regular predictions
        if not is_draft and not getattr(prediction, 'is_editable', True):
            raise HTTPException(
                status_code=403,
                detail=f"This knockout prediction is no longer editable. Stage: {prediction.stage}"
            )
        
        # Get winner team ID from team number
        if winner_team_number == 1:
            winner_team_id = prediction.team1_id
        elif winner_team_number == 2:
            winner_team_id = prediction.team2_id
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid team number (must be 1 or 2)"
            )
        
        if not winner_team_id:
            raise HTTPException(
                status_code=400,
                detail="Unable to resolve winner team ID"
            )
        
        # Update prediction
        result = KnockoutService.update_knockout_prediction(
            db, prediction, winner_team_id=winner_team_id, 
            winner_team_name=winner_team_name
        )
        
        # Commit changes
        DBUtils.commit(db)
        
        return result

    @staticmethod
    def update_knockout_prediction(
        db: Session,
        prediction,
        team1_id: Optional[int] = None,
        team2_id: Optional[int] = None,
        winner_team_id: Optional[int] = None,
        winner_team_name: Optional[str] = None
    ) -> Dict[str, Any]:
        winner_team_id = winner_team_id if winner_team_id != 0 else None

        if winner_team_id is not None:
            return KnockoutService.set_winner(
                db, prediction, winner_team_id, winner_team_name
            )

        if team1_id is not None or team2_id is not None:
            resolved_team1 = team1_id if team1_id != 0 else 0
            resolved_team2 = team2_id if team2_id != 0 else 0
            KnockoutService.set_team(db, prediction, resolved_team1, resolved_team2)
            return KnockoutService._create_success_response(
                db, prediction, "Teams updated"
            )

        return {"error": "No valid update parameters provided"}

    @staticmethod
    def set_winner(
        db: Session,
        prediction,
        winner_team_id: Optional[int],
        winner_team_name: Optional[str] = None
    ) -> Dict[str, Any]:
        old_winner = prediction.winner_team_id
        resolved_winner = KnockoutService._normalize_team_id(winner_team_id)
        stored_winner = resolved_winner if resolved_winner is not None else 0

        update_kwargs: Dict[str, Any] = {"winner_team_id": stored_winner}
        if hasattr(prediction, "updated_at"):
            update_kwargs["updated_at"] = datetime.utcnow()

        DBWriter.update_knockout_prediction(db, prediction, **update_kwargs)
        DBUtils.flush(db)

        current_stage = StageManager.get_current_stage(db)
        check_reachable = current_stage.value >= Stage.PRE_ROUND32.value
        KnockoutService._compute_and_set_status(db, prediction, check_reachable=check_reachable)
        DBUtils.flush(db)

        next_prediction, position = KnockoutService._find_next_prediction_and_position(db, prediction)

        if next_prediction and position:
            if position == 1:
                KnockoutService.set_team(db, next_prediction, team1_id=stored_winner)
            else:
                KnockoutService.set_team(db, next_prediction, team2_id=stored_winner)

        changed = (old_winner != prediction.winner_team_id)
        return KnockoutService._create_success_response(
            db, prediction, "Prediction updated successfully",
            winner_team_name=winner_team_name, changed=changed
        )

    @staticmethod
    def set_team(
        db: Session,
        prediction,
        team1_id: Optional[int] = None,
        team2_id: Optional[int] = None
    ) -> None:
        update_kwargs: Dict[str, Any] = {}
        if team1_id is not None:
            update_kwargs["team1_id"] = team1_id
        if team2_id is not None:
            update_kwargs["team2_id"] = team2_id

        if not update_kwargs:
            return

        if hasattr(prediction, "updated_at"):
            update_kwargs["updated_at"] = datetime.utcnow()

        DBWriter.update_knockout_prediction(db, prediction, **update_kwargs)
        DBUtils.flush(db)

        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)
        if winner_team_id:
            current_team1 = prediction.team1_id
            current_team2 = prediction.team2_id
            if winner_team_id not in (current_team1, current_team2):
                KnockoutService.set_winner(db, prediction, winner_team_id=None)
                return

        current_stage = StageManager.get_current_stage(db)
        check_reachable = current_stage.value >= Stage.PRE_ROUND32.value
        KnockoutService._compute_and_set_status(db, prediction, check_reachable=check_reachable)
        DBUtils.flush(db)

    # ═══════════════════════════════════════════════════════
    # UPDATE Operations - Batch
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def update_batch_knockout_predictions(
        db: Session,
        user_id: int,
        predictions_data: List[Any],
        is_draft: bool = False
    ) -> Dict[str, Any]:
        """
        Update multiple knockout predictions at once with penalty calculation.
        If is_draft is True, updates draft predictions instead of regular ones.
        
        Args:
            db: Database session
            user_id: User ID (for validation if needed)
            predictions_data: List of prediction data (dicts or Pydantic models) with:
                - prediction_id: int
                - winner_team_number: int (1 or 2)
                - winner_team_name: Optional[str]
            is_draft: If True, updates draft predictions instead of regular ones
        
        Returns:
            Dict with updated_predictions, errors, totals, and success status
        """
        try:
            updated_predictions = []
            errors = []
            total_changes = 0
            
            for prediction_data in predictions_data:
                prediction_id = None
                try:
                    # Handle both dict and Pydantic model
                    if hasattr(prediction_data, 'prediction_id'):
                        prediction_id = prediction_data.prediction_id
                        winner_team_number = prediction_data.winner_team_number
                        winner_team_name = prediction_data.winner_team_name
                    else:
                        prediction_id = prediction_data.get("prediction_id")
                        winner_team_number = prediction_data.get("winner_team_number")
                        winner_team_name = prediction_data.get("winner_team_name")
                    
                    if not all([prediction_id, winner_team_number, winner_team_name]):
                        errors.append(f"Missing data for prediction {prediction_id}")
                        continue
                    
                    # Get prediction
                    prediction = DBReader.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
                    if not prediction:
                        errors.append(f"Prediction {prediction_id} not found")
                        continue
                    
                    # Get winner team ID from team number
                    if winner_team_number == 1:
                        winner_team_id = prediction.team1_id
                    elif winner_team_number == 2:
                        winner_team_id = prediction.team2_id
                    else:
                        errors.append(f"Invalid team number for prediction {prediction_id}")
                        continue
                    
                    if not winner_team_id:
                        errors.append(f"Unable to resolve winner team ID for prediction {prediction_id}")
                        continue
                    
                    # Update prediction
                    result = KnockoutService.update_knockout_prediction(
                        db, prediction, winner_team_id=winner_team_id, 
                        winner_team_name=winner_team_name
                    )
                    
                    if "error" in result:
                        errors.append(f"Error updating prediction {prediction_id}: {result['error']}")
                    else:
                        updated_predictions.append(result)
                        if result.get("changed", False):
                            total_changes += 1
                    
                except HTTPException as e:
                    pred_id_str = str(prediction_id) if prediction_id else "unknown"
                    errors.append(f"HTTP Error updating prediction {pred_id_str}: {e.detail}")
                except Exception as e:
                    pred_id_str = str(prediction_id) if prediction_id else "unknown"
                    errors.append(f"Error updating prediction {pred_id_str}: {str(e)}")
            
            # Commit all changes
            DBUtils.commit(db)
            
            # Apply penalty if there were changes
            penalty_points = 0
            if total_changes > 0:
                penalty_points = ScoringService.apply_prediction_penalty(db, user_id, total_changes)
            
            # Count how many predictions actually changed
            changed_predictions = sum(1 for pred in updated_predictions if pred.get("changed", False))
            
            return {
                "updated_predictions": updated_predictions,
                "errors": errors,
                "total_updated": len(updated_predictions),
                "total_errors": len(errors),
                "total_changes": total_changes,
                "changed_predictions": changed_predictions,
                "unchanged_predictions": len(updated_predictions) - changed_predictions,
                "penalty_points": penalty_points,
                "success": len(errors) == 0
            }
            
        except Exception as e:
            return {"error": f"Batch update failed: {str(e)}"}

    # ═══════════════════════════════════════════════════════
    # DRAFT Operations
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def create_draft_from_prediction(db: Session, user_id: int, prediction_id: int) -> Dict[str, Any]:
        """
        Create a draft prediction by copying from existing prediction.
        Priority: result data first (teams, winner if exists), otherwise copy prediction as-is.
        Status is always copied from the original prediction.
        """
        prediction = DBReader.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        KnockoutService._delete_existing_draft_if_any(db, user_id, prediction.template_match_id)

        draft_fields = KnockoutService._build_draft_fields(db, prediction)

        draft = DBWriter.create_knockout_prediction(
            db,
            user_id=user_id,
            knockout_result_id=prediction.knockout_result_id or 0,
            template_match_id=prediction.template_match_id,
            stage=prediction.stage,
            team1_id=draft_fields.team1_id,
            team2_id=draft_fields.team2_id,
            winner_team_id=draft_fields.winner_team_id,
            is_draft=True,
            knockout_pred_id=prediction.id,
            status=draft_fields.status,
        )

        DBUtils.commit(db)
        return {
            "success": True,
            "message": "Draft created",
            "draft_id": draft.id,
        }

    @staticmethod
    def create_all_drafts_from_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Create drafts for all user's knockout predictions.
        Simple copy: use result teams (and winner if present), otherwise copy prediction data.
        Status is copied as-is from the original prediction.
        """
        # Pre-check: can we create drafts right now?
        can_create, reason = StageManager.can_create_knockout_drafts(db)
        if not can_create:
            return {"success": False, "message": reason, "created": 0}

        # Clean slate - delete existing drafts before creating new ones
        KnockoutService.delete_all_drafts_for_user(db, user_id)

        # Create drafts for all predictions (keep existing loop logic)
        predictions = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)
        created = 0
        for prediction in predictions:
            result = KnockoutService.create_draft_from_prediction(db, user_id, prediction.id)
            if result.get("success"):
                created += 1

        return {
            "success": True,
            "message": f"Created {created} drafts",
            "created": created
        }

    @staticmethod
    def delete_all_drafts_for_user(db: Session, user_id: int) -> Dict[str, Any]:
        """Delete all draft predictions for a given user."""
        drafts = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)
        deleted = 0
        for draft in drafts:
            DBWriter.delete_knockout_prediction(db, draft)
            deleted += 1
        DBUtils.commit(db)
        return {"success": True, "deleted": deleted}

    @staticmethod
    def count_draft_changes(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Count how many draft predictions have a different winner than the original.
        Used for: displaying expected penalty in UI, and during commit.

        A change is counted ONLY when:
          - draft.winner_team_id != original.winner_team_id
          - AND draft.winner_team_id is not None/0

        Why the second condition? When cascade clears a winner in a later stage
        (sets it to None because the team was removed), that's not a user action —
        the user didn't actively change that prediction. No penalty for that.

        Normalize: treat 0 and None as equivalent (both mean no winner).
        """
        drafts = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)

        if not drafts:
            return {"changes_count": 0, "penalty_per_change": 0, "total_penalty": 0}

        changes_count = 0

        for draft in drafts:
            original = DBReader.get_knockout_prediction_by_id(db, draft.knockout_pred_id, is_draft=False)
            if not original:
                continue

            # Normalize: 0 and None both mean "no winner"
            draft_winner = draft.winner_team_id if draft.winner_team_id else None
            original_winner = original.winner_team_id if original.winner_team_id else None

            # Count as change only if different AND draft has an actual winner
            # (cascade clearing a winner to None is not a user change)
            if draft_winner != original_winner and draft_winner is not None:
                changes_count += 1

        stage = StageManager.get_current_stage(db)
        penalty_per_change = stage.get_penalty_for()

        return {
            "changes_count": changes_count,
            "penalty_per_change": penalty_per_change,
            "total_penalty": changes_count * penalty_per_change,
        }

    @staticmethod
    def _copy_draft_to_prediction(db: Session, draft, original) -> None:
        """
        Copy all relevant fields from draft to original prediction.
        Simple "stupid copy" — the draft already has correct data from cascade.
        Uses direct assignment to support None values (e.g. cascade-cleared winners).
        """
        original.team1_id = draft.team1_id
        original.team2_id = draft.team2_id
        original.winner_team_id = draft.winner_team_id
        original.status = draft.status
        db.flush()

    @staticmethod
    def commit_drafts(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Commit all user drafts to their real predictions.

        1. Copy each draft's fields to its original prediction (stupid copy)
        2. Count changes using count_draft_changes
        3. Apply penalty based on change count
        4. Delete all drafts

        No cascade needed — the drafts already have correct data from editing.
        No sorting needed — it's just a field copy.
        """
        # Pre-check
        can_create, reason = StageManager.can_create_knockout_drafts(db)
        if not can_create:
            return {"success": False, "message": reason}

        # Get all drafts
        drafts = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)

        if not drafts:
            return {"success": True, "message": "No drafts to commit", "changes_count": 0, "penalty_applied": 0}

        # Count changes BEFORE copying (compare draft vs original)
        count_result = KnockoutService.count_draft_changes(db, user_id)
        changes_count = count_result["changes_count"]

        # Copy each draft to its original prediction
        for draft in drafts:
            original = DBReader.get_knockout_prediction_by_id(db, draft.knockout_pred_id, is_draft=False)
            if not original:
                continue
            KnockoutService._copy_draft_to_prediction(db, draft, original)

        DBUtils.flush(db)

        # Apply penalty
        penalty_applied = 0
        if changes_count > 0:
            penalty_applied = ScoringService.apply_prediction_penalty(db, user_id, changes_count)

        # Delete all drafts
        KnockoutService.delete_all_drafts_for_user(db, user_id)

        DBUtils.commit(db)

        return {
            "success": True,
            "changes_count": changes_count,
            "penalty_applied": penalty_applied,
        }

    @staticmethod
    def reset_drafts(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Reset all drafts by deleting and recreating from current predictions.
        """
        KnockoutService.delete_all_drafts_for_user(db, user_id)
        result = KnockoutService.create_all_drafts_from_predictions(db, user_id)
        return {
            "success": result.get("success", False),
            "message": "Drafts reset",
            "created": result.get("created", 0),
        }

    # ═══════════════════════════════════════════════════════
    # SETUP (User Registration)
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def create_user_knockout_predictions(db: Session, user_id: int) -> List[KnockoutStagePrediction]:
        """
        Create 63 empty knockout predictions for a newly registered user.
        One prediction per knockout MatchTemplate.
        
        Args:
            db: Database session
            user_id: The newly registered user's ID
        
        Returns:
            List of created KnockoutStagePrediction objects
        """
        templates = DBReader.get_all_knockout_templates(db)
        created: List[KnockoutStagePrediction] = []

        for template in templates:
            existing_prediction = DBReader.get_knockout_prediction(
                db, user_id, template.id, is_draft=False
            )
            if existing_prediction:
                continue

            knockout_result_id = template.knockout_result_id
            if not knockout_result_id:
                result = DBReader.get_knockout_result(db, template.id)
                knockout_result_id = result.id if result else None

            if not knockout_result_id:
                print(f"Warning: No knockout result for template {template.id}")
                continue

            prediction = DBWriter.create_knockout_prediction(
                db,
                user_id,
                knockout_result_id,
                template.id,
                template.stage,
                is_draft=False,
                team1_id=None,
                team2_id=None,
                winner_team_id=None,
                is_editable=True
            )
            current_stage = StageManager.get_current_stage(db)
            check_reachable = current_stage.value >= Stage.PRE_ROUND32.value
            KnockoutService._compute_and_set_status(db, prediction, check_reachable=check_reachable)
            created.append(prediction)

        DBUtils.flush(db)
        return created

    # ═══════════════════════════════════════════════════════
    # VALIDITY & STATUS
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def initialize_all_knockout_statuses(db: Session) -> None:
        """
        Initialize/recalculate status for all knockout predictions using reachable logic.
        Iterates over all predictions per user, skips post-result statuses (CORRECT_FULL,
        CORRECT_PARTIAL, INCORRECT), calls _compute_and_set_status with check_reachable=True.
        Called after admin operations that affect the bracket (entering results, rebuilding).
        Uses check_reachable=True because this runs only after group results exist.
        """
        predictions = DBReader.get_all_knockout_predictions(db)
        for prediction in predictions:
            KnockoutService._compute_and_set_status(db, prediction, check_reachable=True)
        DBUtils.flush(db)

    @staticmethod
    def can_winner_reach_match_via_correct_path(db: Session, prediction) -> bool:
        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)
        if not winner_team_id:
            return False
        return KnockoutService._is_winner_reachable_recursive(
            db, prediction.template_match_id, winner_team_id
        )

    # ═══════════════════════════════════════════════════════
    # RESULT PROCESSING (post-match status and scoring)
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def process_knockout_match_result(
        db: Session,
        match_id: int,
        winner_team_id: int,
        loser_team_id: int
    ) -> None:
        """
        Called from ResultsService after updating result and placing winner in next stage.
        Handles status updates and scoring for all users.
        """
        predictions = DBReader.get_knockout_predictions_by_match(db, match_id)
        template = DBReader.get_match_template(db, match_id)
        if not template:
            return
        stage = template.stage

        # Mark loser as eliminated (once, before processing predictions)
        loser_team = DBReader.get_team(db, loser_team_id)
        if loser_team:
            DBWriter.update_team_eliminated(db, loser_team, True)
            DBUtils.flush(db)

        for prediction in predictions:
            user_id = prediction.user_id

            # Case 0: Empty prediction or INVALID status
            if not KnockoutService._normalize_team_id(prediction.winner_team_id):
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    PredictionStatus.INCORRECT.value, 0
                )
                continue
            if prediction.status == PredictionStatus.INVALID.value:
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    PredictionStatus.INCORRECT.value, 0
                )
                continue

            # Part A: Handle winner (CORRECT_FULL or CORRECT_PARTIAL)
            handled = KnockoutService._handle_winner(
                db, prediction, user_id, winner_team_id, stage
            )
            if handled:
                continue

            # Part B: Handle loser (INCORRECT)
            KnockoutService._handle_loser(
                db, prediction, user_id, match_id, loser_team_id, stage
            )

        DBUtils.flush(db)

    @staticmethod
    def _handle_winner(
        db: Session,
        prediction,
        user_id: int,
        winner_team_id: int,
        stage: str
    ) -> bool:
        """
        Part A — Handle winner. Returns True if prediction was handled.
        """
        # Direct check: did user predict the winner for THIS match?
        if KnockoutService._normalize_team_id(prediction.winner_team_id) == winner_team_id:
            points = ScoringService.KNOCKOUT_SCORING.get(stage, {}).get("full", 0)
            KnockoutService._set_prediction_status_and_points(
                db, prediction, user_id,
                PredictionStatus.CORRECT_FULL.value, points
            )
            return True

        # Direct prediction was wrong — search same stage for UNREACHABLE with winner
        same_stage_predictions = DBReader.get_knockout_predictions_by_user(
            db, user_id, stage=stage, is_draft=False
        )
        for other_pred in same_stage_predictions:
            if other_pred.id == prediction.id:
                continue
            if (other_pred.status == PredictionStatus.UNREACHABLE.value and
                    KnockoutService._normalize_team_id(other_pred.winner_team_id) == winner_team_id):
                # Current prediction was wrong (for this match), set INCORRECT
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    PredictionStatus.INCORRECT.value, 0
                )
                # Other prediction had correct winner via different path -> CORRECT_PARTIAL
                points = ScoringService.KNOCKOUT_SCORING.get(stage, {}).get("partial", 0)
                KnockoutService._set_prediction_status_and_points(
                    db, other_pred, user_id,
                    PredictionStatus.CORRECT_PARTIAL.value, points
                )
                return True

        return False

    @staticmethod
    def _handle_loser(
        db: Session,
        prediction,
        user_id: int,
        match_id: int,
        loser_team_id: int,
        stage: str
    ) -> None:
        """
        Part B — Handle loser. Set INCORRECT, find loser in next stages.
        (Loser is already marked eliminated in process_knockout_match_result.)
        """
        # Direct check: did user predict the loser for THIS match?
        if KnockoutService._normalize_team_id(prediction.winner_team_id) == loser_team_id:
            KnockoutService._set_prediction_status_and_points(
                db, prediction, user_id,
                PredictionStatus.INCORRECT.value, 0
            )
            KnockoutService._find_loser_in_next_stages(
                db, user_id, loser_team_id, match_id
            )
            return

        # Direct prediction != loser — current prediction is still wrong (INCORRECT)
        KnockoutService._set_prediction_status_and_points(
            db, prediction, user_id,
            PredictionStatus.INCORRECT.value, 0
        )
        # Search same stage for other predictions that predicted the loser
        same_stage_predictions = DBReader.get_knockout_predictions_by_user(
            db, user_id, stage=stage, is_draft=False
        )
        for other_pred in same_stage_predictions:
            if other_pred.id == prediction.id:
                continue
            if KnockoutService._normalize_team_id(other_pred.winner_team_id) == loser_team_id:
                KnockoutService._set_prediction_status_and_points(
                    db, other_pred, user_id,
                    PredictionStatus.INCORRECT.value, 0
                )
                KnockoutService._find_loser_in_next_stages(
                    db, user_id, loser_team_id, other_pred.template_match_id
                )

    @staticmethod
    def _find_loser_in_next_stages(
        db: Session,
        user_id: int,
        loser_team_id: int,
        source_match_id: int
    ) -> None:
        """
        Recursively walk forward in the prediction chain, looking for the loser.
        If found as winner → set INVALID, continue recursion.
        If not found → stop.
        """
        prediction = DBReader.get_knockout_prediction(
            db, user_id, source_match_id, is_draft=False
        )
        if not prediction:
            return

        next_prediction, position = KnockoutService._find_next_prediction_and_position(
            db, prediction
        )
        if not next_prediction:
            return  # No next stage / reached final

        if KnockoutService._normalize_team_id(next_prediction.winner_team_id) == loser_team_id:
            KnockoutService._set_prediction_status_and_points(
                db, next_prediction, user_id,
                PredictionStatus.INVALID.value, 0
            )
            KnockoutService._find_loser_in_next_stages(
                db, user_id, loser_team_id, next_prediction.template_match_id
            )

    @staticmethod
    def _set_prediction_status_and_points(
        db: Session,
        prediction,
        user_id: int,
        status: str,
        points: int
    ) -> None:
        """Set prediction status and points, update user knockout score."""
        old_points = prediction.points if prediction.points is not None else 0
        DBWriter.set_prediction_status(prediction, status)
        DBWriter.update_knockout_prediction(db, prediction, points=points)
        DBUtils.flush(db)

        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)
        new_knockout_score = (user_scores.knockout_score or 0) - old_points + points
        new_total_points = (
            (user_scores.matches_score or 0) +
            (user_scores.groups_score or 0) +
            (user_scores.third_place_score or 0) +
            new_knockout_score -
            (user_scores.penalty or 0)
        )
        DBWriter.update_user_scores(
            db, user_scores,
            knockout_score=new_knockout_score,
            total_points=new_total_points
        )
        DBUtils.flush(db)

    # ═══════════════════════════════════════════════════════
    # THIRD PLACE Integration
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def update_knockout_predictions_by_new_third_places_qualified(
        db: Session, 
        user_id: int, 
        advancing_team_ids: List[int]
    ):
        """
        Update knockout predictions when third place teams change.
        This updates Round of 32 predictions where team2 comes from third-place teams.
        """
        hash_key = KnockoutService._create_new_hash_key(db, advancing_team_ids)
        
        combination = DBReader.get_third_place_combination_by_hash(db, hash_key)
        if not combination:
            return
        
        templates = KnockoutService._get_third_place_relevant_templates(db)

        for template in templates:
            KnockoutService._update_single_third_place_prediction(
                db, user_id, template, combination
            )
        
        # Commit all changes at the end
        DBUtils.commit(db)

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Serialization
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _serialize_prediction(
        db: Session, 
        prediction, 
        is_draft: bool,
        user_id: int
    ) -> Dict[str, Any]:
        """Convert a single prediction object to API response dict."""
        # 1. Prepare teams (handle draft mode)
        team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team = (
            KnockoutService._prepare_draft_mode_teams(db, prediction, is_draft)
        )

        # 2. Build base item dict
        item = KnockoutService._build_prediction_item(
            prediction, team1_id, team2_id, winner_team_id, 
            team1, team2, winner_team, current_winner_team
        )

        # 3. Get knockout result
        knockout_result = (
            DBReader.get_knockout_result_by_id(db, prediction.knockout_result_id)
            if prediction.knockout_result_id else None
        )
        
        # 4. Validity from DB
        item["team1_is_valid"] = getattr(prediction, "is_team1_valid", True)
        item["team2_is_valid"] = getattr(prediction, "is_team2_valid", True)
        
        # 5. Correctness check
        if knockout_result and knockout_result.winner_team_id:
            item["is_correct"] = (prediction.winner_team_id == knockout_result.winner_team_id)

        # 6. Mode-specific fields
        KnockoutService._add_additional_fields_to_item(item, prediction, is_draft)

        return item

    @staticmethod
    def _prepare_draft_mode_teams(db: Session, prediction, is_draft: bool) -> tuple:
        """
        Prepare team data for draft mode. Returns (team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team).
        In draft mode, prioritizes result teams if they exist, otherwise uses draft teams directly.
        """
        # Default to prediction data
        team1_id = prediction.team1_id
        team2_id = prediction.team2_id
        winner_team_id = prediction.winner_team_id
        team1 = prediction.team1
        team2 = prediction.team2
        winner_team = prediction.winner_team
        current_winner_team = None

        if not is_draft:
            return (team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team)

        # Get current winner team for draft mode (to show the flag of current winner)
        current_winner_team_id = prediction.current_winner_team_id if hasattr(prediction, 'current_winner_team_id') else None
        current_winner_team = DBReader.get_team(db, current_winner_team_id) if current_winner_team_id else None
        
        # In draft mode, prioritize result teams if they exist
        # Otherwise, use draft teams directly (they may have been cleaned)
        knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
        
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            # Result exists - use result teams (show actual teams that will play)
            team1_id = knockout_result.team_1
            team1 = knockout_result.team_1_obj
            team2_id = knockout_result.team_2
            team2 = knockout_result.team_2_obj
            # Keep the winner from the user's original prediction (set above)
        else:
            # No result - use draft teams directly (they may have been cleaned)
            # Load teams by ID directly to ensure we get the correct cleaned teams
            team1 = DBReader.get_team(db, team1_id) if team1_id else None
            team2 = DBReader.get_team(db, team2_id) if team2_id else None
            winner_team = DBReader.get_team(db, winner_team_id) if winner_team_id else None

        return (team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team)

    @staticmethod
    def _build_prediction_item(
        prediction,
        team1_id: Optional[int],
        team2_id: Optional[int],
        winner_team_id: Optional[int],
        team1,
        team2,
        winner_team,
        current_winner_team
    ) -> Dict[str, Any]:
        """Build the base prediction item dictionary with all team information."""
        return {
            "id": prediction.id,
            "user_id": prediction.user_id,
            "knockout_result_id": prediction.knockout_result_id,
            "template_match_id": prediction.template_match_id,
            "stage": prediction.stage,
            "team1_id": team1_id,
            "team2_id": team2_id,
            "winner_team_id": winner_team_id,
            "status": prediction.status,
            "team1_name": team1.name if team1 else None,
            "team2_name": team2.name if team2 else None,
            "winner_team_name": winner_team.name if winner_team else None,
            "team1_short_name": team1.short_name if team1 else None,
            "team2_short_name": team2.short_name if team2 else None,
            "winner_team_short_name": winner_team.short_name if winner_team else None,
            "team1_flag": team1.flag_url if team1 else None,
            "team2_flag": team2.flag_url if team2 else None,
            "winner_team_flag": (current_winner_team.flag_url if current_winner_team else None),
            "team1_is_eliminated": team1.is_eliminated if team1 else False,
            "team2_is_eliminated": team2.is_eliminated if team2 else False,
        }

    @staticmethod
    def _add_additional_fields_to_item(item: Dict[str, Any], prediction, is_draft: bool) -> None:
        """Add additional fields to item based on is_draft flag."""
        if not is_draft:
            item["points"] = prediction.points
            item["is_editable"] = prediction.is_editable
            item["created_at"] = prediction.created_at
            item["updated_at"] = prediction.updated_at
        else:
            item["knockout_pred_id"] = prediction.knockout_pred_id

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Draft Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _delete_existing_draft_if_any(db: Session, user_id: int, template_match_id: int) -> None:
        """Delete existing draft for this match if it exists."""
        existing_draft = DBReader.get_knockout_prediction(
            db, user_id, template_match_id, is_draft=True
        )
        if existing_draft:
            DBWriter.delete_knockout_prediction(db, existing_draft)
            DBUtils.flush(db)

    @staticmethod
    def _nullify_if_eliminated(db: Session, team_id: Optional[int]) -> Optional[int]:
        """Return None if team is eliminated or doesn't exist, otherwise return team_id."""
        if not team_id:
            return None
        team = DBReader.get_team(db, team_id)
        if not team or team.is_eliminated:
            return None
        return team_id

    @staticmethod
    def _build_draft_fields(db: Session, prediction) -> DraftFields:
        """
        Build field values for a new draft based on prediction + knockout result.

        3 cases:
          A: Result with winner    -> teams+winner from result, NOT editable
          B: Result with teams only -> teams from result, winner from prediction, editable
          C: No result             -> everything from prediction (null if eliminated), editable

        Status is always copied from prediction.
        """
        knockout_result = None
        if prediction.knockout_result_id:
            knockout_result = DBReader.get_knockout_result_by_id(db, prediction.knockout_result_id)

        has_result_teams = (
            knockout_result
            and knockout_result.team_1
            and knockout_result.team_2
        )
        has_result_winner = (
            has_result_teams
            and knockout_result.winner_team_id
        )
        status = prediction.status

        # Case A: result is complete (has winner)
        if has_result_winner:
            return DraftFields(
                team1_id=knockout_result.team_1,
                team2_id=knockout_result.team_2,
                winner_team_id=knockout_result.winner_team_id,
                status=status,
                is_editable=False,
            )

        # Case B: result has teams but no winner yet
        if has_result_teams:
            return DraftFields(
                team1_id=knockout_result.team_1,
                team2_id=knockout_result.team_2,
                winner_team_id=KnockoutService._nullify_if_eliminated(db, prediction.winner_team_id),
                status=status,
                is_editable=True,
            )

        # Case C: no result at all - simple copy, nullify eliminated
        return DraftFields(
            team1_id=KnockoutService._nullify_if_eliminated(db, prediction.team1_id),
            team2_id=KnockoutService._nullify_if_eliminated(db, prediction.team2_id),
            winner_team_id=KnockoutService._nullify_if_eliminated(db, prediction.winner_team_id),
            status=status,
            is_editable=True,
        )

    @staticmethod
    def _resolve_draft_teams(db: Session, prediction) -> Tuple[int, int, int, int]:
        """
        DEPRECATED: Use _build_draft_fields() instead. Will be removed in future cleanup.

        Resolve team IDs for a draft based on prediction and result data.
        Priority: result teams first, then prediction teams (cleaned by validity).
        
        Returns: (team1_id, team2_id, winner_team_id, current_winner_team_id)
        """
        # Do not recompute validity in draft creation; validity computed in get_knockout_predictions
        knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
        
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            # Result exists - use result teams
            team1_id = knockout_result.team_1
            team2_id = knockout_result.team_2
            # Winner: prefer result winner if exists; otherwise keep user's winner
            winner_team_id = knockout_result.winner_team_id if getattr(knockout_result, 'winner_team_id', None) else prediction.winner_team_id
            # If result exists, don't set current_winner_team_id (don't show winner flag)
            current_winner_team_id = 0
        else:
            # No result - check validity and clean invalid teams using is_team1_valid/is_team2_valid fields
            team1_id = prediction.team1_id if prediction.is_team1_valid else 0
            team2_id = prediction.team2_id if prediction.is_team2_valid else 0
            original_winner_team_id = prediction.winner_team_id or 0  # Save original winner before cleaning
            normalized_status = KnockoutService._coerce_status(prediction.status)

            # Set current_winner_team_id if status is yellow and winner differs from the draft teams
            current_winner_team_id = 0
            if normalized_status == PredictionStatus.UNREACHABLE.value and original_winner_team_id:
                if original_winner_team_id != team1_id and original_winner_team_id != team2_id:
                    current_winner_team_id = original_winner_team_id

            # Winner in draft: keep original winner only if it matches one of the remaining teams, else 0
            winner_team_id = original_winner_team_id if original_winner_team_id in (team1_id, team2_id) else 0
        
        return team1_id, team2_id, winner_team_id, current_winner_team_id

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Status & Validity
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _compute_and_set_status(
        db: Session,
        prediction,
        check_reachable: bool = False
    ) -> Optional[PredictionStatus]:
        """
        Compute and set the prediction status based on current state.
        If status is already post-result (CORRECT_FULL/CORRECT_PARTIAL/INCORRECT), return immediately.
        Otherwise delegate to _compute_status_pre_result.
        Returns the status that was set, or None if undetermined.
        """
        current_status = prediction.status
        post_result_statuses = {
            PredictionStatus.CORRECT_FULL.value,
            PredictionStatus.CORRECT_PARTIAL.value,
            PredictionStatus.INCORRECT.value,
        }
        if current_status in post_result_statuses:
            return None  # Don't touch post-result statuses

        return KnockoutService._compute_status_pre_result(db, prediction, check_reachable)

    @staticmethod
    def _compute_status_pre_result(
        db: Session,
        prediction,
        check_reachable: bool
    ) -> PredictionStatus:
        """
        Compute status when match has NOT been played yet (no result).
        
        Possible outcomes:
        - INVALID: No prediction OR predicted team is eliminated
        - UNREACHABLE: Predicted team can't reach this match (yellow)
        - VALID: Prediction is valid and reachable (green)
        """
        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)

        # Case 1: No prediction yet
        if not winner_team_id:
            status = PredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Case 2: Predicted team is eliminated
        winner_team = DBReader.get_team(db, winner_team_id)
        if winner_team and winner_team.is_eliminated:
            status = PredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Case 3: Check reachability if requested
        if check_reachable:
            if not KnockoutService.can_winner_reach_match_via_correct_path(db, prediction):
                status = PredictionStatus.UNREACHABLE
                DBWriter.set_prediction_status(prediction, status.value)
                return status

        # Case 4: Valid prediction
        status = PredictionStatus.VALID
        DBWriter.set_prediction_status(prediction, status.value)
        return status

    @staticmethod
    def _coerce_status(status: Optional[str]) -> Optional[str]:
        if not status:
            return None
        legacy_map = {
            "predicted": PredictionStatus.VALID.value,
            "might_change_predict": PredictionStatus.UNREACHABLE.value,
            "must_change_predict": PredictionStatus.INVALID.value,
            "gray": PredictionStatus.INVALID.value,
        }
        if status in legacy_map:
            return legacy_map[status]
        try:
            return PredictionStatus(status).value
        except ValueError:
            return status

    @staticmethod
    def _is_winner_reachable_recursive(
        db: Session,
        match_id: int,
        winner_team_id: int,
        visited: Optional[Set[int]] = None
    ) -> bool:
        if visited is None:
            visited = set()

        if match_id in visited:
            return False
        visited.add(match_id)

        template = DBReader.get_match_template(db, match_id)
        if not template:
            return False

        knockout_result = DBReader.get_knockout_result(db, match_id)
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            return winner_team_id in {knockout_result.team_1, knockout_result.team_2}

        if template.stage == "round32":
            return True

        source_match_1_id = KnockoutService._extract_match_id_from_winner_string(template.team_1)
        source_match_2_id = KnockoutService._extract_match_id_from_winner_string(template.team_2)

        return (
            (source_match_1_id and KnockoutService._is_winner_reachable_recursive(
                db, source_match_1_id, winner_team_id, visited.copy()
            )) or
            (source_match_2_id and KnockoutService._is_winner_reachable_recursive(
                db, source_match_2_id, winner_team_id, visited.copy()
            ))
        )


    # ═══════════════════════════════════════════════════════
    # PRIVATE - Navigation & Propagation
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _find_next_prediction_and_position(
        db: Session,
        prediction
    ) -> tuple:
        """
        Find the next prediction in the knockout chain and its position.
        Returns: tuple (next_prediction, position) or (None, None) if not found
        """
        # Determine if current prediction is a draft (check if it has knockout_pred_id field)
        is_draft = hasattr(prediction, 'knockout_pred_id')
        
        # Find the template of the current prediction
        current_template = DBReader.get_match_template(
            db, prediction.template_match_id
        )
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No next stage
        
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        # Find the next prediction (use same draft status as current prediction)
        next_prediction = DBReader.get_knockout_prediction(
            db, prediction.user_id, next_match_id, is_draft=is_draft
        )
        
        return next_prediction, position

    @staticmethod
    def _create_success_response(
        db: Session, 
        prediction, 
        message: str, 
        winner_team_name: Optional[str] = None,
        changed: bool = True
    ) -> Dict[str, Any]:
        """Creates success response"""
        # Find winner team name
        if not winner_team_name and prediction.winner_team_id:
            winner_team = DBReader.get_team(db, prediction.winner_team_id)
            winner_team_name = winner_team.name if winner_team else None
        
        response = {
            "success": True,
            "changed": changed,
            "message": message,
            "prediction": {
                "id": prediction.id,
                "winner_team_id": prediction.winner_team_id,
                "winner_team_name": winner_team_name
            }
        }
        
        # Only add updated_at if it exists (not for draft predictions)
        if hasattr(prediction, 'updated_at'):
            response["prediction"]["updated_at"] = prediction.updated_at.isoformat() if prediction.updated_at else None
        
        return response

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Third Place Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_third_place_relevant_templates(db: Session) -> List:
        """Get Round of 32 templates where team_2 uses third-place source."""
        templates = DBReader.get_match_templates_by_stage(db, 'round32')
        return [t for t in templates if t.team_2 and t.team_2.startswith('3rd_team_')]

    @staticmethod
    def _resolve_third_place_team(db: Session, team_source: str, combination, user_id: int) -> Optional[Team]:
        """Resolve which team fills a third-place slot based on the combination table."""
        column_name = KnockoutService.THIRD_TEAM_MAPPING.get(team_source)
        if not column_name:
            return None
        
        third_place_source = getattr(combination, column_name, None)
        if not third_place_source:
            return None
        
        group_letter = third_place_source[1]
        group = DBReader.get_group_by_name(db, group_letter)
        if not group:
            return None

        group_pred = DBReader.get_group_prediction(db, user_id, group.id)
        if not group_pred:
            return None

        return DBReader.get_team(db, group_pred.third_place)

    @staticmethod
    def _update_single_third_place_prediction(
        db: Session, user_id: int, template, combination
    ) -> None:
        """Update a single Round of 32 prediction's team2 from third-place data."""
        prediction = DBReader.get_knockout_prediction(
            db, user_id, template.id, is_draft=False
        )
        if not prediction:
            return

        new_team = KnockoutService._resolve_third_place_team(
            db, template.team_2, combination, user_id
        )
        new_team2_id = new_team.id if new_team else None
        if not new_team2_id or prediction.team2_id == new_team2_id:
            return

        KnockoutService.update_knockout_prediction(db, prediction, team2_id=new_team2_id)

    @staticmethod
    def _create_new_hash_key(db: Session, advancing_team_ids: List[int]) -> str:
        """Create hash key from advancing team IDs"""
        letters = []
        for team_id in advancing_team_ids:
            team = DBReader.get_team(db, team_id)
            if team and team.group_letter:
                letters.append(team.group_letter)
        
        hash_key = ''.join(sorted(letters))
        return hash_key

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Utilities
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _extract_match_id_from_winner_string(team_source: str) -> Optional[int]:
        """
        Extracts match ID from string like 'Winner_M73' -> 73
        Returns None if not a winner string
        """
        if team_source.startswith('Winner_M'):
            try:
                return int(team_source.split('_')[1][1:])  # 'Winner_M73' -> 'M73' -> '73' -> 73
            except (IndexError, ValueError):
                return None
        return None


    @staticmethod
    def _normalize_team_id(team_id: Optional[int]) -> Optional[int]:
        return None if team_id in (None, 0) else team_id

    @staticmethod
    def _is_empty_team_id(team_id: Optional[int]) -> bool:
        return team_id in (None, 0)
