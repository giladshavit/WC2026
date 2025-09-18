from typing import Dict, List, Any
from sqlalchemy.orm import Session
from datetime import datetime
from models.matches import Match
from models.predictions import MatchPrediction

class MatchService:
    
    @staticmethod
    def get_all_matches_with_predictions(db: Session) -> List[Dict[str, Any]]:
        """
        Get all matches (user-agnostic)
        """
        # Fetch all matches
        matches = db.query(Match).all()
        
        matches_with_predictions = []
        
        for match in matches:
            # Skip matches where either team is None
            if not match.home_team or not match.away_team:
                continue
            
            match_data = {
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
                # User-agnostic placeholder for UI compatibility
                "user_prediction": {
                    "home_score": None,
                    "away_score": None,
                    "predicted_winner": None
                },
                "can_edit": match.status == "scheduled"  # Can edit only matches that haven't been played
            }
            
            # Add specific details according to match type
            if match.is_group_stage:
                match_data["group"] = match.group
            elif match.is_knockout:
                match_data["match_number"] = match.match_number
                match_data["home_team_source"] = match.home_team_source
                match_data["away_team_source"] = match.away_team_source
            
            matches_with_predictions.append(match_data)
        
        # Sort by date
        matches_with_predictions.sort(key=lambda x: x["date"])
        
        return matches_with_predictions

    # Removed create_group_stage_match and create_knockout_match (not used; creation handled by scripts)