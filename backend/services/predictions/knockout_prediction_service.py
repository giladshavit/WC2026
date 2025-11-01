from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from models.results import KnockoutStageResult
from models.predictions import GroupStagePrediction
from .prediction_repository import PredictionRepository
from .shared import PredictionStatus


class KnockoutPredictionService:
    """Service for knockout prediction operations"""
    
    @staticmethod
    def get_knockout_predictions(db: Session, user_id: int, stage: Optional[str] = None) -> Dict[str, Any]:
        """
        Get all user's knockout predictions. If stage is provided, filter by that stage.
        """
        try:
            predictions = PredictionRepository.get_knockout_predictions_by_user(db, user_id, stage)
            
            # Convert to list of dictionaries
            result = []
            for prediction in predictions:
                result.append({
                    "id": prediction.id,
                    "user_id": prediction.user_id,
                    "knockout_result_id": prediction.knockout_result_id,
                    "template_match_id": prediction.template_match_id,
                    "stage": prediction.stage,
                    "team1_id": prediction.team1_id,
                    "team2_id": prediction.team2_id,
                    "winner_team_id": prediction.winner_team_id,
                    "status": prediction.status,
                    "points": prediction.points,
                    "is_editable": prediction.is_editable,
                    "created_at": prediction.created_at,
                    "updated_at": prediction.updated_at,
                    # Add team names, short names and flags if they exist
                    "team1_name": prediction.team1.name if prediction.team1 else None,
                    "team2_name": prediction.team2.name if prediction.team2 else None,
                    "winner_team_name": prediction.winner_team.name if prediction.winner_team else None,
                    "team1_short_name": prediction.team1.short_name if prediction.team1 else None,
                    "team2_short_name": prediction.team2.short_name if prediction.team2 else None,
                    "winner_team_short_name": prediction.winner_team.short_name if prediction.winner_team else None,
                    "team1_flag": prediction.team1.flag_url if prediction.team1 else None,
                    "team2_flag": prediction.team2.flag_url if prediction.team2 else None,
                    "winner_team_flag": prediction.winner_team.flag_url if prediction.winner_team else None
                })
            
            # Get user scores
            user_scores = PredictionRepository.get_user_scores(db, user_id)
            
            return {
                "predictions": result,
                "knockout_score": user_scores.knockout_score if user_scores else None
            }
            
        except Exception as e:
            raise Exception(f"Error fetching knockout predictions: {str(e)}")
    
    @staticmethod
    def update_knockout_prediction_winner(db: Session, prediction_id: int, request) -> Dict[str, Any]:
        """
        Update a knockout prediction - choose winner and update subsequent stages
        """
        try:
            # 1. Validation and data loading
            prediction = KnockoutPredictionService.get_knockout_prediction_by_id(db, prediction_id)
            winner_team_id = KnockoutPredictionService._get_winner_team_id(prediction, request.winner_team_number)
            
            if not winner_team_id:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to resolve winner team ID"
                )
            
            # 2. Call the internal function
            result = KnockoutPredictionService.update_knockout_prediction_with_winner(db, prediction, winner_team_id)
            
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
    def update_knockout_prediction_with_winner(db: Session, prediction, winner_team_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Internal function to update a knockout prediction with a new winner
        
        Args:
            db: Session
            prediction: prediction to update
            winner_team_id: ID of the winner team (optional - can be None)
        """
        # 1. Check if need to create new prediction for next stage
        template = PredictionRepository.get_match_template(db, prediction.template_match_id)
        if not template:
            raise HTTPException(status_code=404, detail="Match template not found")
        
        next_prediction = KnockoutPredictionService._create_next_stage_if_needed(db, prediction, template)
        
        # 2. Check if winner changed
        if prediction.winner_team_id == winner_team_id and winner_team_id is not None:
            PredictionRepository.set_prediction_status(prediction, PredictionStatus.PREDICTED)
            PredictionRepository.commit(db)
            return KnockoutPredictionService._create_success_response(db, prediction, "Winner did not change", changed=False)
        
        # 3. Update winner
        previous_winner_id = prediction.winner_team_id
        PredictionRepository.update_knockout_prediction(
            db, prediction, winner_team_id=winner_team_id
        )
        prediction.updated_at = datetime.utcnow()
        
        # 4. Update status
        new_status = PredictionStatus.PREDICTED if winner_team_id else PredictionStatus.MUST_CHANGE_PREDICT
        PredictionRepository.set_prediction_status(prediction, new_status)
        
        # 5. Update next stages
        if next_prediction:
            KnockoutPredictionService._update_next_stages(db, prediction, previous_winner_id)
        
        # 6. Save
        PredictionRepository.commit(db)
        
        return KnockoutPredictionService._create_success_response(db, prediction, "Prediction updated successfully", changed=True)
    
    @staticmethod
    def get_knockout_prediction_by_id(db: Session, prediction_id: int):
        """Finds knockout prediction by ID"""
        prediction = PredictionRepository.get_knockout_prediction_by_id(db, prediction_id)
        
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
            winner_team = PredictionRepository.get_team(db, prediction.winner_team_id)
        
        winner_team_name = winner_team.name if winner_team else (request.winner_team_name if request else None)
        
        return {
            "success": True,
            "changed": changed,
            "message": message,
            "prediction": {
                "id": prediction.id,
                "winner_team_id": prediction.winner_team_id,
                "winner_team_name": winner_team_name,
                "updated_at": prediction.updated_at
            }
        }
    
    @staticmethod
    def _update_next_stages(db: Session, prediction, previous_winner_id: Optional[int]):
        """
        Update next stages:
        1. Place new winner into the next match
        2. Remove the previous winner from all subsequent stages
        """
        # Find the next prediction and its position
        next_prediction, position = KnockoutPredictionService._find_next_knockout_prediction_and_position(db, prediction)
        
        # 1. Update the next match with the new winner
        KnockoutPredictionService._update_next_stage_prediction(db, prediction, next_prediction, position)
        
        # 2. Remove the previous winner from all subsequent stages
        if previous_winner_id and next_prediction:
            KnockoutPredictionService._remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)
    
    @staticmethod
    def _find_next_knockout_prediction_and_position(db: Session, prediction) -> tuple:
        """
        Find the next prediction in the knockout chain and its position
        Returns: tuple (next_prediction, position) or (None, None) if not found
        """
        # Find the template of the current prediction
        current_template = PredictionRepository.get_match_template(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No destination
        
        # Use the new fields
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position
        
        # Find the next prediction
        next_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(db, prediction.user_id, next_match_id)
        
        return next_prediction, position
    
    @staticmethod
    def _create_next_stage_if_needed(db: Session, prediction, template) -> Optional[Any]:
        """
        Check whether a next-stage prediction is needed and create it if required
        Returns: KnockoutStagePrediction or None
        """
        if not template.winner_next_knockout_match:
            return None
        
        # Use the new fields
        next_match_id = template.winner_next_knockout_match
        
        # Check whether a prediction already exists for the next match
        existing_next_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(
            db, prediction.user_id, next_match_id
        )
        
        if existing_next_prediction:
            return existing_next_prediction
        
        # Create a new prediction for the next stage
        next_prediction = KnockoutPredictionService._create_next_stage_prediction(db, prediction, next_match_id)
        if next_prediction:
            print(f"Created new next-stage prediction: {next_prediction.id}")
        return next_prediction
    
    @staticmethod
    def _create_next_stage_prediction(db: Session, prediction, next_match_id) -> Optional[Any]:
        """
        Create a new prediction for the next stage in the knockout chain
        """
        # Find the matching result
        result = PredictionRepository.get_knockout_stage_result_by_match(db, next_match_id)
        
        if not result:
            print(f"KnockoutStageResult not found for match_id {next_match_id}")
            return None
        
        # Find the template of the next stage
        next_template = PredictionRepository.get_match_template(db, next_match_id)
        
        if not next_template:
            print(f"MatchTemplate not found for match_id {next_match_id}")
            return None
        
        # Create a new prediction
        new_prediction = PredictionRepository.create_knockout_prediction(
            db, prediction.user_id, result.id, next_match_id, next_template.stage, winner_team_id=None
        )
        PredictionRepository.flush(db)  # To get the ID
        
        # Update status to MUST_CHANGE_PREDICT
        PredictionRepository.set_prediction_status(new_prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        return new_prediction
    
    @staticmethod
    def _remove_prev_winner_from_next_stages(db: Session, prediction, previous_winner_id: int):
        """
        Remove the previous winner team from all subsequent stages in the chain
        """
        if not previous_winner_id or not prediction:
            return
        
        # Check: if current winner differs from the team to remove - do nothing
        if prediction.winner_team_id and prediction.winner_team_id != previous_winner_id:
            # Update status to MIGHT_CHANGE_PREDICT
            PredictionRepository.set_prediction_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            return
        
        # Remove winner
        PredictionRepository.update_knockout_prediction(db, prediction, winner_team_id=None)
        print(f"Removed winner {previous_winner_id} from prediction {prediction.id}")
        
        # Update status to MUST_CHANGE_PREDICT
        PredictionRepository.set_prediction_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        # Find the next prediction in the chain
        next_prediction, next_position = KnockoutPredictionService._find_next_knockout_prediction_and_position(db, prediction)
        
        if next_prediction and next_position:
            # Call update_next_stage_prediction
            KnockoutPredictionService._update_next_stage_prediction(db, prediction, next_prediction, next_position)
        
        # Call recursively with the next prediction
        if next_prediction:
            KnockoutPredictionService._remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)
    
    @staticmethod
    def _update_next_stage_prediction(db: Session, prediction, next_prediction, position: int):
        """
        Update the next prediction in the knockout chain with the new winner
        """
        if not next_prediction or not position:
            return  # No destination or template or position not found
        
        # Update the appropriate team field
        if position == 1:
            PredictionRepository.update_knockout_prediction(db, next_prediction, team1_id=prediction.winner_team_id)
        elif position == 2:
            PredictionRepository.update_knockout_prediction(db, next_prediction, team2_id=prediction.winner_team_id)
        
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
            PredictionRepository.update_knockout_prediction(db, prediction, team1_id=new_team_id)
        elif prediction.team2_id == old_team_id:
            print(f"🔄 [DEBUG] Before update: team2_id = {prediction.team2_id}")
            PredictionRepository.update_knockout_prediction(db, prediction, team2_id=new_team_id)
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
                PredictionRepository.set_prediction_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            
            print(f"✅ [DEBUG] Team updated (will be committed by parent function)")
    
    @staticmethod
    def update_batch_knockout_predictions(db: Session, user_id: int, 
                                         predictions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Update multiple knockout predictions at once with penalty calculation
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
                    result = KnockoutPredictionService.update_knockout_prediction_winner(db, prediction_id, request)
                    
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
        
        combination = PredictionRepository.get_third_place_combination_by_hash(db, hash_key)
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
        templates = PredictionRepository.get_match_templates_by_stage(db, 'round32')
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

            group = PredictionRepository.get_group_by_name(db, group_letter)
            if not group:
                print(f"❌ [DEBUG] No group found for letter: {group_letter}")
                return None
            print(f"✅ [DEBUG] Found group: {group.id} ({group.name})")

            group_pred = PredictionRepository.get_group_prediction_by_user_and_group_id(db, user_id, group.id)
            if not group_pred:
                print(f"❌ [DEBUG] No group prediction found for group_id: {group.id}")
                return None
            print(f"✅ [DEBUG] Found group prediction, third_place: {group_pred.third_place}")

            team = PredictionRepository.get_team(db, group_pred.third_place)
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
            prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(db, user_id, template.id)
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
        PredictionRepository.commit(db)
        print(f"✅ [DEBUG] Committed all knockout prediction updates")
        print(f"✅ [DEBUG] update_knockout_predictions_by_new_third_places_qualified completed")
    
    @staticmethod
    def _create_new_hash_key(db: Session, advancing_team_ids: List[int]) -> str:
        """Create hash key from advancing team IDs"""
        from models.team import Team
        
        print(f"🔧 [DEBUG] create_new_hash_key called with advancing_team_ids: {advancing_team_ids}")
        letters = []
        for team_id in advancing_team_ids:
            team = PredictionRepository.get_team(db, team_id)
            if team and team.group_letter:
                letters.append(team.group_letter)
                print(f"🔧 [DEBUG] Team {team_id} ({team.name}) -> group_letter: {team.group_letter}")
            else:
                print(f"❌ [DEBUG] Team {team_id} not found or no group_letter")
        
        hash_key = ''.join(sorted(letters))
        print(f"🔧 [DEBUG] Generated hash_key: {hash_key} from letters: {letters}")
        return hash_key

