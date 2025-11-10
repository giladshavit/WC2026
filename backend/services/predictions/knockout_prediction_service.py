from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from models.results import KnockoutStageResult
from models.predictions import GroupStagePrediction
from .db_prediction_repository import DBPredRepository
from .shared import PredictionStatus


class KnockoutPredictionService:
    """Service for knockout prediction operations"""
    
    @staticmethod
    def get_knockout_predictions(db: Session, user_id: int, stage: Optional[str] = None, is_draft: bool = False) -> Dict[str, Any]:
        """
        Get all user's knockout predictions. If stage is provided, filter by that stage.
        If is_draft is True, returns draft predictions instead of regular ones.
        """
        try:
            predictions = DBPredRepository.get_knockout_predictions_by_user(db, user_id, stage, is_draft=is_draft)
            
            # Convert to list of dictionaries
            result = []
            for prediction in predictions:
                # Default to prediction data
                team1_id = prediction.team1_id
                team2_id = prediction.team2_id
                winner_team_id = prediction.winner_team_id
                team1 = prediction.team1
                team2 = prediction.team2
                winner_team = prediction.winner_team
                
                if is_draft:
                    # In draft mode, show result teams but keep user's predicted winner
                    # Use the knockout_result relationship that already exists on the prediction
                    knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
                    
                    if knockout_result:
                        # Use result teams if they exist (show actual teams that will play)
                        if knockout_result.team_1:
                            team1_id = knockout_result.team_1
                            team1 = knockout_result.team_1_obj
                        if knockout_result.team_2:
                            team2_id = knockout_result.team_2
                            team2 = knockout_result.team_2_obj
                        
                        # Keep the winner from the user's original prediction (so they know what they predicted)
                        # winner_team_id and winner_team remain from prediction (set above)
                
                prediction_dict = {
                    "id": prediction.id,
                    "user_id": prediction.user_id,
                    "knockout_result_id": prediction.knockout_result_id,
                    "template_match_id": prediction.template_match_id,
                    "stage": prediction.stage,
                    "team1_id": team1_id,
                    "team2_id": team2_id,
                    "winner_team_id": winner_team_id,
                    "status": prediction.status,
                    # Add team names, short names and flags if they exist
                    "team1_name": team1.name if team1 else None,
                    "team2_name": team2.name if team2 else None,
                    "winner_team_name": winner_team.name if winner_team else None,
                    "team1_short_name": team1.short_name if team1 else None,
                    "team2_short_name": team2.short_name if team2 else None,
                    "winner_team_short_name": winner_team.short_name if winner_team else None,
                    "team1_flag": team1.flag_url if team1 else None,
                    "team2_flag": team2.flag_url if team2 else None,
                    "winner_team_flag": winner_team.flag_url if winner_team else None
                }
                
                # Add fields that only exist in regular predictions (not draft)
                if not is_draft:
                    prediction_dict["points"] = prediction.points
                    prediction_dict["is_editable"] = prediction.is_editable
                    prediction_dict["created_at"] = prediction.created_at
                    prediction_dict["updated_at"] = prediction.updated_at
                else:
                    # For draft, add knockout_pred_id if exists
                    if hasattr(prediction, 'knockout_pred_id'):
                        prediction_dict["knockout_pred_id"] = prediction.knockout_pred_id
                
                result.append(prediction_dict)
            
            # Get user scores (only for regular predictions)
            user_scores = None
            if not is_draft:
                user_scores = DBPredRepository.get_user_scores(db, user_id)
            
            return {
                "predictions": result,
                "knockout_score": user_scores.knockout_score if user_scores else None
            }
            
        except Exception as e:
            raise Exception(f"Error fetching knockout predictions: {str(e)}")
    
    @staticmethod
    def update_knockout_prediction_winner(db: Session, prediction_id: int, request, is_draft: bool = False) -> Dict[str, Any]:
        """
        Update a knockout prediction - choose winner and update subsequent stages
        If is_draft is True, updates draft prediction instead of regular one.
        """
        try:
            # 1. Validation and data loading
            prediction = KnockoutPredictionService.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
            winner_team_id = KnockoutPredictionService._get_winner_team_id(prediction, request.winner_team_number)
            
            if not winner_team_id:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to resolve winner team ID"
                )
            
            # 2. Call the internal function
            result = KnockoutPredictionService.update_knockout_prediction_with_winner(db, prediction, winner_team_id, is_draft=is_draft)
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error updating prediction: {str(e)}"
            )
    
    @staticmethod
    def update_knockout_prediction_with_winner(db: Session, prediction, winner_team_id: Optional[int] = None, is_draft: bool = False) -> Dict[str, Any]:
        """
        Internal function to update a knockout prediction with a new winner
        
        Args:
            db: Session
            prediction: prediction to update
            winner_team_id: ID of the winner team (optional - can be None)
            is_draft: If True, updates draft prediction instead of regular one
        """
        # 1. Check if need to create new prediction for next stage
        template = DBPredRepository.get_match_template(db, prediction.template_match_id)
        if not template:
            raise HTTPException(status_code=404, detail="Match template not found")
        
        next_prediction = KnockoutPredictionService._create_next_stage_if_needed(db, prediction, template, is_draft=is_draft)
        
        # 2. Check if winner changed
        if prediction.winner_team_id == winner_team_id and winner_team_id is not None:
            DBPredRepository.set_prediction_status(prediction, PredictionStatus.PREDICTED)
            DBPredRepository.commit(db)
            return KnockoutPredictionService._create_success_response(db, prediction, "Winner did not change", changed=False)
        
        # 3. Update winner
        previous_winner_id = prediction.winner_team_id
        DBPredRepository.update_knockout_prediction(
            db, prediction, winner_team_id=winner_team_id
        )
        # Only update updated_at for regular predictions (draft doesn't have this field)
        if not is_draft:
            prediction.updated_at = datetime.utcnow()
        
        # 4. Update status
        new_status = PredictionStatus.PREDICTED if winner_team_id else PredictionStatus.MUST_CHANGE_PREDICT
        DBPredRepository.set_prediction_status(prediction, new_status)
        
        # 5. Update next stages
        if next_prediction:
            KnockoutPredictionService._update_next_stages(db, prediction, previous_winner_id, is_draft=is_draft)
        
        # 6. Save
        DBPredRepository.commit(db)
        
        return KnockoutPredictionService._create_success_response(db, prediction, "Prediction updated successfully", changed=True)
    
    @staticmethod
    def get_knockout_prediction_by_id(db: Session, prediction_id: int, is_draft: bool = False):
        """Finds knockout prediction by ID"""
        prediction = DBPredRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=is_draft)
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="Prediction not found"
            )
        
        return prediction
    
    @staticmethod
    def _get_winner_team_id(prediction, winner_team_number: int) -> Optional[int]:
        """Returns the winner team ID by team number"""
        if winner_team_number == 1:
            return prediction.team1_id
        elif winner_team_number == 2:
            return prediction.team2_id
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid team number (must be 1 or 2)"
            )
    
    @staticmethod
    def _create_success_response(db: Session, prediction, message: str, request=None, changed: bool = True) -> Dict[str, Any]:
        """Creates success response"""
        # Find winner team name
        winner_team = None
        if prediction.winner_team_id:
            winner_team = DBPredRepository.get_team(db, prediction.winner_team_id)
        
        winner_team_name = winner_team.name if winner_team else (request.winner_team_name if request else None)
        
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
            response["prediction"]["updated_at"] = prediction.updated_at
        
        return response
    
    @staticmethod
    def _update_next_stages(db: Session, prediction, previous_winner_id: Optional[int], is_draft: bool = False):
        """
        Update next stages:
        1. Place new winner into the next match
        2. Remove the previous winner from all subsequent stages
        """
        # Find the next prediction and its position
        next_prediction, position = KnockoutPredictionService._find_next_knockout_prediction_and_position(db, prediction, is_draft=is_draft)
        
        # 1. Update the next match with the new winner
        KnockoutPredictionService._update_next_stage_prediction(db, prediction, next_prediction, position)
        
        # 2. Remove the previous winner from all subsequent stages
        if previous_winner_id and next_prediction:
            KnockoutPredictionService._remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id, is_draft=is_draft)
    
    @staticmethod
    def _find_next_knockout_prediction_and_position(db: Session, prediction, is_draft: bool = False) -> tuple:
        """
        Find the next prediction in the knockout chain and its position
        Returns: tuple (next_prediction, position) or (None, None) if not found
        """
        # Find the template of the current prediction
        current_template = DBPredRepository.get_match_template(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No destination
        
        # Use the new fields
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position
        
        # Find the next prediction
        next_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(db, prediction.user_id, next_match_id, is_draft=is_draft)
        
        return next_prediction, position
    
    @staticmethod
    def _create_next_stage_if_needed(db: Session, prediction, template, is_draft: bool = False) -> Optional[Any]:
        """
        Check whether a next-stage prediction is needed and create it if required
        Returns: KnockoutStagePrediction or KnockoutStagePredictionDraft or None
        """
        if not template.winner_next_knockout_match:
            return None
        
        # Use the new fields
        next_match_id = template.winner_next_knockout_match
        
        # Check whether a prediction already exists for the next match
        existing_next_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
            db, prediction.user_id, next_match_id, is_draft=is_draft
        )
        
        if existing_next_prediction:
            return existing_next_prediction
        
        # Create a new prediction for the next stage
        next_prediction = KnockoutPredictionService._create_next_stage_prediction(db, prediction, next_match_id, is_draft=is_draft)
        if next_prediction:
            print(f"Created new next-stage prediction: {next_prediction.id}")
        return next_prediction
    
    @staticmethod
    def _create_next_stage_prediction(db: Session, prediction, next_match_id, is_draft: bool = False) -> Optional[Any]:
        """
        Create a new prediction for the next stage in the knockout chain
        """
        # Find the matching result
        result = DBPredRepository.get_knockout_stage_result_by_match(db, next_match_id)
        
        if not result:
            print(f"KnockoutStageResult not found for match_id {next_match_id}")
            return None
        
        # Find the template of the next stage
        next_template = DBPredRepository.get_match_template(db, next_match_id)
        
        if not next_template:
            print(f"MatchTemplate not found for match_id {next_match_id}")
            return None
        
        # For draft, find original prediction if exists
        knockout_pred_id = None
        if is_draft:
            # Try to find original prediction for this match
            original_prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(
                db, prediction.user_id, next_match_id, is_draft=False
            )
            if original_prediction:
                knockout_pred_id = original_prediction.id
        
        # Create a new prediction
        new_prediction = DBPredRepository.create_knockout_prediction(
            db, prediction.user_id, result.id, next_match_id, next_template.stage, 
            winner_team_id=None, knockout_pred_id=knockout_pred_id, is_draft=is_draft
        )
        DBPredRepository.flush(db)  # To get the ID
        
        # Update status to MUST_CHANGE_PREDICT
        DBPredRepository.set_prediction_status(new_prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        return new_prediction
    
    @staticmethod
    def _remove_prev_winner_from_next_stages(db: Session, prediction, previous_winner_id: int, is_draft: bool = False):
        """
        Remove the previous winner team from all subsequent stages in the chain
        """
        if not previous_winner_id or not prediction:
            return
        
        # Check: if current winner differs from the team to remove - do nothing
        if prediction.winner_team_id and prediction.winner_team_id != previous_winner_id:
            # Update status to MIGHT_CHANGE_PREDICT
            DBPredRepository.set_prediction_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            return
        
        # Remove winner
        DBPredRepository.update_knockout_prediction(db, prediction, winner_team_id=0)
        print(f"Removed winner {previous_winner_id} from prediction {prediction.id}")
        
        # Update status to MUST_CHANGE_PREDICT
        DBPredRepository.set_prediction_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        # Find the next prediction in the chain
        next_prediction, next_position = KnockoutPredictionService._find_next_knockout_prediction_and_position(db, prediction, is_draft=is_draft)
        
        if next_prediction and next_position:
            # Call update_next_stage_prediction
            KnockoutPredictionService._update_next_stage_prediction(db, prediction, next_prediction, next_position)
        
        # Call recursively with the next prediction
        if next_prediction:
            KnockoutPredictionService._remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id, is_draft=is_draft)
    
    @staticmethod
    def _update_next_stage_prediction(db: Session, prediction, next_prediction, position: int):
        """
        Update the next prediction in the knockout chain with the new winner
        """
        if not next_prediction or not position:
            return  # No destination or template or position not found
        
        # Update the appropriate team field
        if position == 1:
            DBPredRepository.update_knockout_prediction(db, next_prediction, team1_id=prediction.winner_team_id)
        elif position == 2:
            DBPredRepository.update_knockout_prediction(db, next_prediction, team2_id=prediction.winner_team_id)
        
        print(f"Updated prediction {next_prediction.id} - position {position} with team {prediction.winner_team_id}")
    
    @staticmethod
    def update_knockout_prediction_teams(db: Session, prediction, old_team_id: int, new_team_id: int):
        """Update knockout prediction teams (used when group predictions change)"""
        print(f"🔧 [DEBUG] update_knockout_prediction_teams called: prediction {prediction.id}, {old_team_id} -> {new_team_id}")
        if old_team_id == new_team_id:
            print(f"✅ [DEBUG] No change needed, teams are the same")
            return
        
        # Perform the swap
        if prediction.team1_id == old_team_id:
            DBPredRepository.update_knockout_prediction(db, prediction, team1_id=new_team_id)
        elif prediction.team2_id == old_team_id:
            print(f"🔄 [DEBUG] Before update: team2_id = {prediction.team2_id}")
            DBPredRepository.update_knockout_prediction(db, prediction, team2_id=new_team_id)
            print(f"🔄 [DEBUG] After update: team2_id = {prediction.team2_id}")
        else:
            print(f"❌ [DEBUG] No matching team found for old_team_id: {old_team_id}")
            return
        
        print(f"🔄 [DEBUG] Updated prediction {prediction.id}: team1_id={prediction.team1_id}, team2_id={prediction.team2_id}")
        
        if prediction.winner_team_id == old_team_id:
            print(f"🔄 [DEBUG] Winner team changed, clearing winner")
            result = KnockoutPredictionService.update_knockout_prediction_with_winner(db, prediction, None)
            print(f"✅ [DEBUG] Winner cleared (will be committed by parent function)")
            return result
        else:
            if prediction.winner_team_id:
                print(f"🔄 [DEBUG] Setting status to MIGHT_CHANGE_PREDICT")
                DBPredRepository.set_prediction_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            
            print(f"✅ [DEBUG] Team updated (will be committed by parent function)")
    
    @staticmethod
    def update_batch_knockout_predictions(db: Session, user_id: int, 
                                         predictions_data: List[Dict[str, Any]], is_draft: bool = False) -> Dict[str, Any]:
        """
        Update multiple knockout predictions at once with penalty calculation
        If is_draft is True, updates draft predictions instead of regular ones.
        """
        from fastapi import HTTPException
        from services.scoring_service import ScoringService
        
        try:
            updated_predictions = []
            errors = []
            total_changes = 0
            
            for prediction_data in predictions_data:
                # Handle both dict and Pydantic model
                if hasattr(prediction_data, 'prediction_id'):
                    # Pydantic model
                    prediction_id = prediction_data.prediction_id
                    winner_team_number = prediction_data.winner_team_number
                    winner_team_name = prediction_data.winner_team_name
                else:
                    # Dictionary
                    prediction_id = prediction_data.get("prediction_id")
                    winner_team_number = prediction_data.get("winner_team_number")
                    winner_team_name = prediction_data.get("winner_team_name")
                
                if not all([prediction_id, winner_team_number, winner_team_name]):
                    errors.append(f"Missing data for prediction {prediction_id}")
                    continue
                
                # Create request object for the existing function
                request = type('Request', (), {
                    'winner_team_number': winner_team_number,
                    'winner_team_name': winner_team_name
                })()
                
                # Use existing function to update the prediction
                try:
                    result = KnockoutPredictionService.update_knockout_prediction_winner(db, prediction_id, request, is_draft=is_draft)
                    
                    if "error" in result:
                        errors.append(f"Error updating prediction {prediction_id}: {result['error']}")
                    else:
                        updated_predictions.append(result)
                        if result.get("changed", False):
                            total_changes += 1
                except HTTPException as e:
                    errors.append(f"HTTP Error updating prediction {prediction_id}: {e.detail}")
                except Exception as e:
                    errors.append(f"Error updating prediction {prediction_id}: {str(e)}")
            
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
    def update_knockout_predictions_by_new_third_places_qualified(db: Session, user_id: int, advancing_team_ids: List[int]):
        """Update knockout predictions when third place teams change"""
        from models.team import Team
        from models.groups import Group
        from models.predictions import GroupStagePrediction
        from models.third_place_combinations import ThirdPlaceCombination
        from models.matches_template import MatchTemplate
        
        print(f"🔧 [DEBUG] update_knockout_predictions_by_new_third_places_qualified called for user_id={user_id}")
        print(f"🔧 [DEBUG] advancing_team_ids: {advancing_team_ids}")
        
        # Build hash key and find combination
        hash_key = KnockoutPredictionService._create_new_hash_key(db, advancing_team_ids)
        print(f"🔧 [DEBUG] Generated hash_key: {hash_key}")
        
        combination = DBPredRepository.get_third_place_combination_by_hash(db, hash_key)
        if not combination:
            print(f"❌ [DEBUG] No combination found for hash_key: {hash_key}")
            return
        
        print(f"✅ [DEBUG] Found combination: {combination.id}")

        # Same mapping as the script
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

        # Relevant Round of 32 templates: only where team_2 uses third-place source
        templates = DBPredRepository.get_match_templates_by_stage(db, 'round32')
        relevant_templates = [t for t in templates if t.team_2.startswith('3rd_team_')]

        # Helper: new_team2 for third-place sources
        def resolve_third_place_team(team_source: str):
            print(f"🔧 [DEBUG] resolve_third_place_team called with team_source: {team_source}")
            column_name = third_team_mapping[team_source]
            print(f"🔧 [DEBUG] column_name: {column_name}")
            
            third_place_source = getattr(combination, column_name)  # e.g., '3A'
            print(f"🔧 [DEBUG] third_place_source: {third_place_source}")
            
            group_letter = third_place_source[1]  # 'A'
            print(f"🔧 [DEBUG] group_letter: {group_letter}")

            group = DBPredRepository.get_group_by_name(db, group_letter)
            if not group:
                print(f"❌ [DEBUG] No group found for letter: {group_letter}")
                return None
            print(f"✅ [DEBUG] Found group: {group.id} ({group.name})")

            group_pred = DBPredRepository.get_group_prediction_by_user_and_group_id(db, user_id, group.id)
            if not group_pred:
                print(f"❌ [DEBUG] No group prediction found for group_id: {group.id}")
                return None
            print(f"✅ [DEBUG] Found group prediction, third_place: {group_pred.third_place}")

            team = DBPredRepository.get_team(db, group_pred.third_place)
            if team:
                print(f"✅ [DEBUG] Found team: {team.id} ({team.name})")
            else:
                print(f"❌ [DEBUG] No team found for id: {group_pred.third_place}")
            return team

        print(f"🔧 [DEBUG] Found {len(relevant_templates)} relevant templates")
        
        # Iterate relevant templates and update predictions
        for template in relevant_templates:
            print(f"🔧 [DEBUG] Processing template {template.id}: {template.team_1} vs {template.team_2}")
            
            # Find the user's prediction for this match
            prediction = DBPredRepository.get_knockout_prediction_by_user_and_match(db, user_id, template.id)
            if not prediction:
                print(f"❌ [DEBUG] No prediction found for template {template.id}")
                continue

            old_team2_id = prediction.team2_id
            print(f"🔧 [DEBUG] Current team2_id: {old_team2_id}")

            # Compute the new team2 from the combination
            new_team = resolve_third_place_team(template.team_2)
            new_team2_id = new_team.id if new_team else None
            if not new_team2_id:
                print(f"❌ [DEBUG] Could not resolve new team for {template.team_2}")
                continue

            print(f"🔧 [DEBUG] New team2_id: {new_team2_id}")

            if old_team2_id == new_team2_id:
                print(f"✅ [DEBUG] No change needed for template {template.id}")
                continue

            print(f"🔄 [DEBUG] Updating prediction {prediction.id}: {old_team2_id} -> {new_team2_id}")
            # Apply the foundational updater
            KnockoutPredictionService.update_knockout_prediction_teams(db, prediction, old_team2_id, new_team2_id)
        
        # Commit all changes at the end
        DBPredRepository.commit(db)
        print(f"✅ [DEBUG] Committed all knockout prediction updates")
        print(f"✅ [DEBUG] update_knockout_predictions_by_new_third_places_qualified completed")
    
    @staticmethod
    def _create_new_hash_key(db: Session, advancing_team_ids: List[int]) -> str:
        """Create hash key from advancing team IDs"""
        from models.team import Team
        
        print(f"🔧 [DEBUG] create_new_hash_key called with advancing_team_ids: {advancing_team_ids}")
        letters = []
        for team_id in advancing_team_ids:
            team = DBPredRepository.get_team(db, team_id)
            if team and team.group_letter:
                letters.append(team.group_letter)
                print(f"🔧 [DEBUG] Team {team_id} ({team.name}) -> group_letter: {team.group_letter}")
            else:
                print(f"❌ [DEBUG] Team {team_id} not found or no group_letter")
        
        hash_key = ''.join(sorted(letters))
        print(f"🔧 [DEBUG] Generated hash_key: {hash_key} from letters: {letters}")
        return hash_key
    
    @staticmethod
    def create_draft_from_prediction(db: Session, user_id: int, prediction_id: int) -> Dict[str, Any]:
        """
        Create a draft prediction by copying from existing prediction.
        Priority: result data first, then prediction data.
        """
        try:
            # Get the original prediction
            prediction = DBPredRepository.get_knockout_prediction_by_id(db, prediction_id, is_draft=False)
            if not prediction:
                raise HTTPException(status_code=404, detail="Prediction not found")
            
            # Check if draft already exists
            existing_draft = DBPredRepository.get_knockout_prediction_by_user_and_match(
                db, user_id, prediction.template_match_id, is_draft=True
            )
            if existing_draft:
                # Return existing draft
                return {
                    "success": True,
                    "message": "Draft already exists",
                    "draft_id": existing_draft.id
                }
            
            # Get the result if it exists
            knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
            
            # Simple copy: if result exists, use result teams; otherwise copy prediction as-is
            if knockout_result and knockout_result.team_1 and knockout_result.team_2:
                # Use result teams
                team1_id = knockout_result.team_1
                team2_id = knockout_result.team_2
                # Use result winner if exists, otherwise keep prediction winner
                winner_team_id = knockout_result.winner_team_id if knockout_result.winner_team_id else prediction.winner_team_id
            else:
                # No result - simple copy of prediction data (dumb copy)
                team1_id = prediction.team1_id
                team2_id = prediction.team2_id
                winner_team_id = prediction.winner_team_id
            
            # Create draft prediction with status from original
            draft_prediction = DBPredRepository.create_knockout_prediction(
                db=db,
                user_id=user_id,
                knockout_result_id=prediction.knockout_result_id,
                template_match_id=prediction.template_match_id,
                stage=prediction.stage,
                team1_id=team1_id,
                team2_id=team2_id,
                winner_team_id=winner_team_id,
                knockout_pred_id=prediction.id,
                status=prediction.status,  # Copy status from original prediction
                is_draft=True
            )
            
            DBPredRepository.commit(db)
            
            return {
                "success": True,
                "message": "Draft prediction created successfully",
                "draft_id": draft_prediction.id
            }
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error creating draft prediction: {str(e)}"
            )
    
    @staticmethod
    def create_all_drafts_from_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Create draft predictions for all user's knockout predictions.
        Priority: result data first, then prediction data.
        """
        try:
            # Get all user's predictions
            predictions = DBPredRepository.get_knockout_predictions_by_user(db, user_id, is_draft=False)
            
            created_count = 0
            existing_count = 0
            errors = []
            draft_predictions_map = {}  # Map template_match_id -> (draft_prediction, original_prediction)
            
            # Step 1: Create all drafts without status
            for prediction in predictions:
                try:
                    # Check if draft already exists
                    existing_draft = DBPredRepository.get_knockout_prediction_by_user_and_match(
                        db, user_id, prediction.template_match_id, is_draft=True
                    )
                    if existing_draft:
                        existing_count += 1
                        draft_predictions_map[prediction.template_match_id] = (existing_draft, prediction)
                        continue
                    
                    # Get the result if it exists
                    knockout_result = prediction.knockout_result if hasattr(prediction, 'knockout_result') else None
                    
                    # Simple copy: if result exists, use result teams; otherwise copy prediction as-is
                    if knockout_result and knockout_result.team_1 and knockout_result.team_2:
                        # Use result teams
                        team1_id = knockout_result.team_1
                        team2_id = knockout_result.team_2
                        # Use result winner if exists, otherwise keep prediction winner
                        winner_team_id = knockout_result.winner_team_id if knockout_result.winner_team_id else prediction.winner_team_id
                    else:
                        # No result - simple copy of prediction data (dumb copy)
                        team1_id = prediction.team1_id
                        team2_id = prediction.team2_id
                        winner_team_id = prediction.winner_team_id
                    
                    # Create draft prediction WITHOUT status (will be set later)
                    draft_prediction = DBPredRepository.create_knockout_prediction(
                        db=db,
                        user_id=user_id,
                        knockout_result_id=prediction.knockout_result_id,
                        template_match_id=prediction.template_match_id,
                        stage=prediction.stage,
                        team1_id=team1_id,
                        team2_id=team2_id,
                        winner_team_id=winner_team_id,
                        knockout_pred_id=prediction.id,
                        status=None,  # No status at this stage
                        is_draft=True
                    )
                    
                    draft_predictions_map[prediction.template_match_id] = (draft_prediction, prediction)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Error creating draft for prediction {prediction.id}: {str(e)}")
            
            # Step 2: Go through round32 drafts and clear winners for red status predictions
            round32_drafts = [(draft, orig) for draft, orig in draft_predictions_map.values() 
                             if draft and draft.stage == 'round32']
            
            red_round32_template_ids = set()  # Track which round32 predictions had red status
            for draft_pred, original_pred in round32_drafts:
                if original_pred and original_pred.status == PredictionStatus.MUST_CHANGE_PREDICT.value:
                    # Update winner to 0 (clears winner) for red status predictions in round32
                    KnockoutPredictionService.update_knockout_prediction_with_winner(
                        db, draft_pred, winner_team_id=0, is_draft=True
                    )
                    red_round32_template_ids.add(draft_pred.template_match_id)
            
            # Step 3: Update all winners from original predictions (except red round32 ones)
            for template_match_id, (draft_pred, original_pred) in draft_predictions_map.items():
                if draft_pred and original_pred:
                    # Skip updating winners for red round32 predictions (keep them as None)
                    if template_match_id not in red_round32_template_ids:
                        DBPredRepository.update_knockout_prediction(
                            db, draft_pred, winner_team_id=original_pred.winner_team_id
                        )
            
            # Step 4: Update all statuses from original predictions
            for template_match_id, (draft_pred, original_pred) in draft_predictions_map.items():
                if draft_pred and original_pred:
                    draft_pred.status = original_pred.status
            
            DBPredRepository.commit(db)
            
            return {
                "success": True,
                "message": f"Created {created_count} draft predictions, {existing_count} already existed",
                "created": created_count,
                "existing": existing_count,
                "errors": errors if errors else None
            }
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error creating draft predictions: {str(e)}"
            )
    
    @staticmethod
    def delete_all_drafts_for_user(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Delete all draft predictions for a specific user.
        Called when exiting edit mode.
        """
        try:
            from models.predictions import KnockoutStagePredictionDraft
            
            # Get all draft predictions for this user
            draft_predictions = db.query(KnockoutStagePredictionDraft).filter(
                KnockoutStagePredictionDraft.user_id == user_id
            ).all()
            
            count = len(draft_predictions)
            
            # Delete all drafts
            for draft in draft_predictions:
                db.delete(draft)
            
            DBPredRepository.commit(db)
            
            return {
                "success": True,
                "message": f"Deleted {count} draft predictions",
                "deleted_count": count
            }
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error deleting draft predictions: {str(e)}"
            )

