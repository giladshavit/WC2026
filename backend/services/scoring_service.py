from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction
from models.predictions import KnockoutStagePrediction
from models.results import KnockoutStageResult
from models.matches import Match
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult
from models.user import User
from models.user_scores import UserScores
from models.team import Team
from services.stage_manager import StageManager, Stage


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

    # חוקי ניקוד למשחקי נוקאאוט - לפי שלב
    KNOCKOUT_SCORING_RULES = {
        "round32": 10,    # 32 הגדולות - 10 נקודות למנצח נכון
        "round16": 15,    # 16 הגדולות - 15 נקודות למנצח נכון
        "quarter": 20,    # רבע גמר - 20 נקודות למנצח נכון
        "semi": 30,       # חצי גמר - 30 נקודות למנצח נכון
        "final": 40       # גמר - 40 נקודות למנצח נכון
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
            
            # Update user scores in user_scores table
            user_scores = db.query(UserScores).filter(UserScores.user_id == prediction.user_id).first()
            if not user_scores:
                # Create new UserScores record if it doesn't exist
                user_scores = UserScores(
                    user_id=prediction.user_id,
                    matches_score=0,
                    groups_score=0,
                    third_place_score=0,
                    knockout_score=0,
                    penalty=0,
                    total_points=0
                )
                db.add(user_scores)
            
            # Update matches score and total points
            user_scores.matches_score = user_scores.matches_score - old_points + new_points
            ScoringService.update_total_points(user_scores)
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
            old_points = prediction.poinמעולהts
            prediction.points = new_points
            
            # Update user scores in user_scores table
            user_scores = db.query(UserScores).filter(UserScores.user_id == prediction.user_id).first()
            if not user_scores:
                # Create new UserScores record if it doesn't exist
                user_scores = UserScores(
                    user_id=prediction.user_id,
                    matches_score=0,
                    groups_score=0,
                    third_place_score=0,
                    knockout_score=0,
                    penalty=0,
                    total_points=0
                )
                db.add(user_scores)
            
            # Update groups score and total points
            user_scores.groups_score = user_scores.groups_score - old_points + new_points
            ScoringService.update_total_points(user_scores)
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
            
            # Update user scores in user_scores table
            user_scores = db.query(UserScores).filter(UserScores.user_id == prediction.user_id).first()
            if not user_scores:
                # Create new UserScores record if it doesn't exist
                user_scores = UserScores(
                    user_id=prediction.user_id,
                    matches_score=0,
                    groups_score=0,
                    third_place_score=0,
                    knockout_score=0,
                    penalty=0,
                    total_points=0
                )
                db.add(user_scores)
            
            # Update third place score and total points
            user_scores.third_place_score = user_scores.third_place_score - old_points + new_points
            ScoringService.update_total_points(user_scores)
            updated_users.add(prediction.user_id)
        
        db.commit()
        
        return {
            "message": f"Updated third place scoring for {len(updated_users)} users",
            "updated_users": len(updated_users)
        }
    
    @staticmethod
    def calculate_knockout_prediction_points(prediction: KnockoutStagePrediction, result: KnockoutStageResult, stage: str) -> int:
        """
        Calculate points for a knockout stage prediction.
        Points are awarded based on correct winner prediction and stage.
        """
        # Get the points for this stage
        stage_points = ScoringService.KNOCKOUT_SCORING_RULES.get(stage, 0)
        
        # Calculate points based on correct winner
        if prediction.winner_team_id == result.winner_team_id:
            # Correct winner prediction
            return stage_points
        else:
            # Wrong prediction
            return 0
    
    @staticmethod
    def update_knockout_scoring_for_all_users(db: Session, knockout_result: KnockoutStageResult) -> Dict[str, Any]:
        """
        Update scoring for all users who predicted this knockout match.
        Points are awarded based on correct winner prediction.
        """
        # Get the match to determine the stage
        match = db.query(Match).filter(Match.id == knockout_result.match_id).first()
        if not match:
            return {"message": "Match not found", "updated_users": 0}
        
        # Find all predictions for this knockout match
        predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == knockout_result.match_id
        ).all()
        
        updated_users = set()
        for prediction in predictions:
            # Save old points before updating
            old_points = prediction.points if prediction.points else 0
            
            # Calculate new points using the helper function
            new_points = ScoringService.calculate_knockout_prediction_points(prediction, knockout_result, match.stage)
            prediction.points = new_points
            
            # Update user scores in user_scores table
            user_scores = db.query(UserScores).filter(UserScores.user_id == prediction.user_id).first()
            if not user_scores:
                # Create new UserScores record if it doesn't exist
                user_scores = UserScores(
                    user_id=prediction.user_id,
                    matches_score=0,
                    groups_score=0,
                    third_place_score=0,
                    knockout_score=0,
                    penalty=0,
                    total_points=0
                )
                db.add(user_scores)
            
            # Update knockout score and total points
            user_scores.knockout_score = user_scores.knockout_score - old_points + new_points
            ScoringService.update_total_points(user_scores)
            updated_users.add(prediction.user_id)
        
        db.commit()
        
        return {
            "message": f"Updated knockout scoring for {len(updated_users)} users",
            "updated_users": len(updated_users),
            "stage": match.stage,
            "stage_points": ScoringService.KNOCKOUT_SCORING_RULES.get(match.stage, 0)
        }
    
    # === HELPER FUNCTIONS ===
    
    @staticmethod
    def get_total_scores(user_scores: UserScores) -> int:
        """Calculate total scores from all prediction types (without penalty)."""
        return (user_scores.matches_score + 
                user_scores.groups_score + 
                user_scores.third_place_score + 
                user_scores.knockout_score)
    
    @staticmethod
    def get_total_penalties(user_scores: UserScores) -> int:
        """Get total penalty points for user."""
        return user_scores.penalty
    
    @staticmethod
    def update_total_points(user_scores: UserScores) -> None:
        """Update total_points field based on scores and penalties."""
        user_scores.total_points = (ScoringService.get_total_scores(user_scores) - 
                                  ScoringService.get_total_penalties(user_scores))
    
    # === PENALTY SYSTEM ===
    
    @staticmethod
    def calculate_penalty_points(changes: int, current_stage: Stage) -> int:
        """Calculate penalty points based on number of changes and current stage."""
        penalty_per_change = current_stage.get_penalty_for()
        return changes * penalty_per_change
    
    @staticmethod
    def apply_penalty_to_user(db: Session, user_id: int, penalty_points: int) -> Dict[str, Any]:
        """Apply penalty points to user's score in user_scores table."""
        # Get or create user_scores record
        user_scores = db.query(UserScores).filter(UserScores.user_id == user_id).first()
        if not user_scores:
            # Create new UserScores record if it doesn't exist
            user_scores = UserScores(
                user_id=user_id,
                matches_score=0,
                groups_score=0,
                third_place_score=0,
                knockout_score=0,
                penalty=0,
                total_points=0
            )
            db.add(user_scores)
            db.flush()
        
        old_penalty = user_scores.penalty
        old_total = user_scores.total_points
        
        # Add penalty points to accumulated penalty
        user_scores.penalty = user_scores.penalty + penalty_points
        
        # Recalculate total points using helper function
        ScoringService.update_total_points(user_scores)
        
        db.commit()
        
        return {
            "user_id": user_id,
            "old_penalty": old_penalty,
            "new_penalty": user_scores.penalty,
            "penalty_added": penalty_points,
            "old_total_points": old_total,
            "new_total_points": user_scores.total_points
        }
    
    @staticmethod
    def apply_prediction_penalty(db: Session, user_id: int, total_changes: int) -> int:
        """
        Apply penalty for prediction changes (groups, third-place, knockout, etc.).
        Returns the penalty points applied.
        """
        if total_changes == 0:
            return 0
        
        current_stage = StageManager.get_current_stage(db)
        penalty_points = ScoringService.calculate_penalty_points(total_changes, current_stage)
        
        if penalty_points == 0:
            return 0
        
        ScoringService.apply_penalty_to_user(db, user_id, penalty_points)
        return penalty_points
    
