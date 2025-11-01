from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from .prediction_repository import PredictionRepository
from .shared import PlacesPredictions


class GroupPredictionService:
    """Service for group prediction operations"""
    
    @staticmethod
    def create_or_update_group_prediction(db: Session, user_id: int, group_id: int, 
                                         places: PlacesPredictions) -> Dict[str, Any]:
        """
        Create or update a group prediction
        """
        existing_prediction = PredictionRepository.get_group_prediction_by_user_and_group(db, user_id, group_id)
        
        if existing_prediction:
            return GroupPredictionService._update_group_prediction(db, existing_prediction, places, user_id)
        else:
            return GroupPredictionService._create_new_group_prediction(db, places, group_id, user_id)
    
    @staticmethod
    def _calculate_places_changes(existing_prediction, places: PlacesPredictions) -> int:
        """Calculate number of places that changed"""
        changes = 0
        if existing_prediction.first_place != places.first_place:
            changes += 1
        if existing_prediction.second_place != places.second_place:
            changes += 1
        if existing_prediction.third_place != places.third_place:
            changes += 1
        return changes
    
    @staticmethod
    def _save_old_places_values(existing_prediction) -> Dict[str, int]:
        """Save old place values before updating"""
        return {
            "first_place": existing_prediction.first_place,
            "second_place": existing_prediction.second_place,
            "third_place": existing_prediction.third_place
        }
    
    @staticmethod
    def _handle_place_changes(db: Session, user_id: int, group_id: int, 
                             old_places: Dict[str, int], new_places: PlacesPredictions):
        """Handle changes in 1st and 2nd places (affects knockout predictions)"""
        if old_places["first_place"] != new_places.first_place:
            GroupPredictionService._handle_first_second_place_change(
                db, user_id, group_id, 1, 
                old_places["first_place"], new_places.first_place
            )
        
        if old_places["second_place"] != new_places.second_place:
            GroupPredictionService._handle_first_second_place_change(
                db, user_id, group_id, 2, 
                old_places["second_place"], new_places.second_place
            )
    
    @staticmethod
    def _build_update_response(existing_prediction, places: PlacesPredictions, 
                              changes: int, third_place_changed: bool) -> Dict[str, Any]:
        """Build response dict for update operation"""
        return {
            "id": existing_prediction.id,
            "group_id": existing_prediction.group_id,
            "first_place": places.first_place,
            "second_place": places.second_place,
            "third_place": places.third_place,
            "fourth_place": places.fourth_place,
            "updated": True,
            "changes": changes,
            "third_place_changed": third_place_changed
        }
    
    @staticmethod
    def _update_group_prediction(db: Session, existing_prediction, places: PlacesPredictions, user_id: int) -> Dict[str, Any]:
        """Update an existing group prediction"""
        # Calculate and save old values
        changes = GroupPredictionService._calculate_places_changes(existing_prediction, places)
        old_places = GroupPredictionService._save_old_places_values(existing_prediction)
        
        # Update places in database
        PredictionRepository.update_group_prediction(
            db, existing_prediction, 
            places.first_place, places.second_place, 
            places.third_place, places.fourth_place
        )
        
        # Handle changes in 1st/2nd places (affects knockout predictions)
        GroupPredictionService._handle_place_changes(
            db, user_id, existing_prediction.group_id, old_places, places
        )
        
        PredictionRepository.commit(db)
        
        # Handle third place change (affects third place predictions)
        group = PredictionRepository.get_group(db, existing_prediction.group_id)
        group_name = group.name if group else None
        third_place_changed = GroupPredictionService._handle_third_place_change(
            db, user_id, old_places["third_place"], places.third_place, group_name
        )
        
        return GroupPredictionService._build_update_response(
            existing_prediction, places, changes, third_place_changed
        )
    
    @staticmethod
    def _create_new_group_prediction(db: Session, places: PlacesPredictions, group_id: int, user_id: int) -> Dict[str, Any]:
        """Create a new group prediction"""
        new_prediction = PredictionRepository.create_group_prediction(
            db, user_id, group_id, 
            places.first_place, places.second_place, 
            places.third_place, places.fourth_place
        )
        PredictionRepository.commit(db)
        
        # If this is a new prediction, delete existing third place predictions
        PredictionRepository.delete_third_place_predictions_by_user(db, user_id)
        PredictionRepository.commit(db)
        
        return {
            "id": new_prediction.id,
            "group_id": group_id,
            "first_place": places.first_place,
            "second_place": places.second_place,
            "third_place": places.third_place,
            "fourth_place": places.fourth_place,
            "updated": False,
            "changes": 3  # יצירה חדשה = 3 שינויים
        }
    
    @staticmethod
    def _get_match_id_from_group_template(db: Session, group_id: int, position: int) -> Optional[int]:
        """Get match_id from group template based on position (1 or 2)"""
        group = PredictionRepository.get_group(db, group_id)
        if not group:
            return None
        
        group_template = PredictionRepository.get_group_template_by_name(db, group.name)
        if not group_template:
            return None
        
        if position == 1:
            return group_template.first_place_match_id
        elif position == 2:
            return group_template.second_place_match_id
        
        return None
    
    @staticmethod
    def _handle_first_second_place_change(db: Session, user_id: int, group_id: int, position: int, 
                                         old_team: int, new_team: int):
        """
        Handle a change in 1st or 2nd place - updates knockout predictions
        
        Args:
            db: Session
            user_id: user ID
            group_id: group ID
            position: 1 or 2 (first or second place)
            old_team: old team ID
            new_team: new team ID
        """
        match_id = GroupPredictionService._get_match_id_from_group_template(db, group_id, position)
        if not match_id:
            return
        
        # Find relevant knockout prediction - use lazy import to avoid circular dependency
        from .knockout_prediction_service import KnockoutPredictionService
        knockout_prediction = PredictionRepository.get_knockout_prediction_by_user_and_match(db, user_id, match_id)
        if not knockout_prediction:
            return
        
        # Update knockout prediction teams
        KnockoutPredictionService.update_knockout_prediction_teams(db, knockout_prediction, old_team, new_team)
    
    @staticmethod
    def _handle_third_place_change(db: Session, user_id: int, old_third_place: int, 
                                  new_third_place: int, group_name: Optional[str]) -> bool:
        """
        Handle change in 3rd place - updates third place predictions
        
        Returns True if changed, False otherwise
        """
        third_place_changed = old_third_place != new_third_place
        
        if third_place_changed and group_name:
            GroupPredictionService._update_third_place_predictions(
                db, user_id, old_third_place, new_third_place, group_name
            )
        
        return third_place_changed
    
    @staticmethod
    def _update_knockout_for_third_place_change(db: Session, user_id: int, old_team_id: int, new_team_id: int):
        """Update knockout prediction if the old third place team is in team2 position"""
        from .knockout_prediction_service import KnockoutPredictionService
        knockout_prediction = PredictionRepository.get_knockout_prediction_by_user_and_team2(
            db, user_id, old_team_id
        )
        if knockout_prediction:
            KnockoutPredictionService.update_knockout_prediction_teams(
                db, knockout_prediction, old_team_id, new_team_id
            )
    
    @staticmethod
    def _update_third_place_predictions(db: Session, user_id: int, old_third_place: int, 
                                        new_third_place: int, group_name: str):
        """
        Update third-place predictions and mark the group as changed
        """
        third_place_prediction = PredictionRepository.get_third_place_prediction_by_user(db, user_id)
        if not third_place_prediction:
            return
        
        # Replace the team in third place prediction
        team_replaced = GroupPredictionService._replace_team_in_third_place_prediction(
            third_place_prediction, old_third_place, new_third_place
        )
        
        if team_replaced:
            GroupPredictionService._update_knockout_for_third_place_change(
                db, user_id, old_third_place, new_third_place
            )
        
        # Mark this group as changed
        GroupPredictionService._update_third_place_prediction_changed_groups(
            db, third_place_prediction, group_name
        )
        
        PredictionRepository.commit(db)
    
    @staticmethod
    def _replace_team_in_third_place_prediction(prediction, old_team_id: int, new_team_id: int) -> bool:
        """
        Find and replace a team in third place prediction
        Returns True if team was found and replaced, False otherwise
        """
        # Get all qualifying team fields dynamically
        qualifying_fields = [attr for attr in dir(prediction) if attr.endswith('_team_qualifying')]
        
        for field_name in qualifying_fields:
            if getattr(prediction, field_name) == old_team_id:
                setattr(prediction, field_name, new_team_id)
                return True
        
        return False
    
    @staticmethod
    def _update_third_place_prediction_changed_groups(db: Session, prediction, group_name: str):
        """
        Add a group to the changed_groups list in ThirdPlacePrediction
        """
        # Get current changed groups
        current_changed = prediction.changed_groups or ""
        changed_list = current_changed.split(",") if current_changed else []
        
        # Add group if not already in list
        if group_name not in changed_list:
            changed_list.append(group_name)
            PredictionRepository.update_third_place_prediction_changed_groups(
                db, prediction, ",".join(changed_list)
            )
    
    @staticmethod
    def _extract_teams_from_group(group) -> List[Dict[str, Any]]:
        """Extract teams with flag URLs from a group"""
        teams = []
        for team_obj in [group.team_1_obj, group.team_2_obj, group.team_3_obj, group.team_4_obj]:
            if team_obj:
                teams.append({
                    "id": team_obj.id,
                    "name": team_obj.name,
                    "flag_url": team_obj.flag_url
                })
        return teams
    
    @staticmethod
    def _build_group_result_data(group_result) -> Optional[Dict[str, Any]]:
        """Build result data from GroupStageResult"""
        if not group_result:
            return None
        
        return {
            "id": group_result.id,
            "first_place": group_result.first_place,
            "second_place": group_result.second_place,
            "third_place": group_result.third_place,
            "fourth_place": group_result.fourth_place,
        }
    
    @staticmethod
    def _build_prediction_data(prediction) -> Dict[str, Any]:
        """Build prediction data - returns data for existing prediction or defaults"""
        if prediction:
            return {
                "id": prediction.id,
                "first_place": prediction.first_place,
                "second_place": prediction.second_place,
                "third_place": prediction.third_place,
                "fourth_place": prediction.fourth_place,
                "points": prediction.points,
                "is_editable": prediction.is_editable,
                "created_at": prediction.created_at.isoformat(),
                "updated_at": prediction.updated_at.isoformat()
            }
        else:
            return {
                "id": None,
                "first_place": None,
                "second_place": None,
                "third_place": None,
                "fourth_place": None,
                "points": 0,
                "is_editable": True,
                "created_at": None,
                "updated_at": None
            }
    
    @staticmethod
    def _build_group_data(db: Session, user_id: int, group) -> Dict[str, Any]:
        """Build complete group data with teams, result, and prediction"""
        teams = GroupPredictionService._extract_teams_from_group(group)
        pred = PredictionRepository.get_group_prediction_by_user_and_group(db, user_id, group.id)
        group_result = PredictionRepository.get_group_stage_result_by_group(db, group.id)
        
        group_data = {
            "group_id": group.id,
            "group_name": group.name,
            "teams": teams,
            "result": GroupPredictionService._build_group_result_data(group_result)
        }
        
        group_data.update(GroupPredictionService._build_prediction_data(pred))
        
        return group_data
    
    @staticmethod
    def get_group_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get all groups with their teams and user's predictions (if exist)
        Always returns all 12 groups, with or without predictions
        """
        groups = PredictionRepository.get_groups_ordered(db)
        
        result = [
            GroupPredictionService._build_group_data(db, user_id, group)
            for group in groups
        ]
        
        user_scores = PredictionRepository.get_user_scores(db, user_id)
        
        return {
            "groups": result,
            "groups_score": user_scores.groups_score if user_scores else None
        }
    
    @staticmethod
    def _validate_batch_prediction_data(prediction_data: Dict[str, Any]) -> Optional[str]:
        """Validate batch prediction data. Returns error message if invalid, None if valid"""
        group_id = prediction_data.get("group_id")
        first_place = prediction_data.get("first_place")
        second_place = prediction_data.get("second_place")
        third_place = prediction_data.get("third_place")
        fourth_place = prediction_data.get("fourth_place")
        
        if group_id is None or first_place is None or second_place is None or third_place is None or fourth_place is None:
            return f"Missing data for group {group_id}"
        
        return None
    
    @staticmethod
    def _save_single_batch_prediction(db: Session, user_id: int, prediction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a single prediction from batch. Returns dict with 'result' or 'error'"""
        group_id = prediction_data.get("group_id")
        first_place = prediction_data.get("first_place")
        second_place = prediction_data.get("second_place")
        third_place = prediction_data.get("third_place")
        fourth_place = prediction_data.get("fourth_place")
        
        try:
            result = GroupPredictionService.create_or_update_group_prediction(
                db, user_id, group_id, 
                PlacesPredictions(first_place, second_place, third_place, fourth_place)
            )
            
            if "error" in result:
                return {"error": f"Error saving group {group_id}: {result['error']}", "result": None}
            
            return {"error": None, "result": result}
        except Exception as e:
            return {"error": f"Exception saving group {group_id}: {str(e)}", "result": None}
    
    @staticmethod
    def create_or_update_batch_group_predictions(db: Session, user_id: int, 
                                                predictions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create or update multiple group predictions
        """
        from services.scoring_service import ScoringService
        
        try:
            saved_predictions = []
            errors = []
            total_changes = 0
            
            for prediction_data in predictions_data:
                validation_result = GroupPredictionService._validate_batch_prediction_data(prediction_data)
                if validation_result:
                    errors.append(validation_result)
                    continue
                
                save_result = GroupPredictionService._save_single_batch_prediction(
                    db, user_id, prediction_data
                )
                
                if save_result["error"]:
                    errors.append(save_result["error"])
                else:
                    saved_predictions.append(save_result["result"])
                    total_changes += save_result["result"].get("changes", 0)
            
            # Apply penalty if there were changes
            penalty_points = ScoringService.apply_prediction_penalty(db, user_id, total_changes) if total_changes > 0 else 0
            
            # If all predictions failed, return error
            if len(errors) > 0 and len(saved_predictions) == 0:
                return {"error": f"All predictions failed. Errors: {'; '.join(errors)}"}
            
            return {
                "saved_predictions": saved_predictions,
                "errors": errors,
                "total_saved": len(saved_predictions),
                "total_errors": len(errors),
                "total_changes": total_changes,
                "penalty_points": penalty_points,
                "success": len(errors) == 0
            }
            
        except Exception as e:
            return {"error": f"Batch save failed: {str(e)}"}

