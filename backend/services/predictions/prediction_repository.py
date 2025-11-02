from typing import List, Optional, Any
from sqlalchemy.orm import Session
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction, KnockoutStagePredictionDraft
from models.user import User
from models.matches import Match
from models.groups import Group
from models.team import Team
from models.matches_template import MatchTemplate
from models.user_scores import UserScores
from models.third_place_combinations import ThirdPlaceCombination


class PredictionRepository:
    """
    Repository for all database operations related to predictions.
    This class contains ONLY database operations - no business logic.
    """
    
    # ========================================
    # Match Prediction Operations
    # ========================================
    
    @staticmethod
    def get_match_prediction_by_user_and_match(db: Session, user_id: int, match_id: int) -> Optional[MatchPrediction]:
        """Get a match prediction by user_id and match_id"""
        return db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
    
    @staticmethod
    def get_match_predictions_by_user(db: Session, user_id: int) -> List[MatchPrediction]:
        """Get all match predictions for a user"""
        return db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id
        ).all()
    
    @staticmethod
    def create_match_prediction(db: Session, user_id: int, match_id: int, home_score: Optional[int], 
                                away_score: Optional[int], predicted_winner: Optional[int]) -> MatchPrediction:
        """Create a new match prediction"""
        prediction = MatchPrediction(
            user_id=user_id,
            match_id=match_id,
            home_score=home_score,
            away_score=away_score,
            predicted_winner=predicted_winner
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction
    
    @staticmethod
    def update_match_prediction(db: Session, prediction: MatchPrediction, home_score: Optional[int] = None,
                               away_score: Optional[int] = None, predicted_winner: Optional[int] = None) -> MatchPrediction:
        """Update an existing match prediction"""
        if home_score is not None:
            prediction.home_score = home_score
        if away_score is not None:
            prediction.away_score = away_score
        if predicted_winner is not None:
            prediction.predicted_winner = predicted_winner
        db.flush()
        return prediction
    
    # ========================================
    # Group Prediction Operations
    # ========================================
    
    @staticmethod
    def get_group_prediction_by_user_and_group(db: Session, user_id: int, group_id: int) -> Optional[GroupStagePrediction]:
        """Get a group prediction by user_id and group_id"""
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id,
            GroupStagePrediction.group_id == group_id
        ).first()
    
    @staticmethod
    def get_group_predictions_by_user(db: Session, user_id: int) -> List[GroupStagePrediction]:
        """Get all group predictions for a user"""
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
    
    @staticmethod
    def create_group_prediction(db: Session, user_id: int, group_id: int, first_place: int,
                               second_place: int, third_place: int, fourth_place: int) -> GroupStagePrediction:
        """Create a new group prediction"""
        prediction = GroupStagePrediction(
            user_id=user_id,
            group_id=group_id,
            first_place=first_place,
            second_place=second_place,
            third_place=third_place,
            fourth_place=fourth_place
        )
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction
    
    @staticmethod
    def update_group_prediction(db: Session, prediction: GroupStagePrediction, first_place: Optional[int] = None,
                                second_place: Optional[int] = None, third_place: Optional[int] = None,
                                fourth_place: Optional[int] = None) -> GroupStagePrediction:
        """Update an existing group prediction"""
        if first_place is not None:
            prediction.first_place = first_place
        if second_place is not None:
            prediction.second_place = second_place
        if third_place is not None:
            prediction.third_place = third_place
        if fourth_place is not None:
            prediction.fourth_place = fourth_place
        db.flush()
        return prediction
    
    @staticmethod
    def delete_group_predictions_by_user(db: Session, user_id: int):
        """Delete all group predictions for a user (used when creating new group prediction)"""
        db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).delete()
    
    # ========================================
    # Third Place Prediction Operations
    # ========================================
    
    @staticmethod
    def get_third_place_prediction_by_user(db: Session, user_id: int) -> Optional[ThirdPlacePrediction]:
        """Get third place prediction by user_id"""
        return db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()
    
    @staticmethod
    def create_third_place_prediction(db: Session, user_id: int, advancing_team_ids: List[int]) -> ThirdPlacePrediction:
        """Create a new third place prediction"""
        prediction = ThirdPlacePrediction(
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
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction
    
    @staticmethod
    def update_third_place_prediction(db: Session, prediction: ThirdPlacePrediction, advancing_team_ids: List[int]) -> ThirdPlacePrediction:
        """Update an existing third place prediction"""
        prediction.first_team_qualifying = advancing_team_ids[0]
        prediction.second_team_qualifying = advancing_team_ids[1]
        prediction.third_team_qualifying = advancing_team_ids[2]
        prediction.fourth_team_qualifying = advancing_team_ids[3]
        prediction.fifth_team_qualifying = advancing_team_ids[4]
        prediction.sixth_team_qualifying = advancing_team_ids[5]
        prediction.seventh_team_qualifying = advancing_team_ids[6]
        prediction.eighth_team_qualifying = advancing_team_ids[7]
        db.flush()
        return prediction
    
    @staticmethod
    def update_third_place_prediction_changed_groups(db: Session, prediction: ThirdPlacePrediction, changed_groups: Optional[str]):
        """Update the changed_groups field of a third place prediction"""
        prediction.changed_groups = changed_groups
        db.flush()
    
    @staticmethod
    def delete_third_place_predictions_by_user(db: Session, user_id: int):
        """Delete all third place predictions for a user"""
        db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).delete()
    
    # ========================================
    # Knockout Prediction Operations
    # ========================================
    
    @staticmethod
    def _get_knockout_model(is_draft: bool = False):
        """Return the appropriate model class based on is_draft flag"""
        if is_draft:
            return KnockoutStagePredictionDraft
        return KnockoutStagePrediction
    
    @staticmethod
    def get_knockout_prediction_by_id(db: Session, prediction_id: int, is_draft: bool = False) -> Optional[Any]:
        """Get knockout prediction by ID"""
        model = PredictionRepository._get_knockout_model(is_draft)
        return db.query(model).filter(model.id == prediction_id).first()
    
    @staticmethod
    def get_knockout_predictions_by_user(db: Session, user_id: int, stage: Optional[str] = None, is_draft: bool = False) -> List[Any]:
        """Get all knockout predictions for a user, optionally filtered by stage"""
        model = PredictionRepository._get_knockout_model(is_draft)
        query = db.query(model).filter(model.user_id == user_id)
        if stage:
            query = query.filter(model.stage == stage)
        return query.all()
    
    @staticmethod
    def get_knockout_prediction_by_user_and_match(db: Session, user_id: int, match_id: int, is_draft: bool = False) -> Optional[Any]:
        """Get knockout prediction by user_id and template_match_id"""
        model = PredictionRepository._get_knockout_model(is_draft)
        return db.query(model).filter(
            model.user_id == user_id,
            model.template_match_id == match_id
        ).first()
    
    @staticmethod
    def get_knockout_prediction_by_user_and_team2(db: Session, user_id: int, team2_id: int, is_draft: bool = False) -> Optional[Any]:
        """Get knockout prediction by user_id and team2_id"""
        model = PredictionRepository._get_knockout_model(is_draft)
        return db.query(model).filter(
            model.user_id == user_id,
            model.team2_id == team2_id
        ).first()
    
    @staticmethod
    def create_knockout_prediction(db: Session, user_id: int, knockout_result_id: int, template_match_id: int,
                                  stage: str, team1_id: Optional[int] = None, team2_id: Optional[int] = None,
                                  winner_team_id: Optional[int] = None, knockout_pred_id: Optional[int] = None,
                                  status: Optional[str] = None, is_draft: bool = False) -> Any:
        """Create a new knockout prediction"""
        model = PredictionRepository._get_knockout_model(is_draft)
        prediction = model(
            user_id=user_id,
            knockout_result_id=knockout_result_id,
            template_match_id=template_match_id,
            stage=stage,
            team1_id=team1_id,
            team2_id=team2_id,
            winner_team_id=winner_team_id
        )
        # Add knockout_pred_id only for draft
        if is_draft and knockout_pred_id is not None:
            prediction.knockout_pred_id = knockout_pred_id
        # Set status if provided (important for drafts to copy status from original)
        if status is not None:
            prediction.status = status
        db.add(prediction)
        db.flush()
        db.refresh(prediction)
        return prediction
    
    @staticmethod
    def update_knockout_prediction(db: Session, prediction: Any, team1_id: Optional[int] = None,
                                  team2_id: Optional[int] = None, winner_team_id: Optional[int] = None,
                                  status: Optional[str] = None) -> Any:
        """
        Update an existing knockout prediction (works with both regular and draft)
        Note: Pass 0 to explicitly set a value to 0 (used as sentinel for clearing values)
        """
        # Update if parameter was provided (even if 0)
        if team1_id is not None:
            prediction.team1_id = team1_id
        if team2_id is not None:
            prediction.team2_id = team2_id
        if winner_team_id is not None:
            prediction.winner_team_id = winner_team_id
        if status is not None:
            prediction.status = status
        db.flush()
        return prediction
    
    # ========================================
    # Helper/Supporting Operations
    # ========================================
    
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_match(db: Session, match_id: int) -> Optional[Match]:
        """Get match by ID"""
        return db.query(Match).filter(Match.id == match_id).first()
    
    @staticmethod
    def get_group(db: Session, group_id: int) -> Optional[Group]:
        """Get group by ID"""
        return db.query(Group).filter(Group.id == group_id).first()
    
    @staticmethod
    def get_groups_ordered(db: Session) -> List[Group]:
        """Get all groups ordered by ID"""
        return db.query(Group).order_by(Group.id).all()
    
    @staticmethod
    def get_team(db: Session, team_id: int) -> Optional[Team]:
        """Get team by ID"""
        return db.query(Team).filter(Team.id == team_id).first()
    
    @staticmethod
    def get_match_template(db: Session, template_id: int) -> Optional[MatchTemplate]:
        """Get match template by ID"""
        return db.query(MatchTemplate).filter(MatchTemplate.id == template_id).first()
    
    @staticmethod
    def get_user_scores(db: Session, user_id: int) -> Optional[UserScores]:
        """Get user scores by user_id"""
        return db.query(UserScores).filter(UserScores.user_id == user_id).first()
    
    @staticmethod
    def get_third_place_combination_by_hash(db: Session, hash_key: str) -> Optional[ThirdPlaceCombination]:
        """Get third place combination by hash key"""
        return db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()
    
    # ========================================
    # Result Operations (for checking if results exist)
    # ========================================
    
    @staticmethod
    def get_group_stage_result_by_group(db: Session, group_id: int):
        """Get group stage result by group_id"""
        from models.results import GroupStageResult
        return db.query(GroupStageResult).filter(
            GroupStageResult.group_id == group_id
        ).first()
    
    @staticmethod
    def get_third_place_result(db: Session):
        """Get third place result (there's only one)"""
        from models.results import ThirdPlaceResult
        return db.query(ThirdPlaceResult).first()
    
    @staticmethod
    def get_knockout_stage_result_by_match(db: Session, match_id: int):
        """Get knockout stage result by match_id"""
        from models.results import KnockoutStageResult
        return db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == match_id
        ).first()
    
    # ========================================
    # Template and Group Operations
    # ========================================
    
    @staticmethod
    def get_match_templates_by_stage(db: Session, stage: str) -> List[MatchTemplate]:
        """Get all match templates for a specific stage"""
        return db.query(MatchTemplate).filter(
            MatchTemplate.stage == stage
        ).all()
    
    @staticmethod
    def get_group_by_name(db: Session, group_name: str) -> Optional[Group]:
        """Get group by name"""
        return db.query(Group).filter(Group.name == group_name).first()
    
    @staticmethod
    def get_group_template_by_name(db: Session, group_name: str):
        """Get group template by group name"""
        from models.group_template import GroupTemplate
        return db.query(GroupTemplate).filter(GroupTemplate.group_name == group_name).first()
    
    @staticmethod
    def get_group_prediction_by_user_and_group_id(db: Session, user_id: int, group_id: int):
        """Get group prediction by user_id and group_id (for third place resolution)"""
        from models.predictions import GroupStagePrediction
        return db.query(GroupStagePrediction).filter(
            GroupStagePrediction.group_id == group_id,
            GroupStagePrediction.user_id == user_id
        ).first()
    
    @staticmethod
    def commit(db: Session):
        """Commit changes to database"""
        db.commit()
    
    @staticmethod
    def flush(db: Session):
        """Flush changes to database"""
        db.flush()
    
    # ========================================
    # Status Management Operations
    # ========================================
    
    @staticmethod
    def set_prediction_status(prediction, status):
        """
        Updates the status of a knockout prediction and its updated_at timestamp
        Note: This modifies the prediction object in memory. Call commit() to persist.
        """
        from datetime import datetime
        from .shared import PredictionStatus
        
        # If status is already a PredictionStatus enum, use it directly
        if isinstance(status, PredictionStatus):
            prediction.status = status.value
        else:
            # If it's a string or other type, assume it's already the value
            prediction.status = status
        
        prediction.updated_at = datetime.utcnow()

