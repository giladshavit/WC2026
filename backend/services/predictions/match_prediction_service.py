from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from models.matches import Match, MatchStatus
from .prediction_repository import PredictionRepository
from services.scoring_service import ScoringService


class MatchPredictionService:
    """Service for match prediction operations (group stage matches)"""
    
    @staticmethod
    def _validate_match_and_editable(db: Session, match_id: int) -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
        """
        Validate that match exists and is editable
        Returns: (match, error_dict) - if error, match is None and error_dict is returned
        """
        match = PredictionRepository.get_match(db, match_id)
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
        PredictionRepository.update_match_prediction(
            db, existing_prediction, home_score, away_score, predicted_winner
        )
        PredictionRepository.commit(db)
        
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
        new_prediction = PredictionRepository.create_match_prediction(
            db, user_id, match_id, home_score, away_score, predicted_winner
        )
        PredictionRepository.commit(db)
        
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
    
    @staticmethod
    def create_or_update_match_prediction(db: Session, user_id: int, match_id: int, 
                                         home_score: Optional[int], away_score: Optional[int]) -> Dict[str, Any]:
        """
        Create or update a single match prediction
        """
        # Validate match exists and is editable
        match, error = MatchPredictionService._validate_match_and_editable(db, match_id)
        if error:
            return error
        
        # Calculate predicted winner based on scores
        predicted_winner = MatchPredictionService._calculate_predicted_winner(match, home_score, away_score)
        
        # Check if prediction already exists for this match
        existing_prediction = PredictionRepository.get_match_prediction_by_user_and_match(db, user_id, match_id)
        
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
            PredictionRepository.flush(db)
        
        # Commit all changes to database
        PredictionRepository.commit(db)
        
        return {
            "predictions": results,
            "total_updated": len([r for r in results if r.get("updated")]),
            "total_created": len([r for r in results if not r.get("updated")])
        }

