from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from .db_prediction_repository import DBPredRepository
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
            
            # Create next stage prediction if needed (before finding it)
            template = DBPredRepository.get_match_template(db, prediction.template_match_id)
            if template:
                from .knockout_prediction_service import KnockoutPredictionService
                is_draft = hasattr(prediction, 'knockout_pred_id')
                KnockoutPredictionService._create_next_stage_if_needed(db, prediction, template, is_draft=is_draft)
            
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
                    current_template = DBPredRepository.get_match_template(
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
        template = DBPredRepository.get_match_template(db, match_id)
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
    def _check_team_valid_from_previous_prediction(db: Session, team_id: Optional[int], match_id: int, user_id: int, is_team1: bool = True) -> Optional[bool]:
        """
        Check if a team is valid by checking the is_team1_valid or is_team2_valid field from the previous match.
        Only used when there's no result for the current match.
        
        Args:
            db: Database session
            team_id: The team ID to check
            match_id: The current match template ID
            user_id: The user ID to check their prediction
            is_team1: True if checking team1, False if checking team2
            
        Returns:
            True if team is valid (from previous prediction's validity field),
            False if invalid,
            None if Round of 32 (no previous stage) or no source match
        """
        if not team_id:
            return None
        
        # Get template to check stage
        template = DBPredRepository.get_match_template(db, match_id)
        if not template:
            return None
        
        # For Round of 32, we can't check previous prediction (no previous stage)
        if template.stage == 'round32':
            return None  # Can't determine validity for Round of 32
        
        # For other stages, find the source match from the previous stage
        team_source = template.team_1 if is_team1 else template.team_2
        source_match_id = KnockPredRefactorService._extract_match_id_from_winner_string(team_source)
        
        if not source_match_id:
            return None  # Can't determine if no source match
        
        # Get the user's prediction for the previous match
        previous_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
            db, user_id, source_match_id, is_draft=False
        )
        
        if not previous_prediction:
            return False  # No previous prediction means team is invalid
        
        # Check the validity field from the previous prediction
        # If team_id matches the winner from previous match, check the validity field
        if previous_prediction.winner_team_id == team_id:
            if previous_prediction.winner_team_id == previous_prediction.team1_id:
                return previous_prediction.is_team1_valid
            elif previous_prediction.winner_team_id == previous_prediction.team2_id:
                return previous_prediction.is_team2_valid
            else:
                # Winner is not one of the teams - this shouldn't happen, but return False
                return False
        
        return False  # Team was not predicted as winner - invalid

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
        current_winner_team = DBPredRepository.get_team(db, current_winner_team_id) if current_winner_team_id else None
        
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
            team1 = DBPredRepository.get_team(db, team1_id) if team1_id else None
            team2 = DBPredRepository.get_team(db, team2_id) if team2_id else None
            winner_team = DBPredRepository.get_team(db, winner_team_id) if winner_team_id else None

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
    def update_all_predictions_validity(db: Session) -> None:
        """
        Update validity for all knockout predictions based on current results and predictions.
        This should be called after admin operations that might affect validity (e.g., entering results).
        """
        from models.predictions import KnockoutStagePrediction
        from models.results import KnockoutStageResult
        
        # Get all knockout predictions
        predictions = db.query(KnockoutStagePrediction).all()
        
        for prediction in predictions:
            # Get knockout result for this prediction
            knockout_result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.id == prediction.knockout_result_id
            ).first() if prediction.knockout_result_id else None
            
            # Create a temporary item dict for the update function
            item = {}
            
            # Update validity for both teams using the existing logic
            KnockPredRefactorService._update_team_validity(
                db, prediction, item, prediction.team1_id, True, "team_1", "is_team1_valid", "team1_is_valid",
                knockout_result, prediction.user_id
            )
            KnockPredRefactorService._update_team_validity(
                db, prediction, item, prediction.team2_id, False, "team_2", "is_team2_valid", "team2_is_valid",
                knockout_result, prediction.user_id
            )
        
        db.flush()
    
    @staticmethod
    def _update_team_validity(
        db: Session,
        prediction,
        item: Dict[str, Any],
        team_id: Optional[int],
        is_team1: bool,
        result_team_field: str,
        validity_field: str,
        item_field: str,
        knockout_result,
        user_id: int
    ) -> None:
        """Update team validity for a single team."""
        if not team_id:
            return
        
        is_valid = None
        if knockout_result:
            # Check if team matches result at the specified position
            result_team_id = getattr(knockout_result, result_team_field)
            is_valid = (result_team_id == team_id)
        else:
            # No result - check previous prediction
            is_valid = KnockPredRefactorService._check_team_valid_from_previous_prediction(
                db, team_id, prediction.template_match_id, user_id, is_team1=is_team1
            )
        
        # Update the prediction's validity field
        if is_valid is not None:
            setattr(prediction, validity_field, is_valid)
        # Only set if invalid (False), if None don't include the field
        if is_valid is False:
            item[item_field] = False

    @staticmethod
    def _check_prediction_correctness_and_validity(
        db: Session,
        prediction,
        item: Dict[str, Any],
        team1_id: Optional[int],
        team2_id: Optional[int],
        knockout_result,
        user_id: int
    ) -> None:
        """Check if prediction is correct (if match finished) and update team validity (if match not finished)."""
        # Check if match has been decided (has winner)
        if knockout_result and knockout_result.winner_team_id:
            # Match is finished - check if user predicted correctly
            item["is_correct"] = (prediction.winner_team_id == knockout_result.winner_team_id)
            # Don't check validity since match is decided - keep default True values
        else:
            # Match not finished - update team validity
            KnockPredRefactorService._update_team_validity(
                db, prediction, item, team1_id, True, "team_1", "is_team1_valid", "team1_is_valid",
                knockout_result, user_id
            )
            KnockPredRefactorService._update_team_validity(
                db, prediction, item, team2_id, False, "team_2", "is_team2_valid", "team2_is_valid",
                knockout_result, user_id
            )
            db.flush()

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
        predictions = DBPredRepository.get_knockout_predictions_by_user(db, user_id, stage, is_draft=is_draft)

        result: List[Dict[str, Any]] = []
        for prediction in predictions:
            # Prepare teams (handle draft mode if needed)
            team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team = (
                KnockPredRefactorService._prepare_draft_mode_teams(db, prediction, is_draft)
            )

            # Build base item
            item = KnockPredRefactorService._build_prediction_item(
                prediction, team1_id, team2_id, winner_team_id, team1, team2, winner_team, current_winner_team
            )

            # Get knockout result for validation/correctness check
            knockout_result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.id == prediction.knockout_result_id
            ).first() if prediction.knockout_result_id else None
            
            # Get validity from DB (read-only)
            item["team1_is_valid"] = getattr(prediction, "is_team1_valid", True)
            item["team2_is_valid"] = getattr(prediction, "is_team2_valid", True)
            
            # Check if match has been decided (has winner)
            if knockout_result and knockout_result.winner_team_id:
                # Match is finished - check if user predicted correctly
                item["is_correct"] = (prediction.winner_team_id == knockout_result.winner_team_id)

            # Add additional fields based on is_draft
            KnockPredRefactorService._add_additional_fields_to_item(item, prediction, is_draft)

            result.append(item)

        user_scores = None
        if not is_draft:
            user_scores = DBPredRepository.get_user_scores(db, user_id)

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
        current_template = DBPredRepository.get_match_template(
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
        next_template = DBPredRepository.get_match_template(db, next_match_id)
        if not next_template:
            return None
        
        # Find original prediction for this match to link draft to it
        original_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
            db, prediction.user_id, next_match_id, is_draft=False
        )
        knockout_pred_id = original_prediction.id if original_prediction else None
        
        # Create draft prediction
        draft = DBPredRepository.create_knockout_prediction(
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
        current_template = DBPredRepository.get_match_template(
            db, prediction.template_match_id
        )
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No next stage
        
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        # Find the next prediction (use same draft status as current prediction)
        next_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
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
            winner_team = DBPredRepository.get_team(db, prediction.winner_team_id)
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
        prediction = DBPredRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
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
        DBPredRepository.commit(db)
        
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
                    prediction = DBPredRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
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
            DBPredRepository.commit(db)
            
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
            team = DBPredRepository.get_team(db, team_id)
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
        
        combination = DBPredRepository.get_third_place_combination_by_hash(db, hash_key)
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
        templates = DBPredRepository.get_match_templates_by_stage(db, 'round32')
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
            group = DBPredRepository.get_group_by_name(db, group_letter)
            if not group:
                return None

            group_pred = DBPredRepository.get_group_prediction_by_user_and_group_id(db, user_id, group.id)
            if not group_pred:
                return None

            team = DBPredRepository.get_team(db, group_pred.third_place)
            return team

        # Iterate relevant templates and update predictions
        for template in relevant_templates:
            # Find the user's prediction for this match
            prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
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
        DBPredRepository.commit(db)

    @staticmethod
    def create_draft_from_prediction(db: Session, user_id: int, prediction_id: int) -> Dict[str, Any]:
        """
        Create a draft prediction by copying from existing prediction.
        Priority: result data first (teams, winner if exists), otherwise copy prediction as-is.
        Status is always copied from the original prediction.
        """
        # Get the original prediction
        prediction = DBPredRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")

        # If draft already exists, delete it first to recreate with cleaned teams
        existing_draft = DBPredRepository.get_knockout_prediction_by_user_and_match(
            db, user_id, prediction.template_match_id, is_draft=True
        )
        if existing_draft:
            db.delete(existing_draft)
            db.flush()

        # Do not recompute validity in draft creation; validity computed in get_knockout_predictions

        # Use result teams if exist; otherwise check validity and clean invalid teams
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

            # Set current_winner_team_id if status is yellow and winner differs from the draft teams
            current_winner_team_id = 0
            if prediction.status == PredictionStatus.MIGHT_CHANGE_PREDICT.value and original_winner_team_id:
                if original_winner_team_id != team1_id and original_winner_team_id != team2_id:
                    current_winner_team_id = original_winner_team_id

            # Winner in draft: keep original winner only if it matches one of the remaining teams, else 0
            winner_team_id = original_winner_team_id if original_winner_team_id in (team1_id, team2_id) else 0
        
        # Keep 0 values as-is (we use 0 as sentinel instead of None)

        # Create draft copy
        draft = DBPredRepository.create_knockout_prediction(
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
            status=PredictionStatus(prediction.status).value if hasattr(PredictionStatus, 'value') else prediction.status,
            current_winner_team_id=current_winner_team_id,
        )

        DBPredRepository.commit(db)
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
        predictions = DBPredRepository.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)

        created = 0
        skipped = 0
        for prediction in predictions:
            # Delete existing draft if exists (create_draft_from_prediction will recreate it)
            existing = DBPredRepository.get_knockout_prediction_by_user_and_match(
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
        drafts = DBPredRepository.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=True)
        deleted = 0
        for draft in drafts:
            db.delete(draft)
            deleted += 1
        db.commit()
        return {"success": True, "deleted": deleted}

    @staticmethod
    def delete_all_knockout_predictions_for_user(db: Session, user_id: int) -> Dict[str, Any]:
        """Delete all knockout predictions and third place predictions (not drafts) for a given user."""
        from models.predictions import ThirdPlacePrediction
        
        # Count and delete knockout predictions
        predictions = DBPredRepository.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)
        deleted_knockout = len(predictions)
        for prediction in predictions:
            db.delete(prediction)
        
        # Count and delete third place predictions
        deleted_third_place = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).count()
        DBPredRepository.delete_third_place_predictions_by_user(db, user_id)
        
        db.commit()
        return {
            "success": True, 
            "deleted_knockout": deleted_knockout,
            "deleted_third_place": deleted_third_place,
            "total_deleted": deleted_knockout + deleted_third_place
        }
