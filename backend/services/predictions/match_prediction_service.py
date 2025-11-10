from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from models.matches import Match, MatchStatus
from models.predictions import MatchPrediction
from models.user_scores import UserScores
from models.results import MatchResult
from .db_prediction_repository import DBPredRepository
from services.scoring_service import ScoringService


class MatchPredictionService:
    """Service for match prediction operations"""

    # ========================================
    # get "/predictions/matches"
    # ========================================
    @staticmethod
    def get_all_matches_with_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get all matches with the user's predictions and user scores.
        """
        matches = DBPredRepository.get_all_matches(db)
        all_matches: List[Dict[str, Any]] = []

        for match in matches:
            if not MatchPredictionService._are_both_teams_set(match):
                continue

            MatchPredictionService._update_match_status_if_needed(match, db)

            prediction = DBPredRepository.get_match_prediction_by_user_and_match(db, user_id, match.id)

            actual_result = DBPredRepository.get_match_result_by_match(db, match.id)

            match_data = MatchPredictionService._create_match_data(match, prediction, actual_result)
            all_matches.append(match_data)

        all_matches.sort(key=lambda x: x["date"])

        user_scores = DBPredRepository.get_user_scores(db, user_id)

        return {
            "matches": all_matches,
            "matches_score": user_scores.matches_score if user_scores else None,
        }

    @staticmethod
    def _create_match_data(match: Match, prediction: Optional[MatchPrediction] = None, actual_result: Optional[MatchResult] = None) -> Dict[str, Any]:
        """
        Build a serializable match payload used by API consumers.
        Now includes actual match results if available.
        """
        match_data: Dict[str, Any] = {
            "id": match.id,
            "stage": match.stage,
            "home_team": {
                "id": match.home_team.id if match.home_team else None,
                "name": match.home_team.name if match.home_team else None,
                "flag_url": match.home_team.flag_url if match.home_team else None,
            },
            "away_team": {
                "id": match.away_team.id if match.away_team else None,
                "name": match.away_team.name if match.away_team else None,
                "flag_url": match.away_team.flag_url if match.away_team else None,
            },
            "date": match.date.isoformat(),
            "status": match.status,
            "user_prediction": {
                "home_score": prediction.home_score if prediction else None,
                "away_score": prediction.away_score if prediction else None,
                "predicted_winner": prediction.predicted_winner if prediction else None,
                "points": prediction.points if prediction else None,
                "is_editable": prediction.is_editable if prediction else None,
            },
            "can_edit": match.is_editable,
        }

        if actual_result:
            match_data["actual_result"] = {
                "home_score": actual_result.home_team_score,
                "away_score": actual_result.away_team_score,
                "winner_team_id": actual_result.winner_team_id,
            }
        else:
            match_data["actual_result"] = None

        if match.is_group_stage:
            match_data["group"] = match.group
        elif match.is_knockout:
            match_data["match_number"] = match.match_number
            match_data["home_team_source"] = match.home_team_source
            match_data["away_team_source"] = match.away_team_source

        return match_data

    @staticmethod
    def _update_match_status_if_needed(match: Match, db: Session) -> None:
        """Update match status based on current time since match start."""
        current_time = datetime.utcnow()
        time_since_match_start = (current_time - match.date).total_seconds() / 3600

        if match.status == MatchStatus.SCHEDULED.value:
            if 0 <= time_since_match_start <= 1.0:
                match.status = MatchStatus.LIVE_EDITABLE.value
            elif time_since_match_start > 1.0:
                match.status = MatchStatus.LIVE_LOCKED.value
        elif match.status == MatchStatus.LIVE_EDITABLE.value:
            if time_since_match_start > 1.0:
                match.status = MatchStatus.LIVE_LOCKED.value

        DBPredRepository.commit(db)

    @staticmethod
    def _are_both_teams_set(match: Match) -> bool:
        """
        Return True if both teams are set (not None) for a given match.
        """
        return bool(match.home_team and match.away_team)

    @staticmethod
    def update_match_status(db: Session, match_id: int, status: str) -> Dict[str, Any]:
        """
        Update match status (admin only).
        """
        try:
            match = DBPredRepository.get_match(db, match_id)
            if not match:
                return {"error": "Match not found"}

            match.status = status
            DBPredRepository.commit(db)

            return {
                "id": match.id,
                "status": match.status,
                "updated": True,
            }
        except Exception as exc:
            DBPredRepository.rollback(db)
            return {"error": f"Failed to update match status: {str(exc)}"}

    # ========================================
    # post "/predictions/matches/batch"
    # ========================================  

    @staticmethod
    def create_or_update_match_prediction(db: Session, user_id: int, match_id: int, 
                                         home_score: Optional[int], away_score: Optional[int]) -> Dict[str, Any]:
        """
        Create or update a single match prediction
        """
        # Validate match exists and is editable
        match, error = MatchPredictionService._get_editable_match_or_error(db, match_id)
        if error:
            return error
        
        # Calculate predicted winner based on scores
        predicted_winner = MatchPredictionService._calculate_predicted_winner(match, home_score, away_score)
        
        # Check if prediction already exists for this match
        existing_prediction = DBPredRepository.get_match_prediction_by_user_and_match(db, user_id, match_id)
        
        if existing_prediction:
            return MatchPredictionService._update_existing_prediction(
                db, user_id, match_id, match, existing_prediction, 
                home_score, away_score, predicted_winner
            )
        else:
            return MatchPredictionService._create_new_prediction(
                db, user_id, match_id, match, 
                home_score, away_score, predicted_winner
            )
    
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
            
            if not match_id:
                return {"error": f"Missing match_id"}
            
            # Use existing function for each prediction
            result = MatchPredictionService.create_or_update_match_prediction(
                db, user_id, match_id, home_score, away_score
            )
            results.append(result)
            
            # Force database flush after each update
            DBPredRepository.flush(db)
        
        # Commit all changes to database
        DBPredRepository.commit(db)
        
        return {
            "predictions": results,
            "total_updated": len([r for r in results if r.get("updated")]),
            "total_created": len([r for r in results if not r.get("updated")])
        }

    @staticmethod
    def _get_editable_match_or_error(db: Session, match_id: int) -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
        """
        Validate that match exists and is editable
        Returns: (match, error_dict) - if error, match is None and error_dict is returned
        """
        match = DBPredRepository.get_match(db, match_id)
        if not match:
            return None, {"error": "Match not found"}
        
        if not match.is_editable:
            return None, {"error": "Match is no longer editable"}
        
        return match, None
    
    @staticmethod
    def _calculate_predicted_winner(match: Any, home_score: Optional[int], away_score: Optional[int]) -> Optional[int]:
        """
        Calculate predicted winner based on scores
        Returns: team_id (or 0 for draw, or None if scores are None)
        """
        if home_score is None or away_score is None:
            return None
        
        if home_score > away_score:
            return match.home_team_id
        elif away_score > home_score:
            return match.away_team_id
        else:
            return 0  # draw
    
    @staticmethod
    def _apply_penalty_if_needed(db: Session, user_id: int, match: Any) -> int:
        """
        Apply penalty only if match is live_editable
        Returns: penalty points applied
        """
        if match.status == MatchStatus.LIVE_EDITABLE.value:
            return ScoringService.apply_match_prediction_penalty(db, user_id)
        return 0
    
    @staticmethod
    def _update_existing_prediction(db: Session, user_id: int, match_id: int, match: Any,
                                   existing_prediction: Any, home_score: Optional[int], 
                                   away_score: Optional[int], predicted_winner: Optional[int]) -> Dict[str, Any]:
        """
        Update an existing match prediction
        """
        DBPredRepository.update_match_prediction(
            db, existing_prediction, home_score, away_score, predicted_winner
        )
        DBPredRepository.commit(db)
        
        penalty_applied = MatchPredictionService._apply_penalty_if_needed(db, user_id, match)
        
        return {
            "id": existing_prediction.id,
            "match_id": match_id,
            "home_score": home_score,
            "away_score": away_score,
            "predicted_winner": predicted_winner,
            "updated": True,
            "penalty_applied": penalty_applied
        }
    
    @staticmethod
    def _create_new_prediction(db: Session, user_id: int, match_id: int, match: Any,
                              home_score: Optional[int], away_score: Optional[int], 
                              predicted_winner: Optional[int]) -> Dict[str, Any]:
        """
        Create a new match prediction
        """
        new_prediction = DBPredRepository.create_match_prediction(
            db, user_id, match_id, home_score, away_score, predicted_winner
        )
        DBPredRepository.commit(db)
        
        penalty_applied = MatchPredictionService._apply_penalty_if_needed(db, user_id, match)
        
        return {
            "id": new_prediction.id,
            "match_id": match_id,
            "home_score": home_score,
            "away_score": away_score,
            "predicted_winner": predicted_winner,
            "updated": False,
            "penalty_applied": penalty_applied
        }

