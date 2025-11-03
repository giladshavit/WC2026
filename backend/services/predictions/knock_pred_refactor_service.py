from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from .prediction_repository import PredictionRepository
from .shared import PredictionStatus
from services.scoring_service import ScoringService
from models.results import KnockoutStageResult
from models.team import Team


class KnockPredRefactorService:
    """
    Refactored knockout prediction service with simplified, cleaner logic.
    This service will eventually replace the current knockout_prediction_service.
    """
    
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
            
            # If next prediction doesn't exist and this is a draft, create it
            if not next_prediction and hasattr(prediction, 'knockout_pred_id'):
                next_prediction = KnockPredRefactorService._create_next_stage_draft(
                    db, prediction, new_winner
                )
                if next_prediction:
                    # Get position from template
                    current_template = PredictionRepository.get_match_template(
                        db, prediction.template_match_id
                    )
                    position = current_template.winner_next_position if current_template else None
            
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
    def _get_source_match_id(db: Session, match_id: int, is_team1: bool = True) -> Optional[int]:
        """
        Get the source match ID for a team in a match.
        For Round of 32, returns the match itself (no source match).
        For other stages, extracts the source match ID from template.team_1 or template.team_2.
        
        Args:
            db: Database session
            match_id: The current match template ID
            is_team1: True if checking team1, False if checking team2
            
        Returns:
            Source match ID, or the match itself for Round of 32, or None if not found
        """
        template = PredictionRepository.get_match_template(db, match_id)
        if not template:
            return None
        
        # For Round of 32, return the match itself (no source match)
        if template.stage == 'round32':
            return match_id
        
        # For other stages, extract source match ID from team_1 or team_2
        team_source = template.team_1 if is_team1 else template.team_2
        source_match_id = KnockPredRefactorService._extract_match_id_from_winner_string(team_source)
        
        return source_match_id if source_match_id else None

    @staticmethod
    def _clean_invalid_team_if_needed(db: Session, team_id: Optional[int], match_id: int, is_team1: bool) -> Optional[int]:
        """
        Check if a team is valid for a match and return 0 if invalid, otherwise return the team_id.
        Only clears if explicitly False (not None/undefined).
        
        Args:
            db: Database session
            team_id: The team ID to check
            match_id: The match template ID
            is_team1: True if checking team1, False if checking team2
            
        Returns:
            team_id if valid or None, 0 if invalid
        """
        if not team_id:
            return team_id
        
        is_valid = KnockPredRefactorService._is_team_valid_for_match(
            db, team_id, match_id, is_team1=is_team1
        )
        if is_valid is False:
            return 0
        
        return team_id

    @staticmethod
    def _is_team_valid_for_match(db: Session, team_id: Optional[int], match_id: int, is_team1: bool = True) -> Optional[bool]:
        """
        Check if a team is valid for a specific match by checking if it can reach the source match.
        For Round of 32, checks the match itself. For other stages, finds and checks the source match.
        
        Args:
            db: Database session
            team_id: The team ID to check (None means not valid)
            match_id: The current match template ID
            is_team1: True if checking team1, False if checking team2
            
        Returns:
            True if team is valid, False if invalid, None if we can't determine (no results yet)
        """
        if not team_id:
            return None  # Don't mark as invalid if team_id is None
        
        # Get template to check stage
        template = PredictionRepository.get_match_template(db, match_id)
        if not template:
            return None
        
        # For Round of 32, check the match itself
        if template.stage == 'round32':
            match_id_to_check = match_id
        else:
            # For other stages, find the source match from the previous stage
            team_source = template.team_1 if is_team1 else template.team_2
            source_match_id = KnockPredRefactorService._extract_match_id_from_winner_string(team_source)
            
            if not source_match_id:
                return None  # Can't determine if no source match
            
            match_id_to_check = source_match_id
        
        # Check if team can reach this match
        from services.results_service import ResultsService
        is_reachable = ResultsService.is_winner_reachable_recursive(db, match_id_to_check, team_id)
        
        return is_reachable

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
        predictions = PredictionRepository.get_knockout_predictions_by_user(db, user_id, stage, is_draft=is_draft)

        result: List[Dict[str, Any]] = []
        for prediction in predictions:
            # Default to prediction data
            team1_id = prediction.team1_id
            team2_id = prediction.team2_id
            winner_team_id = prediction.winner_team_id
            team1 = prediction.team1
            team2 = prediction.team2
            winner_team = prediction.winner_team

            if is_draft:
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
                    team1 = PredictionRepository.get_team(db, team1_id) if team1_id else None
                    team2 = PredictionRepository.get_team(db, team2_id) if team2_id else None
                    winner_team = PredictionRepository.get_team(db, winner_team_id) if winner_team_id else None

            item: Dict[str, Any] = {
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
                "winner_team_flag": winner_team.flag_url if winner_team else None,
            }

            # Get knockout result for validation/correctness check
            knockout_result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.id == prediction.knockout_result_id
            ).first() if prediction.knockout_result_id else None
            
            # Check if match has been decided (has winner)
            if knockout_result and knockout_result.winner_team_id:
                # Match is finished - check if user predicted correctly
                item["is_correct"] = (prediction.winner_team_id == knockout_result.winner_team_id)
                # Don't include team validity since match is decided
            else:
                # Match not finished yet - check team reachability/validity
                # Only check validity if team_id exists; only set if explicitly False
                if team1_id:
                    is_valid = KnockPredRefactorService._is_team_valid_for_match(
                        db, team1_id, prediction.template_match_id, is_team1=True
                    )
                    # Only set if invalid (False), if None don't include the field
                    if is_valid is False:
                        item["team1_is_valid"] = False
                
                if team2_id:
                    is_valid = KnockPredRefactorService._is_team_valid_for_match(
                        db, team2_id, prediction.template_match_id, is_team1=False
                    )
                    # Only set if invalid (False), if None don't include the field
                    if is_valid is False:
                        item["team2_is_valid"] = False
                # is_correct not relevant yet (will be None or not included)

            if not is_draft:
                item["points"] = prediction.points
                item["is_editable"] = prediction.is_editable
                item["created_at"] = prediction.created_at
                item["updated_at"] = prediction.updated_at
            else:
                if hasattr(prediction, 'knockout_pred_id'):
                    item["knockout_pred_id"] = prediction.knockout_pred_id

            result.append(item)

        user_scores = None
        if not is_draft:
            user_scores = PredictionRepository.get_user_scores(db, user_id)

        return {
            "predictions": result,
            "knockout_score": user_scores.knockout_score if user_scores else None,
        }
    
    @staticmethod
    def _create_next_stage_draft(db: Session, prediction, winner_team_id: int) -> Optional[Any]:
        """
        Create a draft prediction for the next stage if it doesn't exist.
        Only works for draft predictions.
        """
        # Find the template of the current prediction
        current_template = PredictionRepository.get_match_template(
            db, prediction.template_match_id
        )
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None
        
        next_match_id = current_template.winner_next_knockout_match
        
        # Find the matching result
        result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        if not result:
            return None
        
        # Find the template of the next stage
        next_template = PredictionRepository.get_match_template(db, next_match_id)
        if not next_template:
            return None
        
        # Find original prediction for this match to link draft to it
        original_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(
            db, prediction.user_id, next_match_id, is_draft=False
        )
        knockout_pred_id = original_prediction.id if original_prediction else None
        
        # Create draft prediction
        draft = PredictionRepository.create_knockout_prediction(
            db,
            user_id=prediction.user_id,
            knockout_result_id=result.id,
            template_match_id=next_match_id,
            stage=next_template.stage,
            team1_id=None,
            team2_id=None,
            winner_team_id=None,
            is_draft=True,
            knockout_pred_id=knockout_pred_id,
            status=PredictionStatus.MUST_CHANGE_PREDICT.value,
        )
        
        db.flush()
        return draft
    
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
        current_template = PredictionRepository.get_match_template(
            db, prediction.template_match_id
        )
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No next stage
        
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        # Find the next prediction (use same draft status as current prediction)
        next_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(
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

    @staticmethod
    def create_draft_from_prediction(db: Session, user_id: int, prediction_id: int) -> Dict[str, Any]:
        """
        Create a draft prediction by copying from existing prediction.
        Priority: result data first (teams, winner if exists), otherwise copy prediction as-is.
        Status is always copied from the original prediction.
        """
        # Get the original prediction
        prediction = PredictionRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        # If draft already exists, delete it first to recreate with cleaned teams
        existing_draft = PredictionRepository.get_knockout_prediction_by_user_and_match(
            db, user_id, prediction.template_match_id, is_draft=True
        )
        if existing_draft:
            db.delete(existing_draft)
            db.flush()

        # Use result teams if exist; otherwise check validity and clean invalid teams
        knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
        
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            # Result exists - use result teams
            team1_id = knockout_result.team_1
            team2_id = knockout_result.team_2
            # Winner: prefer result winner if exists; otherwise keep user's winner
            winner_team_id = knockout_result.winner_team_id if getattr(knockout_result, 'winner_team_id', None) else prediction.winner_team_id
        else:
            # No result - check validity and clean invalid teams
            team1_id = prediction.team1_id
            team2_id = prediction.team2_id
            
            # Check if teams are valid (if not, set to 0)
            # Only clear if explicitly False (not None/undefined)
            team1_id = KnockPredRefactorService._clean_invalid_team_if_needed(
                db, team1_id, prediction.template_match_id, is_team1=True
            )
            team2_id = KnockPredRefactorService._clean_invalid_team_if_needed(
                db, team2_id, prediction.template_match_id, is_team1=False
            )
            
            # If winner is one of the invalid teams, clear it
            winner_team_id = prediction.winner_team_id
            if winner_team_id:
                if winner_team_id != team1_id and winner_team_id != team2_id:
                    # Winner is not in the valid teams anymore - clear it
                    winner_team_id = 0
        
        # Convert 0 to None for database (0 is sentinel, None is actual empty value)
        team1_id = team1_id if team1_id != 0 else None
        team2_id = team2_id if team2_id != 0 else None
        winner_team_id = winner_team_id if winner_team_id != 0 else None

        # Create draft copy
        draft = PredictionRepository.create_knockout_prediction(
            db,
            user_id=user_id,
            knockout_result_id=prediction.knockout_result_id or 0,
            template_match_id=prediction.template_match_id,
            stage=prediction.stage,
            team1_id=team1_id,
            team2_id=team2_id,
            winner_team_id=winner_team_id,
            is_draft=True,
            knockout_pred_id=prediction.id,
            status=prediction.status,
        )

        PredictionRepository.commit(db)
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
        predictions = PredictionRepository.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)

        created = 0
        skipped = 0
        for prediction in predictions:
            # Delete existing draft if exists (create_draft_from_prediction will recreate it)
            existing = PredictionRepository.get_knockout_prediction_by_user_and_match(
                db, user_id, prediction.template_match_id, is_draft=True
            )
            if existing:
                db.delete(existing)
                db.flush()

            # Delegate to single-item creator to avoid duplicate logic
            res = KnockPredRefactorService.create_draft_from_prediction(db, user_id, prediction.id)
            if res.get("success"):
                created += 1

        # Nothing else to do, create_draft_from_prediction commits
        return {
            "success": True,
            "message": "Drafts created",
            "created": created,
            "skipped": skipped,
        }

    @staticmethod
    def delete_all_drafts_for_user(db: Session, user_id: int) -> Dict[str, Any]:
        """Delete all draft predictions for a given user."""
        drafts = PredictionRepository.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)
        deleted = 0
        for draft in drafts:
            db.delete(draft)
            deleted += 1
        db.commit()
        return {"success": True, "deleted": deleted}
