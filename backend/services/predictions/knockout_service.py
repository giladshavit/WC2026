from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Set, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from services.database import DBReader, DBWriter, DBUtils
from .enums import KnockoutPredictionStatus, PredictionType
from services.scoring_service import ScoringService
from services.stage_manager import StageManager, Stage
from models.results import KnockoutStageResult
from models.predictions import KnockoutStagePrediction
from models.team import Team
from models.matches_template import MatchTemplate


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
        knockout_penalty = 0
        free_changes = 0
        user_scores = DBReader.get_user_scores(db, user_id)
        if user_scores:
            if not is_draft:
                knockout_score = user_scores.knockout_score
                knockout_penalty = user_scores.knockout_penalty or 0
            free_changes = getattr(user_scores, 'free_changes', 0) or 0

        stage = StageManager.get_current_stage(db)
        return {
            "predictions": result,
            "knockout_score": knockout_score,
            "knockout_penalty": knockout_penalty,
            "free_changes": free_changes,
            "can_edit_drafts": stage.can_create_knockout_drafts(),
        }

    # ═══════════════════════════════════════════════════════
    # BRACKET RESET
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def preview_bracket_reset(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Calculate the penalty cost for a bracket reset WITHOUT applying it.
        Counts all user's knockout predictions (non-draft) and returns:
        - invalid_count: predictions with status == 'invalid'
        - unreachable_count: predictions with status == 'unreachable'
        - penalty: invalid_count + (unreachable_count // 2)
        - has_used_reset: user_scores.has_used_bracket_reset
        """
        predictions = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)

        invalid_count = sum(1 for p in predictions if p.status == KnockoutPredictionStatus.INVALID.value)
        unreachable_count = sum(1 for p in predictions if p.status == KnockoutPredictionStatus.UNREACHABLE.value)
        penalty = invalid_count + (unreachable_count // 2)

        user_scores = DBReader.get_user_scores(db, user_id)
        has_used_reset = user_scores.has_used_bracket_reset if user_scores else False

        return {
            "invalid_count": invalid_count,
            "unreachable_count": unreachable_count,
            "penalty": penalty,
            "has_used_reset": has_used_reset,
        }

    @staticmethod
    def apply_bracket_reset(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Perform the bracket reset for user_id.

        GUARD CHECKS (raise HTTPException if fails):
        1. Stage must be PRE_ROUND32 exactly
        2. user_scores.has_used_bracket_reset must be False

        RESET LOGIC:
        For every KnockoutStagePrediction (non-draft) of this user:
          - If stage == 'round32': team1_id/team2_id from knockout result, winner=None, status='invalid', points=0, is_editable=True
          - Other stages: team1_id=team2_id=winner=None, status='invalid', points=0, is_editable=True

        Then apply penalty directly to UserScores (no ScoringService), set has_used_bracket_reset=True.
        """
        # GUARD: Stage must be PRE_ROUND32
        current_stage = StageManager.get_current_stage(db)
        if current_stage != Stage.PRE_ROUND32:
            raise HTTPException(
                status_code=400,
                detail=f"Bracket reset is only allowed during PRE_ROUND32. Current stage: {current_stage.name}"
            )

        # GUARD: has_used_bracket_reset must be False
        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)
        if user_scores.has_used_bracket_reset:
            raise HTTPException(
                status_code=400,
                detail="Bracket reset has already been used"
            )

        # Count statuses BEFORE resetting predictions
        predictions_before = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)
        invalid_count = sum(1 for p in predictions_before if p.status == KnockoutPredictionStatus.INVALID.value)
        unreachable_count = sum(1 for p in predictions_before if p.status == KnockoutPredictionStatus.UNREACHABLE.value)
        penalty = invalid_count + (unreachable_count // 2)

        # Reset all predictions
        predictions_to_reset = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)
        for prediction in predictions_to_reset:
            if prediction.stage == 'round32':
                knockout_result = DBReader.get_knockout_result_by_id(db, prediction.knockout_result_id) if prediction.knockout_result_id else None
                team1 = knockout_result.team_1 if knockout_result else None
                team2 = knockout_result.team_2 if knockout_result else None
                DBWriter.update_knockout_prediction(
                    db, prediction,
                    team1_id=team1,
                    team2_id=team2,
                    winner_team_id=None,
                    status=KnockoutPredictionStatus.INVALID.value,
                    points=0,
                    is_editable=True,
                )
            else:
                DBWriter.update_knockout_prediction(
                    db, prediction,
                    team1_id=None,
                    team2_id=None,
                    winner_team_id=None,
                    status=KnockoutPredictionStatus.INVALID.value,
                    points=0,
                    is_editable=True,
                )

        # Apply penalty DIRECTLY to UserScores — no helpers, no recalculation
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)
        new_penalty = (user_scores.penalty or 0) + penalty
        new_knockout_penalty = (user_scores.knockout_penalty or 0) + penalty
        new_total_points = (user_scores.total_points or 0) - penalty

        DBWriter.update_user_scores(
            db,
            user_scores,
            penalty=new_penalty,
            knockout_penalty=new_knockout_penalty,
            total_points=new_total_points,
            has_used_bracket_reset=True,
        )

        DBUtils.commit(db)

        return {
            "success": True,
            "penalty_applied": penalty,
            "invalid_count": invalid_count,
            "unreachable_count": unreachable_count,
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
            winner_team_name=winner_team_name,
            is_draft=is_draft
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
        winner_team_name: Optional[str] = None,
        is_draft: bool = False,
    ) -> Dict[str, Any]:
        winner_team_id = winner_team_id if winner_team_id != 0 else None

        if winner_team_id is not None:
            result = KnockoutService.set_winner(
                db, prediction, winner_team_id, winner_team_name, is_draft=is_draft
            )
            return result

        if team1_id is not None or team2_id is not None:
            resolved_team1 = team1_id if team1_id != 0 else 0
            resolved_team2 = team2_id if team2_id != 0 else 0
            KnockoutService.set_team(
                db, prediction, resolved_team1, resolved_team2, is_draft=is_draft
            )
            return KnockoutService._create_success_response(
                db, prediction, "Teams updated"
            )

        return {"error": "No valid update parameters provided"}

    @staticmethod
    def _persist_winner(
        db: Session,
        prediction,
        winner_team_id: Optional[int],
        is_draft: bool = False,
    ) -> int:
        """
        Persist winner_team_id to DB and set draft modified flags if needed.
        Returns stored_winner (normalized int, 0 if None).
        """
        resolved_winner = KnockoutService._normalize_team_id(winner_team_id)
        stored_winner = resolved_winner  # None means no winner — stored as NULL in DB

        update_kwargs: Dict[str, Any] = {"winner_team_id": stored_winner}
        if hasattr(prediction, "updated_at"):
            update_kwargs["updated_at"] = datetime.utcnow()

        DBWriter.update_knockout_prediction(db, prediction, **update_kwargs)
        DBUtils.flush(db)

        if is_draft:
            knockout_result = getattr(prediction, "knockout_result", None)
            both_teams_qualified = (
                knockout_result and knockout_result.team_1 and knockout_result.team_2
            )

            # Check if draft winner matches the ORIGINAL prediction winner
            # If user reverted to original, mark as NOT modified
            original_pred = None
            if hasattr(prediction, 'knockout_pred_id') and prediction.knockout_pred_id:
                original_pred = DBReader.get_knockout_prediction_by_id(
                    db, prediction.knockout_pred_id, is_draft=False
                )

            original_winner = KnockoutService._normalize_team_id(
                original_pred.winner_team_id if original_pred else None
            )
            draft_winner = KnockoutService._normalize_team_id(stored_winner)

            # Modified only if draft winner differs from original winner
            is_actually_modified = (draft_winner != original_winner)

            DBWriter.set_draft_modified_flags(
                db,
                prediction,
                is_winner_modified=is_actually_modified,
                is_team1_modified=True if both_teams_qualified else None,
                is_team2_modified=True if both_teams_qualified else None,
            )

        return stored_winner

    @staticmethod
    def _compute_winner_status(
        db: Session,
        prediction,
        is_draft: bool = False,
    ) -> None:
        """
        Compute and set prediction status after winner update.
        In draft mode, also re-checks reachability and overrides to UNREACHABLE if needed.
        """
        check_reachable = KnockoutService._should_check_reachable(db, is_draft=is_draft)
        KnockoutService._compute_and_set_status(db, prediction, check_reachable=check_reachable)
        DBUtils.flush(db)

        if is_draft:
            # Only check reachability if a real winner was actually set.
            # If winner is empty (0/None), status is already INVALID — do not override.
            winner_after_compute = KnockoutService._normalize_team_id(prediction.winner_team_id)
            if winner_after_compute:
                is_reachable = KnockoutService.can_winner_reach_match_via_correct_path(
                    db, prediction
                )
                if not is_reachable:
                    DBWriter.update_knockout_prediction(
                        db, prediction, status=KnockoutPredictionStatus.UNREACHABLE.value
                    )
                    DBUtils.flush(db)

    @staticmethod
    def set_winner(
        db: Session,
        prediction,
        winner_team_id: Optional[int],
        winner_team_name: Optional[str] = None,
        is_draft: bool = False,
    ) -> Dict[str, Any]:
        old_winner = prediction.winner_team_id

        stored_winner = KnockoutService._persist_winner(
            db, prediction, winner_team_id, is_draft
        )
        KnockoutService._compute_winner_status(db, prediction, is_draft)

        next_prediction, position = KnockoutService._find_next_prediction_and_position(
            db, prediction
        )
        if next_prediction and position:
            is_next_draft = hasattr(next_prediction, "knockout_pred_id")
            if position == 1:
                KnockoutService.set_team(
                    db, next_prediction, team1_id=stored_winner,
                    is_draft=is_next_draft, force_team1=True
                )
            else:
                KnockoutService.set_team(
                    db, next_prediction, team2_id=stored_winner,
                    is_draft=is_next_draft, force_team2=True
                )

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
        team2_id: Optional[int] = None,
        is_draft: bool = False,
        force_team1: bool = False,
        force_team2: bool = False,
    ) -> None:
        """
        force_team1/force_team2: if True, allows setting None explicitly
        (used when clearing old winner from next stages).
        """
        update_kwargs: Dict[str, Any] = {}
        if team1_id is not None or force_team1:
            update_kwargs["team1_id"] = team1_id
        if team2_id is not None or force_team2:
            update_kwargs["team2_id"] = team2_id

        if not update_kwargs:
            return

        if hasattr(prediction, "updated_at"):
            update_kwargs["updated_at"] = datetime.utcnow()

        DBWriter.update_knockout_prediction(db, prediction, **update_kwargs)
        if is_draft:
            DBWriter.set_draft_modified_flags(
                db,
                prediction,
                is_team1_modified=True if team1_id is not None else None,
                is_team2_modified=True if team2_id is not None else None,
            )

        DBUtils.flush(db)

        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)
        if winner_team_id:
            current_team1 = prediction.team1_id
            current_team2 = prediction.team2_id
            if winner_team_id not in (current_team1, current_team2):
                KnockoutService.set_winner(db, prediction, winner_team_id=None, is_draft=is_draft)
                return

        check_reachable = KnockoutService._should_check_reachable(db, is_draft=is_draft)
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
            penalty_points = 0

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
                            penalty_points += ScoringService.record_prediction_penalty(
                                db, user_id, prediction_id, PredictionType.KNOCKOUT, n_changes=1
                            )

                except HTTPException as e:
                    pred_id_str = str(prediction_id) if prediction_id else "unknown"
                    errors.append(f"HTTP Error updating prediction {pred_id_str}: {e.detail}")
                except Exception as e:
                    pred_id_str = str(prediction_id) if prediction_id else "unknown"
                    errors.append(f"Error updating prediction {pred_id_str}: {str(e)}")
            
            # Commit all changes
            DBUtils.commit(db)

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
            is_team1_modified=False,
            is_team2_modified=False,
            is_winner_modified=False,
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
        Count how many draft predictions the user explicitly modified.
        Uses is_winner_modified flag — tracks user intent, not just value differences.
        """
        drafts = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)

        user_scores = DBReader.get_user_scores(db, user_id)
        if not drafts:
            return {
                "changes_count": 0,
                "penalty_per_change": 0,
                "total_penalty": 0,
                "free_changes": getattr(user_scores, 'free_changes', 0) if user_scores else 0,
            }

        changes_count = 0

        for draft in drafts:
            if getattr(draft, "is_winner_modified", False):
                # Only count as change if the draft currently HAS a winner selected
                current_winner = KnockoutService._normalize_team_id(draft.winner_team_id)
                if current_winner:  # None/0 means user cleared/never set → not a change
                    changes_count += 1

        stage = StageManager.get_current_stage(db)
        penalty_per_change = stage.get_penalty_for()

        # If the user has already used their one-time bracket reset,
        # all changes in PRE_ROUND32 are free — they already paid upfront.
        if user_scores and getattr(user_scores, 'has_used_bracket_reset', False) and stage == Stage.PRE_ROUND32:
            penalty_per_change = 0

        has_used_reset = user_scores and getattr(user_scores, 'has_used_bracket_reset', False)
        return {
            "changes_count": changes_count,
            "penalty_per_change": penalty_per_change,
            "total_penalty": changes_count * penalty_per_change,
            "free_changes": getattr(user_scores, 'free_changes', 0) if user_scores else 0,
            "post_reset_free": bool(has_used_reset),
        }

    @staticmethod
    def _copy_draft_to_prediction(db: Session, draft, original) -> None:
        """
        Smart copy: only copy fields that the user explicitly modified in the draft.
        Uses is_team1_modified, is_team2_modified, is_winner_modified flags.
        Fields with flag=False are left untouched in the original prediction.
        Status is always copied — draft status is always up to date.
        """
        flags = DBReader.get_draft_modified_flags(db, draft)
        update_kwargs = {"status": draft.status}
        if flags["is_team1_modified"]:
            update_kwargs["team1_id"] = draft.team1_id
        if flags["is_team2_modified"]:
            update_kwargs["team2_id"] = draft.team2_id
        if flags["is_winner_modified"]:
            update_kwargs["winner_team_id"] = draft.winner_team_id
        DBWriter.update_knockout_prediction(db, original, **update_kwargs)

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
            return {"success": True, "message": "No drafts to commit", "changes_count": 0, "penalty_points": 0, "penalty_applied": 0}

        # Validate no duplicate winners across stages before committing
        duplicates = KnockoutService._find_duplicate_winners_in_drafts(db, user_id)
        if duplicates:
            team_names = ", ".join(duplicates)
            raise HTTPException(
                status_code=409,
                detail=f"DUPLICATE_WINNERS:{team_names}"
            )

        penalty_points = 0
        changes_count = 0

        # Copy each draft to its original prediction
        for draft in drafts:
            original = DBReader.get_knockout_prediction_by_id(db, draft.knockout_pred_id, is_draft=False)
            if not original:
                continue

            if DBReader.is_draft_winner_modified(db, draft):
                current_winner = KnockoutService._normalize_team_id(draft.winner_team_id)
                if current_winner:  # null winner = not a real change, no penalty
                    changes_count += 1

            KnockoutService._copy_draft_to_prediction(db, draft, original)

        # Apply penalty after loop (with free changes consumption)
        if changes_count > 0:
            user_scores = DBReader.get_user_scores(db, user_id)
            current_stage_for_reset = StageManager.get_current_stage(db)
            has_used_reset = (
                user_scores and
                getattr(user_scores, 'has_used_bracket_reset', False) and
                current_stage_for_reset == Stage.PRE_ROUND32
            )
            if has_used_reset:
                # Post-reset edits in PRE_ROUND32 are free — do NOT touch free_changes pool
                penalty_points = 0
            else:
                paid_changes = ScoringService.consume_free_changes(db, user_id, changes_count)
                if paid_changes > 0:
                    penalty_points = ScoringService.record_prediction_penalty(
                        db, user_id, 0, PredictionType.KNOCKOUT, n_changes=paid_changes
                    )

        DBUtils.flush(db)

        # Delete all drafts
        KnockoutService.delete_all_drafts_for_user(db, user_id)

        DBUtils.commit(db)

        return {
            "success": True,
            "changes_count": changes_count,
            "penalty_points": penalty_points,
            "penalty_applied": penalty_points,
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
            # Mark as incorrect (red) if knockout result already finalized
            knockout_result = DBReader.get_knockout_result_by_id(db, knockout_result_id)
            if knockout_result and knockout_result.winner_team_id:
                DBWriter.set_prediction_status(prediction, KnockoutPredictionStatus.INCORRECT.value)
                DBWriter.update_knockout_prediction(db, prediction, is_editable=False)
                DBUtils.flush(db)
            else:
                current_stage = StageManager.get_current_stage(db)
                check_reachable = current_stage.value >= Stage.PRE_ROUND32.value
                KnockoutService._compute_and_set_status(db, prediction, check_reachable=check_reachable)
            created.append(prediction)

        DBUtils.flush(db)
        return created

    @staticmethod
    def apply_free_bracket_reset_for_new_user(db: Session, user_id: int) -> bool:
        """
        Called during user registration when stage is PRE_ROUND32.
        Resets all round32 predictions with actual teams, no penalty.
        Marks has_used_bracket_reset=True so the user cannot use the paid reset.
        Returns True if reset was applied, False otherwise.
        """
        current_stage = StageManager.get_current_stage(db)
        if current_stage != Stage.PRE_ROUND32:
            return False

        predictions = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)

        for prediction in predictions:
            if prediction.stage == 'round32':
                knockout_result = DBReader.get_knockout_result_by_id(db, prediction.knockout_result_id) if prediction.knockout_result_id else None
                team1 = knockout_result.team_1 if knockout_result else None
                team2 = knockout_result.team_2 if knockout_result else None
                DBWriter.update_knockout_prediction(
                    db, prediction,
                    team1_id=team1,
                    team2_id=team2,
                    winner_team_id=None,
                    status=KnockoutPredictionStatus.INVALID.value,
                    points=0,
                    is_editable=True,
                )
            else:
                DBWriter.update_knockout_prediction(
                    db, prediction,
                    team1_id=None,
                    team2_id=None,
                    winner_team_id=None,
                    status=KnockoutPredictionStatus.INVALID.value,
                    points=0,
                    is_editable=True,
                )

        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)

        DBWriter.update_user_scores(
            db,
            user_scores,
            has_used_bracket_reset=True,
        )

        DBUtils.commit(db)
        return True

    # ═══════════════════════════════════════════════════════
    # VALIDITY & STATUS
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def initialize_all_knockout_statuses(db: Session) -> None:
        """
        Initialize/recalculate status for all knockout predictions using reachable logic.
        Iterates over all predictions per user, skips post-result statuses (CORRECT_FULL,
        CORRECT_PARTIAL, INCORRECT), uses _compute_and_set_status_cached with check_reachable=True.
        Called after admin operations that affect the bracket (entering results, rebuilding).
        Uses check_reachable=True because this runs only after group results exist.
        """
        all_templates: Dict[int, MatchTemplate] = {
            t.id: t for t in db.query(MatchTemplate).all()
        }
        all_results: Dict[int, KnockoutStageResult] = {
            r.match_id: r for r in db.query(KnockoutStageResult).all()
        }
        all_teams: Dict[int, Team] = {t.id: t for t in db.query(Team).all()}
        predictions = DBReader.get_all_knockout_predictions(db)
        for prediction in predictions:
            KnockoutService._compute_and_set_status_cached(
                db,
                prediction,
                check_reachable=True,
                templates_cache=all_templates,
                results_cache=all_results,
                teams_cache=all_teams,
            )
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
        Called from ResultsService after updating result.
        Handles status updates and scoring for all users' predictions of THIS match.

        Logic:
        1. Mark loser as eliminated
        2. For each prediction of this match:
           a. If INVALID/empty -> INCORRECT (but still process winner/loser for other predictions)
           b. Handle winner (always)
           c. Handle loser (always, even if winner was handled)
        """
        predictions = DBReader.get_knockout_predictions_by_match(db, match_id)
        template = DBReader.get_match_template(db, match_id)
        if not template:
            return
        stage = template.stage

        # Mark loser as eliminated (once, before processing predictions)
        loser_team = DBReader.get_team(db, loser_team_id)
        if loser_team and not loser_team.is_eliminated:
            DBWriter.update_team_eliminated(db, loser_team, True)
            DBUtils.flush(db)

        for prediction in predictions:
            user_id = prediction.user_id
            predicted_winner = KnockoutService._normalize_team_id(prediction.winner_team_id)

            # Case 0: INVALID or empty -> INCORRECT
            # BUT do NOT continue — still need to handle winner/loser for OTHER predictions in same stage!
            if not predicted_winner or prediction.status == KnockoutPredictionStatus.INVALID.value:
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    KnockoutPredictionStatus.INCORRECT.value, 0
                )
                # NO continue here! Fall through to handle winner/loser

            # Part A: Handle winner (ALWAYS runs)
            KnockoutService._handle_winner(
                db, prediction, user_id, winner_team_id, stage
            )

            # Part B: Handle loser (ALWAYS runs, even if winner was handled!)
            KnockoutService._handle_loser(
                db, prediction, user_id, loser_team_id, stage
            )

        DBUtils.flush(db)

    @staticmethod
    def _handle_winner(
        db: Session,
        prediction,
        user_id: int,
        winner_team_id: int,
        stage: str
    ) -> None:
        """
        Part A — Handle winner.

        Returns nothing. Does NOT set INCORRECT — that's _handle_loser's job.

        Logic:
        1. If THIS prediction predicted the winner -> CORRECT_FULL or CORRECT_PARTIAL
        2. Else search same stage for UNREACHABLE prediction with winner -> CORRECT_PARTIAL
        """
        predicted_winner = KnockoutService._normalize_team_id(prediction.winner_team_id)

        # A1: Did THIS prediction predict the winner?
        if predicted_winner == winner_team_id:
            if prediction.status == KnockoutPredictionStatus.UNREACHABLE.value:
                # Correct winner via different path -> CORRECT_PARTIAL (50%)
                points = ScoringService.KNOCKOUT_SCORING.get(stage, {}).get("partial", 0)
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    KnockoutPredictionStatus.CORRECT_PARTIAL.value, points
                )
            else:
                # Correct winner via correct path -> CORRECT_FULL (100%)
                points = ScoringService.KNOCKOUT_SCORING.get(stage, {}).get("full", 0)
                KnockoutService._set_prediction_status_and_points(
                    db, prediction, user_id,
                    KnockoutPredictionStatus.CORRECT_FULL.value, points
                )
            return  # This prediction handled for winner

        # A2: This prediction didn't predict winner
        # Search same stage for UNREACHABLE prediction that has the winner (DB query)
        if winner_team_id:
            other_pred = DBReader.get_unreachable_knockout_prediction_with_winner(
                db, user_id, stage, prediction.id, winner_team_id
            )
            if other_pred:
                normalized = KnockoutService._normalize_team_id(other_pred.winner_team_id)
                if normalized and normalized == winner_team_id:
                    points = ScoringService.KNOCKOUT_SCORING.get(stage, {}).get("partial", 0)
                    KnockoutService._set_prediction_status_and_points(
                        db, other_pred, user_id,
                        KnockoutPredictionStatus.CORRECT_PARTIAL.value, points
                    )

        # No UNREACHABLE with winner found — that's fine, nothing to do here

    @staticmethod
    def _handle_loser(
        db: Session,
        prediction,
        user_id: int,
        loser_team_id: int,
        stage: str
    ) -> None:
        """
        Part B — Handle loser.

        Logic:
        1. If THIS prediction predicted the loser -> INCORRECT + invalidate future stages
        2. Else search same stage for prediction with loser -> INCORRECT + invalidate future stages
        """
        predicted_winner = KnockoutService._normalize_team_id(prediction.winner_team_id)

        # B1: Did THIS prediction predict the loser?
        if predicted_winner == loser_team_id:
            KnockoutService._set_prediction_status_and_points(
                db, prediction, user_id,
                KnockoutPredictionStatus.INCORRECT.value, 0
            )
            KnockoutService._invalidate_loser_in_future_stages(
                db, user_id, loser_team_id, prediction
            )
            return  # This prediction handled for loser

        # B2: This prediction didn't predict loser
        # Search same stage for predictions that have the loser as winner (DB query)
        if loser_team_id:
            other_preds = DBReader.get_knockout_predictions_with_winner_in_stage_excluding(
                db, user_id, stage, prediction.id, loser_team_id
            )
            for other_pred in other_preds:
                normalized = KnockoutService._normalize_team_id(other_pred.winner_team_id)
                if normalized and normalized == loser_team_id:
                    KnockoutService._set_prediction_status_and_points(
                        db, other_pred, user_id,
                        KnockoutPredictionStatus.INCORRECT.value, 0
                    )
                    KnockoutService._invalidate_loser_in_future_stages(
                        db, user_id, loser_team_id, other_pred
                    )

    @staticmethod
    def _invalidate_loser_in_future_stages(
        db: Session,
        user_id: int,
        loser_team_id: int,
        current_prediction
    ) -> None:
        """
        Walk forward from current_prediction in the knockout bracket.
        If loser appears as winner in next stages -> set to INVALID (not INCORRECT).

        Why INVALID and not INCORRECT?
        Because those matches haven't been played yet. When they ARE played,
        process_knockout_match_result will set them to INCORRECT.
        """
        next_prediction, position = KnockoutService._find_next_prediction_and_position(
            db, current_prediction
        )

        if not next_prediction:
            return  # Reached end (final or no next stage)

        next_winner = KnockoutService._normalize_team_id(next_prediction.winner_team_id)

        if next_winner == loser_team_id:
            # Loser was predicted as winner here -> INVALID (match not played yet)
            KnockoutService._set_prediction_status_and_points(
                db, next_prediction, user_id,
                KnockoutPredictionStatus.INVALID.value, 0
            )

            # Continue recursion to find loser in even later stages
            KnockoutService._invalidate_loser_in_future_stages(
                db, user_id, loser_team_id, next_prediction
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
        if is_draft:
            # Mirror committed prediction's is_editable (draft rows do not store this column)
            committed = None
            pred_link = getattr(prediction, "knockout_pred_id", None)
            if pred_link:
                committed = DBReader.get_knockout_prediction_by_id(db, pred_link, is_draft=False)
            item["is_editable"] = getattr(committed, "is_editable", True) if committed else True

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
            item["penalty_points"] = prediction.penalty_points or 0
            item["is_editable"] = prediction.is_editable
            item["created_at"] = prediction.created_at
            item["updated_at"] = prediction.updated_at
        else:
            item["knockout_pred_id"] = prediction.knockout_pred_id
            item["is_winner_modified"] = getattr(prediction, "is_winner_modified", False)

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

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Status & Validity
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _should_check_reachable(db: Session, is_draft: bool = False) -> bool:
        """
        Determine if reachability should be checked when computing status.
        True if: global stage >= PRE_ROUND32, OR (in draft mode) any knockout results exist.
        """
        current_stage = StageManager.get_current_stage(db)
        if current_stage.value >= Stage.PRE_ROUND32.value:
            return True
        if is_draft:
            return DBReader.any_knockout_results_exist(db)
        return False

    @staticmethod
    def _compute_and_set_status(
        db: Session,
        prediction,
        check_reachable: bool = False
    ) -> Optional[KnockoutPredictionStatus]:
        """
        Compute and set the prediction status based on current state.

        Used when USER changes a prediction (not when admin enters result).
        For admin result entry, use process_knockout_match_result instead.

        IMPORTANT:
        - If match already has result, don't change status (return None)
        - If status is UNREACHABLE and we're not checking reachable, keep it

        Returns the status that was set, or None if no change.
        """
        template = DBReader.get_match_template(db, prediction.template_match_id)
        result = DBReader.get_knockout_result(db, prediction.template_match_id)

        if not template:
            return None

        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)
        current_status = prediction.status

        # ═══════════════════════════════════════════
        # POST-RESULT: Match has been played
        # Don't change status here — that's handled by process_knockout_match_result
        # ═══════════════════════════════════════════
        if result and result.winner_team_id:
            return None

        # ═══════════════════════════════════════════
        # PRE-RESULT: Match not yet played
        # ═══════════════════════════════════════════

        # No winner predicted
        if not winner_team_id:
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Winner is eliminated
        winner_team = DBReader.get_team(db, winner_team_id)
        if winner_team and winner_team.is_eliminated:
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Check reachability if requested
        if check_reachable:
            if not KnockoutService.can_winner_reach_match_via_correct_path(db, prediction):
                status = KnockoutPredictionStatus.UNREACHABLE
                DBWriter.set_prediction_status(prediction, status.value)
                return status
            # Reachable — set to VALID
            status = KnockoutPredictionStatus.VALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # ═══════════════════════════════════════════
        # Not checking reachable — preserve existing status
        # ═══════════════════════════════════════════

        # If already UNREACHABLE, keep it (don't override to VALID)
        if current_status == KnockoutPredictionStatus.UNREACHABLE.value:
            return KnockoutPredictionStatus.UNREACHABLE

        # If already VALID, keep it
        if current_status == KnockoutPredictionStatus.VALID.value:
            return KnockoutPredictionStatus.VALID

        # Default for new/other predictions
        status = KnockoutPredictionStatus.VALID
        DBWriter.set_prediction_status(prediction, status.value)
        return status

    @staticmethod
    def _compute_and_set_status_cached(
        db: Session,
        prediction,
        check_reachable: bool,
        templates_cache: Dict[int, MatchTemplate],
        results_cache: Dict[int, KnockoutStageResult],
        teams_cache: Dict[int, Team],
    ) -> Optional[KnockoutPredictionStatus]:
        template = templates_cache.get(prediction.template_match_id)
        result = results_cache.get(prediction.template_match_id)

        if not template:
            return None

        winner_team_id = KnockoutService._normalize_team_id(prediction.winner_team_id)
        current_status = prediction.status

        if result and result.winner_team_id:
            return None

        if not winner_team_id:
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        winner_team = teams_cache.get(winner_team_id)
        if winner_team and winner_team.is_eliminated:
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        if check_reachable:
            if not KnockoutService._is_winner_reachable_recursive_cached(
                prediction.template_match_id,
                winner_team_id,
                templates_cache,
                results_cache,
            ):
                status = KnockoutPredictionStatus.UNREACHABLE
                DBWriter.set_prediction_status(prediction, status.value)
                return status
            status = KnockoutPredictionStatus.VALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        if current_status == KnockoutPredictionStatus.UNREACHABLE.value:
            return KnockoutPredictionStatus.UNREACHABLE

        if current_status == KnockoutPredictionStatus.VALID.value:
            return KnockoutPredictionStatus.VALID

        status = KnockoutPredictionStatus.VALID
        DBWriter.set_prediction_status(prediction, status.value)
        return status

    @staticmethod
    def _compute_status_pre_result(
        db: Session,
        prediction,
        check_reachable: bool
    ) -> KnockoutPredictionStatus:
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
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Case 2: Predicted team is eliminated
        winner_team = DBReader.get_team(db, winner_team_id)
        if winner_team and winner_team.is_eliminated:
            status = KnockoutPredictionStatus.INVALID
            DBWriter.set_prediction_status(prediction, status.value)
            return status

        # Case 3: Check reachability if requested
        if check_reachable:
            if not KnockoutService.can_winner_reach_match_via_correct_path(db, prediction):
                status = KnockoutPredictionStatus.UNREACHABLE
                DBWriter.set_prediction_status(prediction, status.value)
                return status

        # Case 4: Valid prediction
        status = KnockoutPredictionStatus.VALID
        DBWriter.set_prediction_status(prediction, status.value)
        return status

    @staticmethod
    def _coerce_status(status: Optional[str]) -> Optional[str]:
        if not status:
            return None
        legacy_map = {
            "predicted": KnockoutPredictionStatus.VALID.value,
            "might_change_predict": KnockoutPredictionStatus.UNREACHABLE.value,
            "must_change_predict": KnockoutPredictionStatus.INVALID.value,
            "gray": KnockoutPredictionStatus.INVALID.value,
        }
        if status in legacy_map:
            return legacy_map[status]
        try:
            return KnockoutPredictionStatus(status).value
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

    @staticmethod
    def _is_winner_reachable_recursive_cached(
        match_id: int,
        winner_team_id: int,
        templates_cache: Dict[int, MatchTemplate],
        results_cache: Dict[int, KnockoutStageResult],
        visited: Optional[Set[int]] = None,
    ) -> bool:
        if visited is None:
            visited = set()

        if match_id in visited:
            return False
        visited.add(match_id)

        template = templates_cache.get(match_id)
        if not template:
            return False

        knockout_result = results_cache.get(match_id)
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            return winner_team_id in {knockout_result.team_1, knockout_result.team_2}

        if template.stage == "round32":
            return True

        source_match_1_id = KnockoutService._extract_match_id_from_winner_string(template.team_1)
        source_match_2_id = KnockoutService._extract_match_id_from_winner_string(template.team_2)

        return (
            (source_match_1_id and KnockoutService._is_winner_reachable_recursive_cached(
                source_match_1_id, winner_team_id, templates_cache, results_cache, visited.copy()
            )) or
            (source_match_2_id and KnockoutService._is_winner_reachable_recursive_cached(
                source_match_2_id, winner_team_id, templates_cache, results_cache, visited.copy()
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
    def _find_duplicate_winners_in_drafts(db: Session, user_id: int) -> List[str]:
        """
        Returns list of team names that appear as winner in more than one draft
        prediction within the same stage. Empty list = no duplicates.
        """
        from collections import defaultdict
        drafts = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)

        stage_winner_counts: dict = defaultdict(lambda: defaultdict(int))

        for draft in drafts:
            winner_id = KnockoutService._normalize_team_id(draft.winner_team_id)
            if winner_id:
                stage_winner_counts[draft.stage][winner_id] += 1

        duplicate_team_ids = set()
        for stage, winner_counts in stage_winner_counts.items():
            for team_id, count in winner_counts.items():
                if count > 1:
                    duplicate_team_ids.add(team_id)

        if not duplicate_team_ids:
            return []

        team_names = []
        for team_id in duplicate_team_ids:
            team = DBReader.get_team(db, team_id)
            team_names.append(team.name if team else str(team_id))

        return sorted(team_names)

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
