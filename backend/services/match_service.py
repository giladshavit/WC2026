from typing import Dict, List, Any
from sqlalchemy.orm import Session
from datetime import datetime
from models.matches import Match
from models.predictions import MatchPrediction

class MatchService:
    
    @staticmethod
    def get_all_matches_with_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all matches with the user's predictions
        """
        # Fetch all matches
        matches = db.query(Match).all()
        
        all_matches = []
        
        for match in matches:
            # Skip matches where both teams are not yet determined
            if not MatchService.are_both_teams_set(match):
                continue
            
            # Fetch the user's prediction for this match
            prediction = db.query(MatchPrediction).filter(
                MatchPrediction.user_id == user_id,
                MatchPrediction.match_id == match.id
            ).first()
            
            all_matches.append(MatchService.create_match_data(match, prediction))
        
        # Sort by date
        all_matches.sort(key=lambda x: x["date"])
        
        return all_matches

    @staticmethod
    def create_match_data(match: Match, prediction=None) -> Dict[str, Any]:
        """
        Build a serializable match payload used by API consumers.
        """
        match_data: Dict[str, Any] = {
            "id": match.id,
            "stage": match.stage,
            "home_team": {
                "id": match.home_team.id if match.home_team else None,
                "name": match.home_team.name if match.home_team else None,
            },
            "away_team": {
                "id": match.away_team.id if match.away_team else None,
                "name": match.away_team.name if match.away_team else None,
            },
            "date": match.date.isoformat(),
            "status": match.status,
            # User's prediction data
            "user_prediction": {
                "home_score": prediction.home_score if prediction else None,
                "away_score": prediction.away_score if prediction else None,
                "predicted_winner": prediction.predicted_winner if prediction else None,
                "points": prediction.points if prediction else None
            },
            "can_edit": match.status == "scheduled",
        }
        # Add specific details according to match type
        if match.is_group_stage:
            match_data["group"] = match.group
        elif match.is_knockout:
            match_data["match_number"] = match.match_number
            match_data["home_team_source"] = match.home_team_source
            match_data["away_team_source"] = match.away_team_source
        return match_data

    @staticmethod
    def are_both_teams_set(match: Match) -> bool:
        """
        Return True if both teams are set (not None) for a given match.
        """
        return bool(match.home_team and match.away_team)
