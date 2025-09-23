from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.predictions import MatchPrediction, GroupStagePrediction
from models.results import MatchResult, GroupStageResult
from models.user import User


class ScoringService:
    """Service for calculating and managing user points based on predictions."""
    
    # Scoring rules constants
    MATCH_PREDICTION_RULES = {
        'exact_score': 3,      # Exact score prediction
        'correct_winner': 1,   # Correct winner/draw prediction
        'wrong': 0            # Wrong prediction
    }
    
    # חוקי ניקוד לניחושי בתים
    GROUP_PREDICTION_RULES = {
        'first_place': 5,     # פגיעה מדויקת במקום 1
        'second_place': 4,    # פגיעה מדויקת במקום 2  
        'third_place': 3,     # פגיעה מדויקת במקום 3
        'fourth_place': 0,    # מקום 4 - אין ניקוד
        'wrong': 0           # קבוצה לא נכונה
    }
    
    @staticmethod
    def is_correct_winner(prediction: MatchPrediction, result: MatchResult) -> bool:
        """
        Check if the predicted winner matches the actual winner.
        
        Args:
            prediction: MatchPrediction object
            result: MatchResult object
            
        Returns:
            bool: True if winner is correct, False otherwise
        """
        # Input validation - only check for None/null values
        if not prediction or not result:
            return False
        
        return prediction.predicted_winner == result.winner_team_id
    
    @staticmethod
    def is_exact_scores(prediction: MatchPrediction, result: MatchResult) -> bool:
        """
        Check if the predicted scores match the actual scores exactly.
        
        Args:
            prediction: MatchPrediction object
            result: MatchResult object
            
        Returns:
            bool: True if scores match exactly, False otherwise
        """
        # Input validation - only check for None/null values
        if not prediction or not result:
            return False
        
        return (prediction.home_score == result.home_team_score and 
                prediction.away_score == result.away_team_score)
    
    
    @staticmethod
    def calculate_match_prediction_points(
        prediction: MatchPrediction, 
        result: MatchResult
    ) -> int:
        """
        Calculate points for a match prediction based on the actual result.
        
        Args:
            prediction: MatchPrediction object
            result: MatchResult object
            
        Returns:
            int: Points awarded for this prediction
        """
        if not result:
            return 0
            
        # First check: is the winning team correct?
        if not ScoringService.is_correct_winner(prediction, result):
            return ScoringService.MATCH_PREDICTION_RULES['wrong']
        
        # Second check: is the exact score correct?
        if ScoringService.is_exact_scores(prediction, result):
            return ScoringService.MATCH_PREDICTION_RULES['exact_score']
        
        # Winner is correct but score is wrong
        return ScoringService.MATCH_PREDICTION_RULES['correct_winner']
    
    @staticmethod
    def get_leaderboard(db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get the leaderboard with top users by points.
        
        Args:
            db: Database session
            limit: Maximum number of users to return
            
        Returns:
            List of users with their points, ordered by points descending
        """
        users = db.query(User).order_by(User.total_points.desc()).limit(limit).all()
        
        leaderboard = []
        for rank, user in enumerate(users, 1):
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "name": user.name,
                "total_points": user.total_points
            })
        
        return leaderboard
    
    @staticmethod
    def update_match_scoring_for_all_users(db: Session, result: MatchResult) -> Dict[str, Any]:
        """
        Update scoring for all users who predicted a specific match.
        This is called when a match result is updated.
        
        Args:
            db: Database session
            result: MatchResult object that was just updated
            
        Returns:
            Dict with summary of the operation
        """
        # Get all users who predicted this match
        predictions = db.query(MatchPrediction).filter(
            MatchPrediction.match_id == result.match_id
        ).all()
        
        updated_users = set()
        for prediction in predictions:
            # Calculate new points for this prediction
            new_points = ScoringService.calculate_match_prediction_points(prediction, result)
            
            # Update prediction points
            old_points = prediction.points
            prediction.points = new_points
            
            # Update user total points
            user = db.query(User).filter(User.id == prediction.user_id).first()
            if user:
                user.total_points = user.total_points - old_points + new_points
                updated_users.add(prediction.user_id)
        
        db.commit()
        
        return {
            "message": f"Updated scoring for {len(updated_users)} users",
            "updated_users": len(updated_users),
            "match_id": result.match_id
        }
    
    @staticmethod
    def calculate_group_prediction_points(prediction: GroupStagePrediction, result: GroupStageResult) -> int:
        """
        Calculate points for a group stage prediction based on the actual result.
        
        Args:
            prediction: GroupStagePrediction object
            result: GroupStageResult object
            
        Returns:
            int: Total points awarded for this group prediction
        """
        if not prediction or not result:
            return 0
        
        total_points = 0
        
        # Check each position
        prediction_positions = [
            (prediction.first_place, result.first_place, 'first_place'),
            (prediction.second_place, result.second_place, 'second_place'),
            (prediction.third_place, result.third_place, 'third_place'),
            (prediction.fourth_place, result.fourth_place, 'fourth_place')
        ]
        
        for pred_team, actual_team, position in prediction_positions:
            if pred_team == actual_team:
                total_points += ScoringService.GROUP_PREDICTION_RULES[position]
        
        return total_points
    
    @staticmethod
    def update_group_scoring_for_all_users(db: Session, result: GroupStageResult) -> Dict[str, Any]:
        """
        Update scoring for all users who predicted a specific group.
        This is called when a group result is updated.
        
        Args:
            db: Database session
            result: GroupStageResult object that was just updated
            
        Returns:
            Dict with summary of the operation
        """
        # Get all users who predicted this group
        predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.group_id == result.group_id
        ).all()
        
        updated_users = set()
        for prediction in predictions:
            # Calculate new points for this prediction
            new_points = ScoringService.calculate_group_prediction_points(prediction, result)
            
            # Update prediction points
            old_points = prediction.points
            prediction.points = new_points
            
            # Update user total points
            user = db.query(User).filter(User.id == prediction.user_id).first()
            if user:
                user.total_points = user.total_points - old_points + new_points
                updated_users.add(prediction.user_id)
        
        db.commit()
        
        return {
            "message": f"Updated group scoring for {len(updated_users)} users",
            "updated_users": len(updated_users),
            "group_id": result.group_id
        }
    
