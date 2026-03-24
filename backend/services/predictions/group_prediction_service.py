from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from services.database import DBReader, DBWriter, DBUtils
from .shared import PlacesPredictions
from .enums import GroupPredictionStatus
from .knockout_service import KnockoutService


class GroupPredictionService:
    """Service for group prediction operations"""
    
    @staticmethod
    def update_group_prediction_places(db: Session, user_id: int, group_id: int,
                                       places: PlacesPredictions) -> Dict[str, Any]:
        """Update a group prediction. Prediction must already exist (created at registration)."""
        existing_prediction = DBReader.get_group_prediction(db, user_id, group_id)

        if not existing_prediction:
            raise ValueError(
                f"Group prediction not found for user {user_id}, group {group_id}. "
                "Was it created at registration?"
            )

        return GroupPredictionService._update_group_prediction(db, existing_prediction, places, user_id)
    
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
        print(f"[DEBUG place_changes] user={user_id}, group={group_id}, old={old_places}, new=(1st={new_places.first_place}, 2nd={new_places.second_place}, 3rd={new_places.third_place})")
        if old_places["first_place"] != new_places.first_place:
            GroupPredictionService._handle_first_second_place_change(
                db, user_id, group_id, 1, new_places.first_place
            )

        if old_places["second_place"] != new_places.second_place:
            GroupPredictionService._handle_first_second_place_change(
                db, user_id, group_id, 2, new_places.second_place
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
        DBWriter.update_group_prediction(
            db,
            existing_prediction,
            first_place=places.first_place,
            second_place=places.second_place,
            third_place=places.third_place,
            fourth_place=places.fourth_place
        )
        
        # Handle changes in 1st/2nd places (affects knockout predictions)
        GroupPredictionService._handle_place_changes(
            db, user_id, existing_prediction.group_id, old_places, places
        )
        
        DBUtils.commit(db)
        
        # Handle third place change (affects third place predictions)
        group = DBReader.get_group(db, existing_prediction.group_id)
        group_name = group.name if group else None
        third_place_changed = GroupPredictionService._handle_third_place_change(
            db, user_id, old_places["third_place"], places.third_place, group_name
        )
        
        return GroupPredictionService._build_update_response(
            existing_prediction, places, changes, third_place_changed
        )
    
    @staticmethod
    def create_user_group_predictions(db: Session, user_id: int) -> int:
        """
        Create empty group stage predictions for all 12 groups for a newly registered user.
        Skips groups that already have a prediction (idempotent).
        Returns number of predictions created.
        """
        groups = DBReader.get_groups_ordered(db)
        created = 0

        for group in groups:
            existing = DBReader.get_group_prediction(db, user_id, group.id)
            if existing:
                continue

            prediction = DBWriter.create_group_prediction(
                db,
                user_id=user_id,
                group_id=group.id,
                first=None,
                second=None,
                third=None,
                fourth=None,
                status=GroupPredictionStatus.PENDING,
            )
            created += 1

            # Mark as incorrect (red) if group result already finalized
            group_result = DBReader.get_group_stage_result(db, group.id)
            if group_result:
                DBWriter.set_group_prediction_status(db, prediction, GroupPredictionStatus.SETTLED)
                DBWriter.update_group_prediction_accuracy(
                    db, prediction,
                    first_correct=False,
                    second_correct=False,
                    third_correct=False,
                    fourth_correct=False,
                    correct_positions_count=0,
                )
                DBWriter.update_group_prediction(db, prediction, points=0, is_editable=False)

        DBUtils.flush(db)
        return created

    @staticmethod
    def _handle_first_second_place_change(
        db: Session, user_id: int, group_id: int, position: int, new_team: int
    ):
        """
        Handle a change in 1st or 2nd place - updates the correct slot in the knockout prediction.
        Uses GroupTemplate to determine exactly which match and team slot (1 or 2) to update.
        """
        print(f"[DEBUG 1st2nd_change] user={user_id}, group={group_id}, position={position}, new_team={new_team}")
        result = DBReader.get_match_and_slot_from_group_template(db, group_id, position)
        if not result:
            return

        match_id, team_slot = result

        knockout_prediction = DBReader.get_knockout_prediction(db, user_id, match_id, is_draft=False)
        if not knockout_prediction:
            return

        if team_slot == 1:
            KnockoutService.set_team(db, knockout_prediction, team1_id=new_team)
        else:
            KnockoutService.set_team(db, knockout_prediction, team2_id=new_team)
    
    @staticmethod
    def _handle_third_place_change(db: Session, user_id: int, old_third_place: int, 
                                  new_third_place: int, group_name: Optional[str]) -> bool:
        """
        Handle change in 3rd place - updates third place predictions
        
        Returns True if changed, False otherwise
        """
        print(f"[DEBUG 3rd_change] user={user_id}, old_3rd={old_third_place}, new_3rd={new_third_place}, group={group_name}")
        third_place_changed = old_third_place != new_third_place
        
        if third_place_changed and group_name:
            GroupPredictionService._update_third_place_predictions(
                db, user_id, old_third_place, new_third_place, group_name
            )
        
        return third_place_changed
    
    @staticmethod
    def _update_knockout_for_third_place_change(db: Session, user_id: int, old_team_id: int, new_team_id: int):
        """Update knockout prediction if the old third place team is in team2 position"""
        print(f"[DEBUG knockout_3rd] user={user_id}, searching for old_team={old_team_id}, will replace with new_team={new_team_id}")
        knockout_prediction = DBReader.get_knockout_prediction_by_user_and_team2(
            db, user_id, old_team_id, is_draft=False
        )
        print(f"[DEBUG knockout_3rd] found prediction: {knockout_prediction.id if knockout_prediction else 'NOT FOUND'}, match={knockout_prediction.template_match_id if knockout_prediction else 'N/A'}, team2={knockout_prediction.team2_id if knockout_prediction else 'N/A'}")
        if knockout_prediction:
            # Update team2 (since we're looking for team2 position)
            KnockoutService.update_knockout_prediction(
                db, knockout_prediction, team2_id=new_team_id
            )
    
    @staticmethod
    def _is_third_place_predicted(prediction) -> bool:
        """Returns True if all 8 team slots are filled (none are None)."""
        team_ids = [
            prediction.first_team_qualifying,
            prediction.second_team_qualifying,
            prediction.third_team_qualifying,
            prediction.fourth_team_qualifying,
            prediction.fifth_team_qualifying,
            prediction.sixth_team_qualifying,
            prediction.seventh_team_qualifying,
            prediction.eighth_team_qualifying,
        ]
        return all(t is not None for t in team_ids)

    @staticmethod
    def _update_third_place_predictions(db: Session, user_id: int, old_third_place: int,
                                        new_third_place: int, group_name: str):
        """
        Update third-place predictions and mark the group as changed
        """
        third_place_prediction = DBReader.get_third_place_prediction(db, user_id)
        if not third_place_prediction:
            return

        if not GroupPredictionService._is_third_place_predicted(third_place_prediction):
            return  # User hasn't completed their third-place prediction yet, don't auto-update

        # Replace the team in third place prediction
        team_replaced = GroupPredictionService._replace_team_in_third_place_prediction(
            db, third_place_prediction, old_third_place, new_third_place
        )
        
        if team_replaced:
            GroupPredictionService._update_knockout_for_third_place_change(
                db, user_id, old_third_place, new_third_place
            )
        
        # Mark this group as changed
        GroupPredictionService._update_third_place_prediction_changed_groups(
            db, third_place_prediction, group_name
        )
        
        DBUtils.commit(db)
    
    @staticmethod
    def _replace_team_in_third_place_prediction(db: Session, prediction, old_team_id: int, new_team_id: int) -> bool:
        """
        Find and replace a team in third place prediction
        Returns True if team was found and replaced, False otherwise
        """
        # Get all qualifying team fields dynamically
        return DBWriter.replace_third_place_team(db, prediction, old_team_id, new_team_id)
    
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
            DBWriter.update_third_place_prediction_changed_groups(
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
                "penalty_points": getattr(prediction, "penalty_points", 0) or 0,
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
                "penalty_points": 0,
                "is_editable": True,
                "created_at": None,
                "updated_at": None
            }
    
    @staticmethod
    def _build_group_data(db: Session, user_id: int, group) -> Dict[str, Any]:
        """Build complete group data with teams, result, and prediction"""
        teams = GroupPredictionService._extract_teams_from_group(group)
        pred = DBReader.get_group_prediction(db, user_id, group.id)
        group_result = DBReader.get_group_stage_result(db, group.id)
        
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
        groups = DBReader.get_groups_ordered(db)
        
        result = [
            GroupPredictionService._build_group_data(db, user_id, group)
            for group in groups
        ]
        
        user_scores = DBReader.get_user_scores(db, user_id)
        
        return {
            "groups": result,
            "groups_score": user_scores.groups_score if user_scores else None,
            "groups_penalty": user_scores.groups_penalty if user_scores else 0,
            "free_changes": getattr(user_scores, 'free_changes', 0) if user_scores else 0,
            "free_changes_used": getattr(user_scores, 'free_changes_used', 0) if user_scores else 0,
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
            result = GroupPredictionService.update_group_prediction_places(
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
        from services.stage_manager import StageManager

        try:
            saved_predictions = []
            errors = []
            penalty_points = 0

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
                    result = save_result["result"]
                    saved_predictions.append(result)

            # Calculate total changes across all groups and apply penalty (with free changes)
            total_changes = sum(r.get("changes", 0) for r in saved_predictions)
            user_scores_before = DBReader.get_user_scores(db, user_id)
            print(f"[DEBUG] total_changes={total_changes}, free_changes in DB before consume: {getattr(user_scores_before, 'free_changes', None) if user_scores_before else 'None'}")

            if total_changes > 0:
                paid_changes = ScoringService.consume_free_changes(db, user_id, total_changes)
                if paid_changes > 0:
                    current_stage = StageManager.get_current_stage(db)
                    penalty_per = current_stage.get_penalty_for()
                    total_penalty = paid_changes * penalty_per
                    # Update groups_penalty specifically (not just total penalty)
                    user_scores = DBReader.get_user_scores(db, user_id)
                    if not user_scores:
                        user_scores = DBWriter.create_user_scores(db, user_id)
                    DBWriter.update_user_scores(
                        db,
                        user_scores,
                        groups_penalty=(user_scores.groups_penalty or 0) + total_penalty,
                    )
                    ScoringService.apply_penalty_to_user(db, user_id, total_penalty)
                    penalty_points = total_penalty
                # consume_free_changes does NOT commit; commit here so free_changes update persists
                DBUtils.commit(db)

            # If all predictions failed, return error
            if len(errors) > 0 and len(saved_predictions) == 0:
                return {"error": f"All predictions failed. Errors: {'; '.join(errors)}"}

            user_scores_after = DBReader.get_user_scores(db, user_id)
            free_changes_remaining = getattr(user_scores_after, 'free_changes', 0) if user_scores_after else 0

            return {
                "saved_predictions": saved_predictions,
                "errors": errors,
                "total_saved": len(saved_predictions),
                "total_errors": len(errors),
                "total_changes": total_changes,
                "penalty_points": penalty_points,
                "free_changes_remaining": free_changes_remaining,
                "success": len(errors) == 0
            }
            
        except Exception as e:
            return {"error": f"Batch save failed: {str(e)}"}

