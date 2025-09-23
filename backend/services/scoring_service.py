from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult
from models.user import User
from models.team import Team


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
    
    # חוקי ניקוד לעולות ממקום 3 - לפי דיוק בתים
    THIRD_PLACE_RULES = {
        'bonus_per_extra_group': 5,  # 5 נקודות לכל בית נוסף מעבר ל-4 בתים נכונים
        'minimum_groups_for_points': 4  # צריך לפחות 5 בתים נכונים כדי לקבל נקודות
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
    
    @staticmethod
    def calculate_third_place_prediction_points(prediction: ThirdPlacePrediction, result: ThirdPlaceResult, db: Session) -> int:
        """
        Calculate points for a third place prediction based on group accuracy.
        
        Scoring logic:
        - Get list of groups from user's prediction
        - Get list of groups from actual results
        - Find common groups (correct predictions)
        - Award 5 points for each group beyond the first 4 correct groups
        
        Args:
            prediction: ThirdPlacePrediction object
            result: ThirdPlaceResult object
            db: Database session for team lookups
            
        Returns:
            int: Total points awarded for this third place prediction
        """
        if not prediction or not result:
            return 0
        
        # Get all teams from prediction
        prediction_teams = [
            prediction.first_team_qualifying,
            prediction.second_team_qualifying,
            prediction.third_team_qualifying,
            prediction.fourth_team_qualifying,
            prediction.fifth_team_qualifying,
            prediction.sixth_team_qualifying,
            prediction.seventh_team_qualifying,
            prediction.eighth_team_qualifying
        ]
        
        # Get all teams from actual results
        result_teams = [
            result.first_team_qualifying,
            result.second_team_qualifying,
            result.third_team_qualifying,
            result.fourth_team_qualifying,
            result.fifth_team_qualifying,
            result.sixth_team_qualifying,
            result.seventh_team_qualifying,
            result.eighth_team_qualifying
        ]
        
        # Get group names for prediction teams
        prediction_groups = set()
        for team_id in prediction_teams:
            group_name = ScoringService.get_team_group_name(team_id, db)
            if group_name:
                prediction_groups.add(group_name)
        
        # Get group names for result teams
        result_groups = set()
        for team_id in result_teams:
            group_name = ScoringService.get_team_group_name(team_id, db)
            if group_name:
                result_groups.add(group_name)
        
        # Find common groups (correct predictions)
        common_groups = prediction_groups.intersection(result_groups)
        correct_count = len(common_groups)
        
        # Calculate points: bonus points for each correct group beyond the minimum
        minimum_groups = ScoringService.THIRD_PLACE_RULES['minimum_groups_for_points']
        bonus_per_group = ScoringService.THIRD_PLACE_RULES['bonus_per_extra_group']
        
        if correct_count <= minimum_groups:
            return 0
        else:
            bonus_groups = correct_count - minimum_groups
            return bonus_groups * bonus_per_group
    
    @staticmethod
    def get_team_group_name(team_id: int, db: Session) -> Optional[str]:
        """
        Get the group name for a given team ID.
        
        Args:
            team_id: ID of the team
            db: Database session
            
        Returns:
            str: Group name (A, B, C, etc.) or None if not found
        """
        team = db.query(Team).filter(Team.id == team_id).first()
        return team.group_letter if team and team.group_letter else None
    
    @staticmethod
    def update_third_place_scoring_for_all_users(db: Session, result: ThirdPlaceResult) -> Dict[str, Any]:
        """
        Update scoring for all users who predicted third place qualifying teams.
        This is called when third place results are updated.
        
        Args:
            db: Database session
            result: ThirdPlaceResult object that was just updated
            
        Returns:
            Dict with summary of the operation
        """
        # Get all users who predicted third place qualifying teams
        predictions = db.query(ThirdPlacePrediction).all()
        
        updated_users = set()
        for prediction in predictions:
            # Calculate new points for this prediction
            new_points = ScoringService.calculate_third_place_prediction_points(prediction, result, db)
            
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
            "message": f"Updated third place scoring for {len(updated_users)} users",
            "updated_users": len(updated_users)
        }
    
