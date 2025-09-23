from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session
from models.user import User
from models.matches import Match
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.groups import Group
from models.group_template import GroupTemplate
from models.team import Team
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult
from fastapi import HTTPException
from datetime import datetime
import json
from enum import Enum
from models.third_place_combinations import ThirdPlaceCombination

class PredictionStatus(Enum):
    PREDICTED = "predicted"  # User predicted and prediction is valid
    MIGHT_CHANGE_PREDICT = "might_change_predict"  # Teams changed, user might want to re-evaluate
    MUST_CHANGE_PREDICT = "must_change_predict"  # Must determine winner because prediction is invalid/missing

@dataclass
class PlacesPredictions:
    first_place: int
    second_place: int
    third_place: int
    fourth_place: int

class PredictionService:
    
    @staticmethod
    def set_status(prediction, status: PredictionStatus):
        """
        Updates the status of a knockout prediction
        """
        prediction.status = status.value
        prediction.updated_at = datetime.utcnow()
    
    @staticmethod
    def get_match_prediction(db: Session, user_id: int, match_id: int) -> Dict[str, Any]:
        """
        Gets prediction for a specific match
        """
        prediction = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
        
        if not prediction:
            return None
        
        return {
            "id": prediction.id,
            "user_id": prediction.user_id,
            "match_id": prediction.match_id,
            "home_score": prediction.home_score,
            "away_score": prediction.away_score,
            "predicted_winner": prediction.predicted_winner
        }
    
    @staticmethod
    def get_user_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get all user's predictions
        """
        # Get user details
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Get all match predictions with relationships
        match_predictions = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id
        ).all()
        
        # Get all group predictions
        group_predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        # Get all third place predictions
        third_place_predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        
        # Get all knockout predictions
        knockout_predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).all()
        
        # Convert to dictionary with match details - now with direct relationships
        match_predictions_with_details = []
        for pred in match_predictions:
            # Now we have direct relationship to match
            match = pred.match
            
            if not match:
                continue  # Skip if match not found
            
            match_details = {
                "id": match.id,
                "stage": match.stage,
                "home_team": {
                    "id": match.home_team.id,
                    "name": match.home_team.name,
                },
                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name,
                },
                "date": match.date.isoformat(),
                "status": match.status
            }
            
            # Add specific details based on match type
            if match.is_group_stage:
                match_details["group"] = match.group
            elif match.is_knockout:
                match_details["match_number"] = match.match_number
                match_details["home_team_source"] = match.home_team_source
                match_details["away_team_source"] = match.away_team_source
            
            # Add real result if match is finished
            actual_result = None
            if match.status == "finished":
                # TODO: Here we need to add real results table
                # For now return None
                actual_result = None
            
            match_predictions_with_details.append({
                "id": pred.id,
                "match": match_details,
                "home_score": pred.home_score,
                "away_score": pred.away_score,
                "predicted_winner": pred.predicted_winner,
                "actual_result": actual_result,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            })
        
        # Convert to dictionary
        return {
            "user": {
                "id": user.id,
                "name": user.name,
                "total_points": user.total_points
            },
            "match_predictions": match_predictions_with_details,
            "group_predictions": [{
                "id": pred.id,
                "group_id": pred.group_id,
                "first_place": pred.first_place,
                "second_place": pred.second_place,
                "third_place": pred.third_place,
                "fourth_place": pred.fourth_place,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in group_predictions],
            "third_place_predictions": [{
                "id": pred.id,
                "advancing_team_ids": [
                    pred.first_team_qualifying,
                    pred.second_team_qualifying,
                    pred.third_team_qualifying,
                    pred.fourth_team_qualifying,
                    pred.fifth_team_qualifying,
                    pred.sixth_team_qualifying,
                    pred.seventh_team_qualifying,
                    pred.eighth_team_qualifying
                ],
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in third_place_predictions],
            "knockout_predictions": [{
                "id": pred.id,
                "stage": pred.stage,
                "knockout_match_id": pred.knockout_match_id,
                "winner_team_id": pred.winner_team_id,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in knockout_predictions]
        }
    
    @staticmethod
    def create_or_update_match_prediction(db: Session, user_id: int, match_id: int, home_score: int, away_score: int) -> Dict[str, Any]:
        """
        Create or update a single match prediction
        """
        # Get match details to determine winner
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return {"error": "Match not found"}
        
        # Determine winner based on result
        predicted_winner = 0  # Default to draw
        if home_score > away_score:
            predicted_winner = match.home_team_id
        elif away_score > home_score:
            predicted_winner = match.away_team_id
        # If draw, predicted_winner remains 0
        
        # Check if prediction already exists for this match
        existing_prediction = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
        
        if existing_prediction:
            # Update existing prediction
            existing_prediction.home_score = home_score
            existing_prediction.away_score = away_score
            existing_prediction.predicted_winner = predicted_winner
            # updated_at is updated automatically
            db.commit()
            
            return {
                "id": existing_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
                "predicted_winner": predicted_winner,
                "updated": True
            }
        else:
            # Create new prediction
            new_prediction = MatchPrediction(
                user_id=user_id,
                match_id=match_id,
                home_score=home_score,
                away_score=away_score,
                predicted_winner=predicted_winner
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
                "predicted_winner": predicted_winner,
                "updated": False
            }

    @staticmethod
    def create_or_update_batch_predictions(db: Session, user_id: int, predictions: List[Dict]) -> Dict[str, Any]:
        """
        Create or update multiple match predictions
        """
        results = []
        
        for prediction_data in predictions:
            match_id = prediction_data.get("match_id")
            home_score = prediction_data.get("home_score")
            away_score = prediction_data.get("away_score")
            
            if not all([match_id, home_score is not None, away_score is not None]):
                return {"error": f"Missing data for match {match_id}"}
            
            # Use existing function for each prediction
            result = PredictionService.create_or_update_match_prediction(
                db, user_id, match_id, home_score, away_score
            )
            results.append(result)
        
        return {
            "predictions": results,
            "total_updated": len([r for r in results if r.get("updated")]),
            "total_created": len([r for r in results if not r.get("updated")])
        }
    
    @staticmethod
    def create_or_update_group_prediction(db: Session, user_id: int, group_id: int, places: PlacesPredictions) -> Dict[str, Any]:
        """
        Create or update a group prediction
        """
        # Check if prediction already exists for this group
        existing_prediction = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id,
            GroupStagePrediction.group_id == group_id
        ).first()
        
        if existing_prediction:
            return PredictionService.update_group_prediction(db, existing_prediction, places, user_id)
        else:
            return PredictionService.create_new_group_prediction(db, places, group_id, user_id)

    @staticmethod
    def update_group_prediction(db, existing_prediction, places: PlacesPredictions, user_id):
        # Basic update of places
        old_third_place = existing_prediction.third_place
        PredictionService.update_group_prediction_basic(db, existing_prediction, places, user_id, existing_prediction.group_id)
        
        # Get group name for third place change tracking
        group = db.query(Group).filter(Group.id == existing_prediction.group_id).first()
        group_name = group.name if group else None
        
        # Handle third place change
        third_place_changed = PredictionService.handle_third_place_change(db, user_id, old_third_place, places.third_place, group_name)
        
        return {
            "id": existing_prediction.id,
            "group_id": existing_prediction.group_id,
            "first_place": places.first_place,
            "second_place": places.second_place,
            "third_place": places.third_place,
            "fourth_place": places.fourth_place,
            "updated": True,
            "third_place_changed": third_place_changed
        }

    @staticmethod
    def update_group_prediction_basic(db, existing_prediction, places: PlacesPredictions, user_id, group_id):
        """
        Basic update of places + handle changes in 1st/2nd places
        """
        # Save old values
        old_first_place = existing_prediction.first_place
        old_second_place = existing_prediction.second_place
        
        # Update places
        existing_prediction.first_place = places.first_place
        existing_prediction.second_place = places.second_place
        existing_prediction.third_place = places.third_place
        existing_prediction.fourth_place = places.fourth_place
        
        # Check if first place changed
        if old_first_place != places.first_place:
            PredictionService.handle_first_second_place_change(db, user_id, group_id, 1, old_first_place, places.first_place)
        
        # Check if second place changed
        if old_second_place != places.second_place:
            PredictionService.handle_first_second_place_change(db, user_id, group_id, 2, old_second_place, places.second_place)
        
        db.commit()

    @staticmethod
    def handle_first_second_place_change(db, user_id, group_id, position, old_team, new_team):
        """
        Handle a change in 1st or 2nd place
        
        Args:
            db: Session
            user_id: user ID
            group_id: group ID
            position: 1 or 2 (first or second place)
            old_team: old team ID
            new_team: new team ID
        """
        # Find match_id by position
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            return
        
        # Find GroupTemplate by group name
        group_template = db.query(GroupTemplate).filter(GroupTemplate.group_name == group.name).first()
        if not group_template:
            return
        
        if position == 1:
            match_id = group_template.first_place_match_id
        elif position == 2:
            match_id = group_template.second_place_match_id
        else:
            return  # Invalid position
        
        if not match_id:
            return
        
        # Find relevant knockout prediction
        knockout_prediction = PredictionService.get_knockout_prediction_by_user_and_match_id(db, user_id, match_id)
        if not knockout_prediction:
            return
        
        # Call foundational function
        PredictionService.update_knockout_prediction_teams(db, knockout_prediction, old_team, new_team)

    @staticmethod
    def handle_third_place_change(db, user_id, old_third_place, new_third_place, group_name):
        """
        Handle change in 3rd place
        """
        third_place_changed = old_third_place != new_third_place
        
        if third_place_changed and group_name:
            PredictionService.update_third_place_predictions(db, user_id, old_third_place, new_third_place, group_name)
        
        return third_place_changed

    @staticmethod
    def update_third_place_predictions(db, user_id, old_third_place, new_third_place, group_name):
        """
        Update third-place predictions and mark the group as changed
        """
        # Get existing qualifying predictions
        third_place_prediction = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()

        if not third_place_prediction:
            return

        # Replace the team in third place prediction
        if PredictionService.replace_team_in_third_place_prediction(third_place_prediction, old_third_place, new_third_place):
            # Find and update knockout prediction if the old team is in team2 position
            knockout_prediction = PredictionService.get_knockout_prediction_by_user_and_team2(db, user_id, old_third_place)
            if knockout_prediction:
                PredictionService.update_knockout_prediction_teams(db, knockout_prediction, old_third_place, new_third_place)

        # Mark this group as changed
        PredictionService.update_third_place_prediction_changed_groups(third_place_prediction, group_name)
        
        db.commit()

    @staticmethod
    def replace_team_in_third_place_prediction(prediction, old_team_id, new_team_id):
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
    def update_third_place_prediction_changed_groups(prediction, group_name):
        """
        Add a group to the changed_groups list in ThirdPlacePrediction
        """
        # Get current changed groups
        current_changed = prediction.changed_groups or ""
        changed_list = current_changed.split(",") if current_changed else []
        
        # Add group if not already in list
        if group_name not in changed_list:
            changed_list.append(group_name)
            prediction.changed_groups = ",".join(changed_list)

    @staticmethod
    def clear_changed_groups_from_third_place_prediction(db, user_id):
        """
        Clear the changed_groups field when user updates third place predictions
        """
        third_place_prediction = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()
        
        if third_place_prediction:
            third_place_prediction.changed_groups = None
            db.commit()

    @staticmethod
    def create_new_group_prediction(db, places: PlacesPredictions, group_id, user_id):
        new_prediction = GroupStagePrediction(
            user_id=user_id,
            group_id=group_id,
            first_place=places.first_place,
            second_place=places.second_place,
            third_place=places.third_place,
            fourth_place=places.fourth_place
        )
        db.add(new_prediction)
        db.commit()
        db.refresh(new_prediction)
        
        # If this is a new prediction, delete existing qualifying predictions
        db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).delete()
        db.commit()
        
        return {
            "id": new_prediction.id,
            "group_id": group_id,
            "first_place": places.first_place,
            "second_place": places.second_place,
            "third_place": places.third_place,
            "fourth_place": places.fourth_place,
            "updated": False
        }

    @staticmethod
    def get_group_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all user's group predictions
        """
        predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        return [{
            "id": pred.id,
            "group_id": pred.group_id,
            "first_place": pred.first_place,
            "second_place": pred.second_place,
            "third_place": pred.third_place,
            "fourth_place": pred.fourth_place,
            "points": pred.points,
            "created_at": pred.created_at.isoformat(),
            "updated_at": pred.updated_at.isoformat()
        } for pred in predictions]
    
    @staticmethod
    def create_or_update_third_place_prediction(db: Session, user_id: int, advancing_team_ids: List[int]) -> Dict[str, Any]:
        """
        Create or update third-place qualification prediction
        advancing_team_ids: a list of 8 team IDs that will advance
        """
        # Check if third place prediction already exists
        existing_prediction = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()
        
        if len(advancing_team_ids) != 8:
            return {"error": "Must provide exactly 8 team IDs"}
        
        if existing_prediction:
            # Update existing prediction
            existing_prediction.first_team_qualifying = advancing_team_ids[0]
            existing_prediction.second_team_qualifying = advancing_team_ids[1]
            existing_prediction.third_team_qualifying = advancing_team_ids[2]
            existing_prediction.fourth_team_qualifying = advancing_team_ids[3]
            existing_prediction.fifth_team_qualifying = advancing_team_ids[4]
            existing_prediction.sixth_team_qualifying = advancing_team_ids[5]
            existing_prediction.seventh_team_qualifying = advancing_team_ids[6]
            existing_prediction.eighth_team_qualifying = advancing_team_ids[7]
            # Clear changed groups when user updates predictions
            existing_prediction.changed_groups = None
            db.commit()
            
            # After commit and before return (in both update and create branches)
            PredictionService.update_knockout_predictions_by_new_third_places_qualified(
                db, user_id, advancing_team_ids
            )
            
            return {
                "id": existing_prediction.id,
                "advancing_team_ids": advancing_team_ids,
                "updated": True
            }
        else:
            # Create new prediction
            new_prediction = ThirdPlacePrediction(
                user_id=user_id,
                first_team_qualifying=advancing_team_ids[0],
                second_team_qualifying=advancing_team_ids[1],
                third_team_qualifying=advancing_team_ids[2],
                fourth_team_qualifying=advancing_team_ids[3],
                fifth_team_qualifying=advancing_team_ids[4],
                sixth_team_qualifying=advancing_team_ids[5],
                seventh_team_qualifying=advancing_team_ids[6],
                eighth_team_qualifying=advancing_team_ids[7]
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "advancing_team_ids": advancing_team_ids,
                "updated": False
            }
    
    @staticmethod
    def get_third_place_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Get user's third-place predictions
        """
        predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        
        return [{
            "id": pred.id,
            "advancing_team_ids": [
                pred.first_team_qualifying,
                pred.second_team_qualifying,
                pred.third_team_qualifying,
                pred.fourth_team_qualifying,
                pred.fifth_team_qualifying,
                pred.sixth_team_qualifying,
                pred.seventh_team_qualifying,
                pred.eighth_team_qualifying
            ],
            "changed_groups": pred.changed_groups,  # Groups with changed 3rd place
            "points": pred.points,  # Points awarded for this third place prediction
            "created_at": pred.created_at.isoformat(),
            "updated_at": pred.updated_at.isoformat()
        } for pred in predictions]
    
    @staticmethod
    def get_third_place_eligible_teams(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Get the 12 teams that are 3rd-place candidates based on the user's group predictions
        """
        # Get all user's group predictions
        group_predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        if len(group_predictions) != 12:
            return {"error": "User must predict all 12 groups first"}
        
        third_place_teams = []
        
        for pred in group_predictions:
            third_place_team_id = pred.third_place  # 3rd place
            
            # Get team details
            team = db.query(Team).filter(Team.id == third_place_team_id).first()
            if team:
                # Get group name
                group = db.query(Group).filter(Group.id == pred.group_id).first()
                group_name = group.name if group else f"Group {pred.group_id}"
                
                third_place_teams.append({
                    "id": team.id,
                    "name": team.name,
                    "group_id": pred.group_id,
                    "group_name": group_name
                })
        
        return third_place_teams
    
    @staticmethod
    def create_or_update_batch_group_predictions(db: Session, user_id: int, predictions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create or update multiple group predictions
        """
        try:
            saved_predictions = []
            errors = []
            
            for prediction_data in predictions_data:
                group_id = prediction_data.get("group_id")
                first_place = prediction_data.get("first_place")
                second_place = prediction_data.get("second_place")
                third_place = prediction_data.get("third_place")
                fourth_place = prediction_data.get("fourth_place")
                
                if not all([group_id, first_place, second_place, third_place, fourth_place]):
                    errors.append(f"Missing data for group {group_id}")
                    continue
                
                # Save prediction
                result = PredictionService.create_or_update_group_prediction(
                    db, user_id, group_id, PlacesPredictions(first_place, second_place, third_place, fourth_place)
                )
                
                if "error" in result:
                    errors.append(f"Error saving group {group_id}: {result['error']}")
                else:
                    saved_predictions.append(result)
            
            return {
                "saved_predictions": saved_predictions,
                "errors": errors,
                "total_saved": len(saved_predictions),
                "total_errors": len(errors),
                "success": len(errors) == 0
            }
            
        except Exception as e:
            return {"error": f"Batch save failed: {str(e)}"}

    @staticmethod
    def get_knockout_predictions(db: Session, user_id: int, stage: str = None) -> List[Dict[str, Any]]:
        """
        Get all user's knockout predictions. If stage is provided, filter by that stage.
        """
        try:
            # Build basic query
            query = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.user_id == user_id
            )
            
            # If stage is defined, add filtering
            if stage:
                query = query.filter(KnockoutStagePrediction.stage == stage)
            
            # Get predictions
            predictions = query.all()
            
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
                    "created_at": prediction.created_at,
                    "updated_at": prediction.updated_at,
                    # Add team names if they exist
                    "team1_name": prediction.team1.name if prediction.team1 else None,
                    "team2_name": prediction.team2.name if prediction.team2 else None,
                    "winner_team_name": prediction.winner_team.name if prediction.winner_team else None
                })
            
            return result
            
        except Exception as e:
            raise Exception(f"Error fetching knockout predictions: {str(e)}")

    @staticmethod
    def update_knockout_prediction_with_winner(db: Session, prediction, winner_team_id: Optional[int] = None):
        """
        Internal function to update a knockout prediction with a new winner
        
        Args:
            db: Session
            prediction: prediction to update
            winner_team_id: ID of the winner team (optional - can be None)
        """
        # 1. Check if need to create new prediction for next stage
        template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        next_prediction = PredictionService.create_next_stage_if_needed(db, prediction, template)
        
        # 2. Check if winner changed
        if prediction.winner_team_id == winner_team_id and winner_team_id is not None:
            PredictionService.set_status(prediction, PredictionStatus.PREDICTED)
            db.commit()
            return PredictionService.create_success_response(db, prediction, "Winner did not change")
        
        # 3. Update winner
        previous_winner_id = prediction.winner_team_id
        prediction.winner_team_id = winner_team_id
        prediction.updated_at = datetime.utcnow()
        
        # 4. Update status
        PredictionService.set_status(prediction, PredictionStatus.PREDICTED if winner_team_id else PredictionStatus.MUST_CHANGE_PREDICT)
        
        # 5. Update next stages
        if next_prediction:
            PredictionService.update_next_stages(db, prediction, previous_winner_id)
        
        # 6. Save
        db.commit()
        
        return PredictionService.create_success_response(db, prediction, "Prediction updated successfully")


    @staticmethod
    def update_knockout_prediction_winner(db: Session, prediction_id: int, request) -> Dict[str, Any]:
        """
        Update a knockout prediction - choose winner and update subsequent stages
        """
        try:
            # 1. Validation and data loading
            prediction = PredictionService.get_knockout_prediction_by_id(db, prediction_id)
            winner_team_id = PredictionService.get_winner_team_id(prediction, request.winner_team_number)
            
            if not winner_team_id:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to resolve winner team ID"
                )
            
            # 2. Call the internal function
            result = PredictionService.update_knockout_prediction_with_winner(db, prediction, winner_team_id)
            
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
    def get_knockout_prediction_by_id(db: Session, prediction_id: int):
        """Finds knockout prediction by ID"""
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.id == prediction_id
        ).first()
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="Prediction not found"
            )
        
        return prediction

    @staticmethod
    def get_template_by_id(db: Session, template_id: int):
        """Finds match template by ID"""
        template = db.query(MatchTemplate).filter(
            MatchTemplate.id == template_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=404,
                detail="Match template not found"
            )
        
        return template

    @staticmethod
    def get_winner_team_id(prediction, winner_team_number: int):
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
    def create_success_response(db: Session, prediction, message: str, request=None):
        """Creates success response"""
        # Find winner team name
        winner_team = None
        if prediction.winner_team_id:
            winner_team = db.query(Team).filter(Team.id == prediction.winner_team_id).first()
        
        winner_team_name = winner_team.name if winner_team else (request.winner_team_name if request else None)
        
        return {
            "success": True,
            "message": message,
            "prediction": {
                "id": prediction.id,
                "winner_team_id": prediction.winner_team_id,
                "winner_team_name": winner_team_name,
                "updated_at": prediction.updated_at
            }
        }

    @staticmethod
    def update_next_stages(db: Session, prediction, previous_winner_id):
        """
        Update next stages:
        1. Place new winner into the next match
        2. Remove the previous winner from all subsequent stages
        """
        # Find the next prediction and its position
        next_prediction, position = PredictionService.find_next_knockout_prediction_and_position(db, prediction)
        
        # 1. Update the next match with the new winner
        PredictionService.update_next_stage_prediction(db, prediction, next_prediction, position)
        
        # 2. Remove the previous winner from all subsequent stages
        if previous_winner_id and next_prediction:
            PredictionService.remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)

    @staticmethod
    def find_next_knockout_prediction_and_position(db: Session, prediction):
        """
        Find the next prediction in the knockout chain and its position
        Returns: tuple (next_prediction, position) or (None, None) if not found
        """
        # Find the template of the current prediction
        current_template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # No destination
        
        # Use the new fields
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position
        
        # Find the next prediction
        next_prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == next_match_id,
            KnockoutStagePrediction.user_id == prediction.user_id
        ).first()
        
        return next_prediction, position

    @staticmethod
    def create_next_stage_if_needed(db: Session, prediction, template):
        """
        Check whether a next-stage prediction is needed and create it if required
        Returns: KnockoutStagePrediction or None
        """
        if not template.winner_next_knockout_match:
            return None
        
        # Use the new fields
        next_match_id = template.winner_next_knockout_match
        
        # Check whether a prediction already exists for the next match
        existing_next_prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == next_match_id,
            KnockoutStagePrediction.user_id == prediction.user_id
        ).first()
        
        if existing_next_prediction:
            return existing_next_prediction
        
        # Create a new prediction for the next stage
        next_prediction = PredictionService.create_next_stage_prediction(db, prediction, next_match_id)
        if next_prediction:
            print(f"Created new next-stage prediction: {next_prediction.id}")
        return next_prediction

    @staticmethod
    def create_next_stage_prediction(db: Session, prediction, next_match_id):
        """
        Create a new prediction for the next stage in the knockout chain
        """
        # Find the matching result
        result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        if not result:
            print(f"KnockoutStageResult not found for match_id {next_match_id}")
            return None
        
        # Find the template of the next stage
        next_template = db.query(MatchTemplate).filter(
            MatchTemplate.id == next_match_id
        ).first()
        
        if not next_template:
            print(f"MatchTemplate not found for match_id {next_match_id}")
            return None
        
        # Create a new prediction
        new_prediction = KnockoutStagePrediction(
            user_id=prediction.user_id,
            knockout_result_id=result.id,
            template_match_id=next_match_id,
            stage=next_template.stage,
            winner_team_id=None
        )
        
        db.add(new_prediction)
        db.flush()  # To get the ID
        
        # Update status to MUST_CHANGE_PREDICT
        PredictionService.set_status(new_prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        return new_prediction

    @staticmethod
    def get_next_knockout_position(db: Session, prediction):
        """
        Find the position (1 or 2) of the current prediction in the knockout chain
        Returns: int (1 or 2) or None if not found
        """
        # Find the template of the current prediction
        current_template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None  # No destination
        
        # Use the new field
        return current_template.winner_next_position

    @staticmethod
    def remove_prev_winner_from_next_stages(db: Session, prediction, previous_winner_id):
        """
        Remove the previous winner team from all subsequent stages in the chain
        """
        if not previous_winner_id or not prediction:
            return
        
        # Check: if current winner differs from the team to remove - do nothing
        if prediction.winner_team_id and prediction.winner_team_id != previous_winner_id:
            # Update status to MIGHT_CHANGE_PREDICT
            PredictionService.set_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            return
        
        # Remove winner
        prediction.winner_team_id = None
        print(f"Removed winner {previous_winner_id} from prediction {prediction.id}")
        
        # Update status to MUST_CHANGE_PREDICT
        PredictionService.set_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        # Find the next prediction in the chain
        next_prediction, next_position = PredictionService.find_next_knockout_prediction_and_position(db, prediction)
        
        if next_prediction and next_position:
            # Call update_next_stage_prediction
            PredictionService.update_next_stage_prediction(db, prediction, next_prediction, next_position)
        
        # Call recursively with the next prediction
        if next_prediction:
            PredictionService.remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)

    @staticmethod
    def update_next_stage_prediction(db: Session, prediction, next_prediction, position):
        """
        Update the next prediction in the knockout chain with the new winner
        """
        if not next_prediction or not position:
            return  # No destination or template or position not found
        
        # Update the appropriate team field
        if position == 1:
            next_prediction.team1_id = prediction.winner_team_id
        elif position == 2:
            next_prediction.team2_id = prediction.winner_team_id
        
        print(f"Updated prediction {next_prediction.id} - position {position} with team {prediction.winner_team_id}")

    @staticmethod
    def update_knockout_prediction_teams(db: Session, prediction, old_team_id: int, new_team_id: int):
        if old_team_id == new_team_id:
            return
        # Perform the swap
        if prediction.team1_id == old_team_id:
            prediction.team1_id = new_team_id
        elif prediction.team2_id == old_team_id:
            prediction.team2_id = new_team_id
        else:
            return
        if prediction.winner_team_id == old_team_id:
            return PredictionService.update_knockout_prediction_with_winner(db, prediction, None)
        else:
            if prediction.winner_team_id:
                PredictionService.set_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
                db.commit()

    @staticmethod
    def get_knockout_prediction_by_user_and_match_id(db: Session, user_id: int, match_id: int):
        """
        Find knockout prediction by user_id and match_id
        
        Args:
            db: Session
            user_id: user ID
            match_id: match ID (template_match_id)
            
        Returns:
            KnockoutStagePrediction or None if not found
        """
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id,
            KnockoutStagePrediction.template_match_id == match_id
        ).first()
        
        return prediction

    @staticmethod
    def get_knockout_prediction_by_user_and_team2(db: Session, user_id: int, team2_id: int):
        """
        Find a knockout prediction by user_id and team2_id (for third place teams)
        
        Args:
            db: Session
            user_id: User ID
            team2_id: Team ID in team2 position
            
        Returns:
            KnockoutStagePrediction or None if not found
        """
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id,
            KnockoutStagePrediction.team2_id == team2_id
        ).first()
        
        return prediction

    @staticmethod
    def create_new_hash_key(db: Session, advancing_team_ids: List[int]) -> str:
        letters = []
        for team_id in advancing_team_ids:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team and team.group_letter:
                letters.append(team.group_letter)
        return ''.join(sorted(letters))

    @staticmethod
    def find_third_places_combination_by_hash_key(db: Session, hash_key: str):
        return db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()

    @staticmethod
    def update_knockout_predictions_by_new_third_places_qualified(db: Session, user_id: int, advancing_team_ids: List[int]):
        # Build hash key and find combination (like the script)
        hash_key = PredictionService.create_new_hash_key(db, advancing_team_ids)
        combination = PredictionService.find_third_places_combination_by_hash_key(db, hash_key)
        if not combination:
            return

        # Same mapping as the script (updated to match templates)
        third_team_mapping = {
            '3rd_team_1': 'match_1E',  # 3rd_team_1 -> 1E -> match_1E
            '3rd_team_2': 'match_1I',  # 3rd_team_2 -> 1I -> match_1I
            '3rd_team_3': 'match_1A',  # 3rd_team_3 -> 1A -> match_1A
            '3rd_team_4': 'match_1L',  # 3rd_team_4 -> 1L -> match_1L
            '3rd_team_5': 'match_1D',  # 3rd_team_5 -> 1D -> match_1D
            '3rd_team_6': 'match_1G',  # 3rd_team_6 -> 1G -> match_1G
            '3rd_team_7': 'match_1B',  # 3rd_team_7 -> 1B -> match_1B
            '3rd_team_8': 'match_1K'   # 3rd_team_8 -> 1K -> match_1K
        }

        # Relevant Round of 32 templates: only where team_2 uses third-place source
        templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage == 'round32'
        ).all()
        relevant_templates = [t for t in templates if t.team_2.startswith('3rd_team_')]

        # Helper: new_team2 for third-place sources (using lines 142-159 from script)
        def resolve_third_place_team(team_source: str):
            column_name = third_team_mapping[team_source]
            third_place_source = getattr(combination, column_name)  # e.g., '3A'
            group_letter = third_place_source[1]  # 'A'

            group = db.query(Group).filter(Group.name == group_letter).first()
            if not group:
                return None

            group_pred = db.query(GroupStagePrediction).filter(
                GroupStagePrediction.group_id == group.id
            ).first()
            if not group_pred:
                return None

            return db.query(Team).filter(Team.id == group_pred.third_place).first()

        # Iterate relevant templates and update predictions
        for template in relevant_templates:
            # Find the user's prediction for this match
            prediction = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.user_id == user_id,
                KnockoutStagePrediction.template_match_id == template.id
            ).first()
            if not prediction:
                continue

            old_team2_id = prediction.team2_id

            # Compute the new team2 from the combination
            new_team = resolve_third_place_team(template.team_2)
            new_team2_id = new_team.id if new_team else None
            if not new_team2_id:
                continue

            # Apply the foundational updater (includes early no-op if equal)
            PredictionService.update_knockout_prediction_teams(db, prediction, old_team2_id, new_team2_id)