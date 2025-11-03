from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from .prediction_repository import PredictionRepository
from .shared import PredictionStatus
from services.scoring_service import ScoringService


class KnockPredRefactorService:
    """
    Refactored knockout prediction service with simplified, cleaner logic.
    This service will eventually replace the current knockout_prediction_service.
    """
    
    @staticmethod
    def update_knockout_prediction(
        db: Session,
        prediction,
        team1_id: Optional[int] = None,
        team2_id: Optional[int] = None,
        winner_team_id: Optional[int] = None,
        winner_team_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update a knockout prediction and propagate changes recursively.
        
        Algorithm:
        - Case 1: winner_team_id is not None (teams are None) - update winner
        - Case 2: team1_id or team2_id is not None (winner is None) - update teams
        
        Args:
            db: Database session
            prediction: The prediction to update
            team1_id: Optional team1 to set (None = no change, 0 = clear)
            team2_id: Optional team2 to set (None = no change, 0 = clear)
            winner_team_id: Optional winner to set (None = no change, 0 = clear)
            winner_team_name: Optional winner team name for response
        
        Returns:
            Dict with success response
        """
        old_winner = prediction.winner_team_id
        
        # Case 1: Update winner (teams are None)
        if winner_team_id is not None:
            # Update winner
            new_winner = winner_team_id
            prediction.winner_team_id = new_winner if new_winner != 0 else None
            
            # Update updated_at if field exists
            if hasattr(prediction, 'updated_at'):
                prediction.updated_at = datetime.utcnow()
            
            # Determine status based on winner value
            if new_winner == 0:
                # Winner is 0 or None -> red status
                prediction.status = PredictionStatus.MUST_CHANGE_PREDICT.value
            else:
                # Check if winner matches one of the teams in prediction
                if prediction.team1_id == new_winner or prediction.team2_id == new_winner:
                    prediction.status = PredictionStatus.PREDICTED.value  # green
                else:
                    prediction.status = PredictionStatus.MUST_CHANGE_PREDICT.value  # red
            
            db.flush()
            
            # Find next prediction and position
            next_prediction, position = KnockPredRefactorService._find_next_prediction_and_position(
                db, prediction
            )
            
            if next_prediction and position:
                # Recursively update next stage with team1_id or team2_id based on position
                # Ignore return value for recursive calls
                if position == 1:
                    KnockPredRefactorService.update_knockout_prediction(
                        db, next_prediction, team1_id=new_winner
                    )
                else:  # position == 2
                    KnockPredRefactorService.update_knockout_prediction(
                        db, next_prediction, team2_id=new_winner
                    )
        
        # Case 2: Update teams (winner is None)
        elif team1_id is not None or team2_id is not None:
            # Update the relevant team(s)
            if team1_id is not None:
                prediction.team1_id = team1_id if team1_id != 0 else None
            if team2_id is not None:
                prediction.team2_id = team2_id if team2_id != 0 else None
            
            # Update updated_at if field exists
            if hasattr(prediction, 'updated_at'):
                prediction.updated_at = datetime.utcnow()
            
            db.flush()
            
            # Check current winner - if it matches one of the new teams, mark as yellow
            if prediction.winner_team_id:
                new_team1 = prediction.team1_id
                new_team2 = prediction.team2_id
                
                if prediction.winner_team_id == new_team1 or prediction.winner_team_id == new_team2:
                    # Winner matches one of the teams -> yellow
                    prediction.status = PredictionStatus.MIGHT_CHANGE_PREDICT.value
                else:
                    # Winner doesn't match -> red, clear winner recursively
                    prediction.status = PredictionStatus.MUST_CHANGE_PREDICT.value
                    # Ignore return value for recursive call
                    KnockPredRefactorService.update_knockout_prediction(
                        db, prediction, winner_team_id=0
                    )
            else:
                # No winner set -> red
                prediction.status = PredictionStatus.MUST_CHANGE_PREDICT.value
            
            db.flush()
        
        # Check if prediction changed
        changed = (old_winner != prediction.winner_team_id) if winner_team_id is not None else True
        
        # Return success response
        return KnockPredRefactorService._create_success_response(
            db, prediction, "Prediction updated successfully", 
            winner_team_name=winner_team_name, changed=changed
        )
    
    @staticmethod
    def _find_next_prediction_and_position(
        db: Session,
        prediction
    ) -> tuple:
        """
        Find the next prediction in the knockout chain and its position.
        Returns: tuple (next_prediction, position) or (None, None) if not found
        """
        # Find the template of the current prediction
        current_template = PredictionRepository.get_match_template(
            db, prediction.template_match_id
        )
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No next stage
        
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        # Find the next prediction
        next_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(
            db, prediction.user_id, next_match_id, is_draft=False
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
            winner_team = PredictionRepository.get_team(db, prediction.winner_team_id)
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
        prediction = PredictionRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
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
        result = KnockPredRefactorService.update_knockout_prediction(
            db, prediction, winner_team_id=winner_team_id, 
            winner_team_name=winner_team_name
        )
        
        # Commit changes
        PredictionRepository.commit(db)
        
        return result
    
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
                    prediction = PredictionRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
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
                    result = KnockPredRefactorService.update_knockout_prediction(
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
            PredictionRepository.commit(db)
            
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
    
    @staticmethod
    def _create_new_hash_key(db: Session, advancing_team_ids: List[int]) -> str:
        """Create hash key from advancing team IDs"""
        letters = []
        for team_id in advancing_team_ids:
            team = PredictionRepository.get_team(db, team_id)
            if team and team.group_letter:
                letters.append(team.group_letter)
        
        hash_key = ''.join(sorted(letters))
        return hash_key
    
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
        # Build hash key and find combination
        hash_key = KnockPredRefactorService._create_new_hash_key(db, advancing_team_ids)
        
        combination = PredictionRepository.get_third_place_combination_by_hash(db, hash_key)
        if not combination:
            return
        
        # Mapping from third-place team source to combination column
        third_team_mapping = {
            '3rd_team_1': 'match_1E',
            '3rd_team_2': 'match_1I',
            '3rd_team_3': 'match_1A',
            '3rd_team_4': 'match_1L',
            '3rd_team_5': 'match_1D',
            '3rd_team_6': 'match_1G',
            '3rd_team_7': 'match_1B',
            '3rd_team_8': 'match_1K'
        }

        # Get Round of 32 templates where team_2 uses third-place source
        templates = PredictionRepository.get_match_templates_by_stage(db, 'round32')
        relevant_templates = [t for t in templates if t.team_2 and t.team_2.startswith('3rd_team_')]

        # Helper: resolve third-place team from source
        def resolve_third_place_team(team_source: str):
            column_name = third_team_mapping.get(team_source)
            if not column_name:
                return None
            
            third_place_source = getattr(combination, column_name, None)  # e.g., '3A'
            if not third_place_source:
                return None
            
            group_letter = third_place_source[1]  # 'A'
            group = PredictionRepository.get_group_by_name(db, group_letter)
            if not group:
                return None

            group_pred = PredictionRepository.get_group_prediction_by_user_and_group_id(db, user_id, group.id)
            if not group_pred:
                return None

            team = PredictionRepository.get_team(db, group_pred.third_place)
            return team

        # Iterate relevant templates and update predictions
        for template in relevant_templates:
            # Find the user's prediction for this match
            prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(
                db, user_id, template.id, is_draft=False
            )
            if not prediction:
                continue

            old_team2_id = prediction.team2_id

            # Compute the new team2 from the combination
            new_team = resolve_third_place_team(template.team_2)
            new_team2_id = new_team.id if new_team else None
            if not new_team2_id:
                continue

            if old_team2_id == new_team2_id:
                continue

            # Update using the new refactored service
            KnockPredRefactorService.update_knockout_prediction(
                db, prediction, team2_id=new_team2_id
            )
        
        # Commit all changes at the end
        PredictionRepository.commit(db)
