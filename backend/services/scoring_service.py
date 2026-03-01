from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from services.predictions.enums import MatchPredictionStatus, KnockoutPredictionStatus, PredictionType
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction
from models.predictions import KnockoutStagePrediction
from models.results import KnockoutStageResult
from models.matches import Match
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult
from models.user import User
from models.user_scores import UserScores
from models.team import Team
from services.stage_manager import StageManager, Stage
from services.database import DBReader, DBWriter, DBUtils


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

    # Full (correct path) vs partial (correct winner, wrong path) points per stage
    KNOCKOUT_SCORING = {
        "round32": {"full": 10, "partial": 5},
        "round16": {"full": 15, "partial": 7},
        "quarter": {"full": 20, "partial": 10},
        "semi": {"full": 30, "partial": 15},
        "final": {"full": 40, "partial": 20},
    }

    MATCH_STATUS_POINTS = {
        MatchPredictionStatus.EXACT: 3,
        MatchPredictionStatus.CORRECT_OUTCOME: 1,
        MatchPredictionStatus.WRONG: 0,
        MatchPredictionStatus.PENDING: 0,
    }

    @staticmethod
    def _apply_score_delta(db: Session, user_id: int, score_field: str, delta: int) -> None:
        """
        Apply a points delta to a specific score field and total_points on UserScores.
        Handles get-or-create of UserScores. Skips if delta is 0.
        """
        if delta == 0:
            return
        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)
        new_field_value = (getattr(user_scores, score_field) or 0) + delta
        new_total = (user_scores.total_points or 0) + delta
        DBWriter.update_user_scores(
            db, user_scores,
            **{score_field: new_field_value, 'total_points': new_total}
        )

    @staticmethod
    def _determine_match_status(prediction: MatchPrediction, result: MatchResult) -> MatchPredictionStatus:
        """Determine prediction status based on result. Returns enum member."""
        if not result:
            return MatchPredictionStatus.PENDING
        if ScoringService.is_exact_scores(prediction, result):
            return MatchPredictionStatus.EXACT
        if ScoringService.is_correct_winner(prediction, result):
            return MatchPredictionStatus.CORRECT_OUTCOME
        return MatchPredictionStatus.WRONG

    @staticmethod
    def match_status_to_points(status: MatchPredictionStatus) -> int:
        """Convert match status enum to points. Pure function, no DB access."""
        return ScoringService.MATCH_STATUS_POINTS.get(status, 0)

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
    ) -> tuple[int, MatchPredictionStatus]:
        """LEGACY - kept for backward compat. Main flow uses _determine_match_status + match_status_to_points."""
        if not result:
            return 0, MatchPredictionStatus.PENDING
        if not ScoringService.is_correct_winner(prediction, result):
            return ScoringService.MATCH_PREDICTION_RULES['wrong'], MatchPredictionStatus.WRONG
        if ScoringService.is_exact_scores(prediction, result):
            return ScoringService.MATCH_PREDICTION_RULES['exact_score'], MatchPredictionStatus.EXACT
        return ScoringService.MATCH_PREDICTION_RULES['correct_winner'], MatchPredictionStatus.CORRECT_OUTCOME
    
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
        users = DBReader.get_users_ordered_by_points(db, limit)
        
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
        predictions = DBReader.get_match_predictions_by_match(db, result.match_id)

        updated_users = set()
        for prediction in predictions:
            old_points = prediction.points if prediction.points is not None else 0

            # Step 1: Determine and save status
            status = ScoringService._determine_match_status(prediction, result)
            DBWriter.update_match_prediction_status(db, prediction, status)

            # Step 2: Points from status (pure)
            new_points = ScoringService.match_status_to_points(status)
            DBWriter.update_match_prediction(db, prediction, points=new_points)

            # Step 3: Delta update on UserScores (single line!)
            ScoringService._apply_score_delta(db, prediction.user_id, 'matches_score', new_points - old_points)

            updated_users.add(prediction.user_id)

        DBUtils.commit(db)
        return {
            "message": f"Updated scoring for {len(updated_users)} users",
            "updated_users": len(updated_users),
            "match_id": result.match_id
        }
    
    @staticmethod
    def calculate_group_prediction_points(prediction: GroupStagePrediction, result: GroupStageResult) -> Tuple[int, dict]:
        """
        Calculate points for a group prediction.
        Returns: (total_points, accuracy_info)
        accuracy_info = {
            'first_correct': bool, 'second_correct': bool,
            'third_correct': bool, 'fourth_correct': bool,
            'correct_positions_count': int
        }
        """
        if not prediction or not result:
            return 0, {}

        total_points = 0
        correct_count = 0
        accuracy = {}

        positions = [
            ('first_place', 'first_correct', ScoringService.GROUP_PREDICTION_RULES['first_place']),
            ('second_place', 'second_correct', ScoringService.GROUP_PREDICTION_RULES['second_place']),
            ('third_place', 'third_correct', ScoringService.GROUP_PREDICTION_RULES['third_place']),
            ('fourth_place', 'fourth_correct', ScoringService.GROUP_PREDICTION_RULES['fourth_place']),
        ]

        for pred_field, bool_key, points in positions:
            is_correct = getattr(prediction, pred_field) == getattr(result, pred_field)
            accuracy[bool_key] = is_correct
            if is_correct:
                total_points += points
                correct_count += 1

        accuracy['correct_positions_count'] = correct_count
        return total_points, accuracy
    
    @staticmethod
    def update_group_scoring_for_all_users(db: Session, result: GroupStageResult) -> Dict[str, Any]:
        predictions = DBReader.get_group_predictions_by_group(db, result.group_id)

        updated_users = set()
        for prediction in predictions:
            old_points = prediction.points if prediction.points is not None else 0

            # Step 1: Calculate points + accuracy
            new_points, accuracy = ScoringService.calculate_group_prediction_points(prediction, result)

            # Step 2: Save accuracy fields via DBWriter
            if accuracy:
                DBWriter.update_group_prediction_accuracy(
                    db, prediction,
                    first_correct=accuracy['first_correct'],
                    second_correct=accuracy['second_correct'],
                    third_correct=accuracy['third_correct'],
                    fourth_correct=accuracy['fourth_correct'],
                    correct_positions_count=accuracy['correct_positions_count'],
                )

            # Step 3: Save points
            DBWriter.update_group_prediction(db, prediction, points=new_points)

            # Step 4: Delta update on UserScores (single line!)
            ScoringService._apply_score_delta(db, prediction.user_id, 'groups_score', new_points - old_points)

            updated_users.add(prediction.user_id)

        DBUtils.commit(db)
        return {
            "message": f"Updated group scoring for {len(updated_users)} users",
            "updated_users": len(updated_users),
            "group_id": result.group_id
        }
    
    @staticmethod
    def _count_correct_third_place_groups(prediction: ThirdPlacePrediction, result: ThirdPlaceResult, db: Session) -> int:
        """Count how many groups overlap between prediction and result."""
        pred_fields = [
            'first_team_qualifying', 'second_team_qualifying',
            'third_team_qualifying', 'fourth_team_qualifying',
            'fifth_team_qualifying', 'sixth_team_qualifying',
            'seventh_team_qualifying', 'eighth_team_qualifying',
        ]

        def _get_groups(obj) -> set:
            groups = set()
            for field in pred_fields:
                team_id = getattr(obj, field, None)
                if team_id:
                    group = DBReader.get_team_group_letter(db, team_id)
                    if group:
                        groups.add(group)
            return groups

        return len(_get_groups(prediction).intersection(_get_groups(result)))

    @staticmethod
    def calculate_third_place_prediction_points_from_count(correct_groups_count: int) -> int:
        """Pure function: correct groups count → points. No DB access."""
        minimum = ScoringService.THIRD_PLACE_RULES['minimum_groups_for_points']
        bonus_per = ScoringService.THIRD_PLACE_RULES['bonus_per_extra_group']

        if correct_groups_count <= minimum:
            return 0
        return (correct_groups_count - minimum) * bonus_per

    @staticmethod
    def calculate_third_place_prediction_points(prediction: ThirdPlacePrediction, result: ThirdPlaceResult, db: Session) -> int:
        """LEGACY - kept for backward compat."""
        if not prediction or not result:
            return 0
        correct_count = ScoringService._count_correct_third_place_groups(prediction, result, db)
        return ScoringService.calculate_third_place_prediction_points_from_count(correct_count)

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
        return DBReader.get_team_group_letter(db, team_id)
    
    @staticmethod
    def update_third_place_scoring_for_all_users(db: Session, result: ThirdPlaceResult) -> Dict[str, Any]:
        predictions = DBReader.get_all_third_place_predictions(db)

        updated_users = set()
        for prediction in predictions:
            old_points = prediction.points if prediction.points is not None else 0

            # Step 1: Count correct groups and save to prediction
            correct_count = ScoringService._count_correct_third_place_groups(prediction, result, db)
            DBWriter.update_third_place_correct_groups(db, prediction, correct_count)

            # Step 2: Points from count (pure)
            new_points = ScoringService.calculate_third_place_prediction_points_from_count(correct_count)
            DBWriter.update_third_place_prediction_fields(db, prediction, points=new_points)

            # Step 3: Delta update on UserScores (single line!)
            ScoringService._apply_score_delta(db, prediction.user_id, 'third_place_score', new_points - old_points)

            updated_users.add(prediction.user_id)

        DBUtils.commit(db)
        return {
            "message": f"Updated third place scoring for {len(updated_users)} users",
            "updated_users": len(updated_users)
        }
    
    @staticmethod
    def calculate_knockout_prediction_points(prediction: KnockoutStagePrediction, result: KnockoutStageResult, stage: str) -> int:
        """
        Calculate points for a knockout stage prediction.
        Points are awarded based on prediction status: CORRECT_FULL, CORRECT_PARTIAL, or 0.
        """
        stage_scoring = ScoringService.KNOCKOUT_SCORING.get(stage, {"full": 0, "partial": 0})
        status = getattr(prediction, "status", None) or ""

        if status == KnockoutPredictionStatus.CORRECT_FULL.value:
            return stage_scoring.get("full", 0)
        if status == KnockoutPredictionStatus.CORRECT_PARTIAL.value:
            return stage_scoring.get("partial", 0)
        return 0
    
    @staticmethod
    def update_knockout_scoring_for_all_users(db: Session, knockout_result: KnockoutStageResult) -> Dict[str, Any]:
        """
        Update scoring for all users who predicted this knockout match.
        Points are awarded based on correct winner prediction.
        """
        # Get the match to determine the stage
        match = DBReader.get_match(db, knockout_result.match_id)
        if not match:
            return {"message": "Match not found", "updated_users": 0}
        
        # Find all predictions for this knockout match
        predictions = DBReader.get_knockout_predictions_by_match(db, knockout_result.match_id)
        
        updated_users = set()
        for prediction in predictions:
            old_points = prediction.points if prediction.points else 0

            new_points = ScoringService.calculate_knockout_prediction_points(prediction, knockout_result, match.stage)
            DBWriter.update_knockout_prediction(db, prediction, points=new_points)

            ScoringService._apply_score_delta(db, prediction.user_id, 'knockout_score', new_points - old_points)
            updated_users.add(prediction.user_id)
        
        DBUtils.commit(db)
        
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
    def update_total_points(user_scores: UserScores) -> int:
        """Calculate total_points based on scores and penalties."""
        return (ScoringService.get_total_scores(user_scores) -
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
        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)
        
        old_penalty = user_scores.penalty
        old_total = user_scores.total_points
        
        # Add penalty points to accumulated penalty
        new_penalty = (user_scores.penalty or 0) + penalty_points
        new_total_points = (
            (user_scores.matches_score or 0) +
            (user_scores.groups_score or 0) +
            (user_scores.third_place_score or 0) +
            (user_scores.knockout_score or 0) -
            new_penalty
        )
        DBWriter.update_user_scores(
            db,
            user_scores,
            penalty=new_penalty,
            total_points=new_total_points
        )
        
        DBUtils.commit(db)
        
        return {
            "user_id": user_id,
            "old_penalty": old_penalty,
            "new_penalty": new_penalty,
            "penalty_added": penalty_points,
            "old_total_points": old_total,
            "new_total_points": new_total_points
        }
    
    @staticmethod
    def record_prediction_penalty(
        db: Session,
        user_id: int,
        prediction_id: int,
        prediction_type: PredictionType,
        n_changes: int,
    ) -> int:
        """
        Calculate and record penalty for a specific prediction change.

        1. Calculate penalty via calculate_penalty_points
        2. Update prediction row (penalty_points, changes_count)
        3. Update category penalty in UserScores
        4. Update total penalty and total_points via apply_penalty_to_user
        """
        current_stage = StageManager.get_current_stage(db)
        penalty = ScoringService.calculate_penalty_points(n_changes, current_stage)

        if penalty == 0:
            return 0

        # Update the specific prediction
        DBWriter.add_prediction_penalty(
            db,
            prediction_id=prediction_id,
            prediction_type=prediction_type,
            penalty_delta=penalty,
            changes_delta=n_changes,
        )

        # Update category penalty in UserScores
        category_field = {
            PredictionType.GROUPS: "groups_penalty",
            PredictionType.THIRD_PLACE: "third_place_penalty",
            PredictionType.KNOCKOUT: "knockout_penalty",
        }[prediction_type]

        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            user_scores = DBWriter.create_user_scores(db, user_id)

        DBWriter.update_user_scores(
            db,
            user_scores,
            **{category_field: (getattr(user_scores, category_field) or 0) + penalty},
        )

        # Update total penalty and total_points
        ScoringService.apply_penalty_to_user(db, user_id, penalty)

        return penalty

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

    @staticmethod
    def apply_match_prediction_penalty(db: Session, user_id: int) -> int:
        """
        Apply penalty for match prediction changes.
        Returns the penalty points applied.
        """
        penalty_points = 1
        ScoringService.apply_penalty_to_user(db, user_id, penalty_points)
        return penalty_points
    
