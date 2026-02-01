from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from services.database import DBReader, DBWriter, DBUtils
from services.scoring_service import ScoringService


class ThirdPlacePredictionService:
    """Service for third place prediction operations"""
    
    @staticmethod
    def _validate_advancing_team_ids(advancing_team_ids: List[int]) -> Optional[Dict[str, str]]:
        """Validate that exactly 8 team IDs are provided"""
        if len(advancing_team_ids) != 8:
            return {"error": "Must provide exactly 8 team IDs"}
        return None
    
    @staticmethod
    def _update_knockout_predictions_for_third_place(db: Session, user_id: int, advancing_team_ids: List[int]):
        """Update knockout predictions after third place prediction is created/updated"""
        from .knock_pred_refactor_service import KnockPredRefactorService
        KnockPredRefactorService.update_knockout_predictions_by_new_third_places_qualified(
            db, user_id, advancing_team_ids
        )
    
    @staticmethod
    def _update_existing_third_place_prediction(db: Session, user_id: int, existing_prediction, 
                                               advancing_team_ids: List[int]) -> Dict[str, Any]:
        """Update an existing third place prediction"""
        changes = ThirdPlacePredictionService._calculate_third_place_changes(
            existing_prediction, advancing_team_ids, db
        )
        
        DBWriter.update_third_place_prediction(db, existing_prediction, advancing_team_ids)
        DBWriter.update_third_place_prediction_changed_groups(db, existing_prediction, None)
        DBUtils.commit(db)
        
        ThirdPlacePredictionService._update_knockout_predictions_for_third_place(db, user_id, advancing_team_ids)
        
        penalty_points = ScoringService.apply_prediction_penalty(db, user_id, changes) if changes > 0 else 0
        
        return {
            "id": existing_prediction.id,
            "advancing_team_ids": advancing_team_ids,
            "updated": True,
            "changes": changes,
            "penalty_points": penalty_points
        }
    
    @staticmethod
    def _create_empty_knockout_predictions_if_needed(db: Session, user_id: int) -> None:
        """
        Create empty knockout prediction records for later stages if they don't exist.
        This creates prediction records for round16, quarter, semi, final stages without teams.
        Only creates predictions that don't already exist.
        """
        try:
            # Get knockout match templates for later stages (not round32, as it's already created)
            knockout_templates = DBReader.get_match_templates_by_stages_ordered(
                db, ["round16", "quarter", "semi", "final", "third_place"]
            )
            
            created_count = 0
            
            for template in knockout_templates:
                # Check if prediction already exists for this template
                existing_prediction = DBReader.get_knockout_prediction(
                    db, user_id, template.id, is_draft=False
                )
                
                if existing_prediction:
                    # Prediction already exists, skip
                    continue
                
                # Find the corresponding KnockoutStageResult
                knockout_result = DBReader.get_knockout_result(db, template.id)
                
                if not knockout_result:
                    # If result doesn't exist, skip this template
                    continue
                
                # Create empty prediction (no teams, no winner)
                DBWriter.create_knockout_prediction(
                    db,
                    user_id,
                    knockout_result.id,
                    template.id,
                    template.stage,
                    is_draft=False,
                    team1_id=None,
                    team2_id=None,
                    winner_team_id=None,
                    status="gray",
                    is_editable=True
                )
                created_count += 1
            
            if created_count > 0:
                DBUtils.commit(db)
                print(f"Created {created_count} empty knockout predictions for user {user_id}")
            else:
                print(f"No new empty knockout predictions needed for user {user_id}")
            
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Error creating empty knockout predictions for user {user_id}: {e}")
            # Don't raise exception - third place prediction creation should succeed even if this fails
    
    @staticmethod
    def _create_new_third_place_prediction(db: Session, user_id: int, 
                                          advancing_team_ids: List[int]) -> Dict[str, Any]:
        """Create a new third place prediction"""
        new_prediction = DBWriter.create_third_place_prediction(
            db, user_id, advancing_team_ids
        )
        DBUtils.commit(db)
        
        ThirdPlacePredictionService._update_knockout_predictions_for_third_place(db, user_id, advancing_team_ids)
        
        changes = 8  # New prediction counts as 8 changes (all teams)
        penalty_points = ScoringService.apply_prediction_penalty(db, user_id, changes)
        
        return {
            "id": new_prediction.id,
            "advancing_team_ids": advancing_team_ids,
            "updated": False,
            "changes": changes,
            "penalty_points": penalty_points
        }
    
    @staticmethod
    def create_or_update_third_place_prediction(db: Session, user_id: int, 
                                                advancing_team_ids: List[int]) -> Dict[str, Any]:
        """
        Create or update third-place qualification prediction
        advancing_team_ids: a list of 8 team IDs that will advance
        """
        validation_error = ThirdPlacePredictionService._validate_advancing_team_ids(advancing_team_ids)
        if validation_error:
            return validation_error
        
        existing_prediction = DBReader.get_third_place_prediction(db, user_id)
        
        if existing_prediction:
            return ThirdPlacePredictionService._update_existing_third_place_prediction(
                db, user_id, existing_prediction, advancing_team_ids
            )
        else:
            return ThirdPlacePredictionService._create_new_third_place_prediction(
                db, user_id, advancing_team_ids
            )
    
    @staticmethod
    def _calculate_third_place_changes(old_prediction, new_prediction_teams: List[int], db: Session) -> int:
        """
        Calculate number of changes in third place predictions based on group changes.
        Returns the number of groups that changed (not individual teams).
        """
        # Get old teams
        old_teams = [
            old_prediction.first_team_qualifying,
            old_prediction.second_team_qualifying,
            old_prediction.third_team_qualifying,
            old_prediction.fourth_team_qualifying,
            old_prediction.fifth_team_qualifying,
            old_prediction.sixth_team_qualifying,
            old_prediction.seventh_team_qualifying,
            old_prediction.eighth_team_qualifying
        ]
        
        # Get group names for old and new teams
        old_groups = ThirdPlacePredictionService._get_team_groups(old_teams, db)
        new_groups = ThirdPlacePredictionService._get_team_groups(new_prediction_teams, db)
        
        # Calculate changes: only count new groups that were added
        changes = len(new_groups - old_groups)
        
        return changes
    
    @staticmethod
    def _get_team_groups(team_ids: List[int], db: Session) -> set:
        """
        Helper function to get group names for a list of team IDs.
        Returns a set of group names.
        """
        groups = set()
        for team_id in team_ids:
            if team_id:
                group_name = ScoringService.get_team_group_name(team_id, db)
                if group_name:
                    groups.add(group_name)
        return groups
    
    @staticmethod
    def _extract_advancing_team_ids(prediction) -> List[int]:
        """Extract advancing team IDs from third place prediction"""
        if not prediction:
            return []
        
        return [
            prediction.first_team_qualifying,
            prediction.second_team_qualifying,
            prediction.third_team_qualifying,
            prediction.fourth_team_qualifying,
            prediction.fifth_team_qualifying,
            prediction.sixth_team_qualifying,
            prediction.seventh_team_qualifying,
            prediction.eighth_team_qualifying
        ]
    
    @staticmethod
    def _build_prediction_info(prediction) -> Dict[str, Any]:
        """Build prediction info dict from prediction object"""
        default_info = {
            "id": None,
            "points": 0,
            "is_editable": True,
            "changed_groups": [],
            "created_at": None,
            "updated_at": None
        }
        
        if not prediction:
            return default_info
        
        changed_groups = []
        if prediction.changed_groups:
            changed_groups = [group.strip() for group in prediction.changed_groups.split(',') if group.strip()]
        
        return {
            "id": prediction.id,
            "points": prediction.points,
            "is_editable": prediction.is_editable,
            "changed_groups": changed_groups,
            "created_at": prediction.created_at.isoformat() if prediction.created_at else None,
            "updated_at": prediction.updated_at.isoformat() if prediction.updated_at else None
        }
    
    @staticmethod
    def _build_third_place_teams(db: Session, user_id: int, advancing_team_ids: List[int]) -> List[Dict[str, Any]]:
        """Build list of third place teams with is_selected flag"""
        group_predictions = DBReader.get_group_predictions_by_user(db, user_id)
        
        if len(group_predictions) != 12:
            return []
        
        third_place_teams = []
        for pred in group_predictions:
            third_place_team_id = pred.third_place
            team = DBReader.get_team(db, third_place_team_id)
            
            if team:
                group = DBReader.get_group(db, pred.group_id)
                group_name = group.name if group else f"Group {pred.group_id}"
                
                third_place_teams.append({
                    "id": team.id,
                    "name": team.name,
                    "group_id": pred.group_id,
                    "group_name": group_name,
                    "flag_url": team.flag_url,
                    "is_selected": team.id in advancing_team_ids
                })
        
        return third_place_teams
    
    @staticmethod
    def _build_result_data(third_place_result, db: Session) -> Optional[Dict[str, Any]]:
        """Build result data from ThirdPlaceResult"""
        if not third_place_result:
            return None
        
        result_teams = [
            third_place_result.first_team_qualifying,
            third_place_result.second_team_qualifying,
            third_place_result.third_team_qualifying,
            third_place_result.fourth_team_qualifying,
            third_place_result.fifth_team_qualifying,
            third_place_result.sixth_team_qualifying,
            third_place_result.seventh_team_qualifying,
            third_place_result.eighth_team_qualifying
        ]
        
        result_groups = []
        for team_id in result_teams:
            if team_id:
                group_name = ScoringService.get_team_group_name(team_id, db)
                result_groups.append(group_name if group_name else None)
            else:
                result_groups.append(None)
        
        return {
            "first_team_qualifying": third_place_result.first_team_qualifying,
            "second_team_qualifying": third_place_result.second_team_qualifying,
            "third_team_qualifying": third_place_result.third_team_qualifying,
            "fourth_team_qualifying": third_place_result.fourth_team_qualifying,
            "fifth_team_qualifying": third_place_result.fifth_team_qualifying,
            "sixth_team_qualifying": third_place_result.sixth_team_qualifying,
            "seventh_team_qualifying": third_place_result.seventh_team_qualifying,
            "eighth_team_qualifying": third_place_result.eighth_team_qualifying,
            "result_groups": result_groups
        }
    
    @staticmethod
    def get_third_place_predictions_data(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get unified third-place data: eligible teams + predictions with is_selected field
        """
        prediction = DBReader.get_third_place_prediction(db, user_id)
        
        advancing_team_ids = ThirdPlacePredictionService._extract_advancing_team_ids(prediction)
        prediction_info = ThirdPlacePredictionService._build_prediction_info(prediction)
        
        # Validate that user has predicted all 12 groups
        group_predictions = DBReader.get_group_predictions_by_user(db, user_id)
        if len(group_predictions) != 12:
            return {"error": "User must predict all 12 groups first"}
        
        third_place_teams = ThirdPlacePredictionService._build_third_place_teams(
            db, user_id, advancing_team_ids
        )
        
        user_scores = DBReader.get_user_scores(db, user_id)
        third_place_result = DBReader.get_third_place_result(db)
        
        # If result exists, make prediction not editable
        if third_place_result and prediction:
            prediction_info['is_editable'] = False
        
        result_data = ThirdPlacePredictionService._build_result_data(third_place_result, db)
        
        return {
            "eligible_teams": third_place_teams,
            "prediction": prediction_info,
            "third_place_score": user_scores.third_place_score if user_scores else None,
            "result": result_data
        }
    

