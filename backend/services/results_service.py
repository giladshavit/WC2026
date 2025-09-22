from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.matches import Match
from models.results import MatchResult
from models.team import Team
from .scoring_service import ScoringService


class ResultsService:
    """Service for managing match results and admin operations."""
    
    @staticmethod
    def get_all_matches_with_results(db: Session) -> List[Dict[str, Any]]:
        """
        Get all matches that have both teams defined, with their current results.
        Returns matches with home_team, away_team, stage, date, and result data.
        """
        # Get all matches where both teams are defined
        matches = db.query(Match).filter(
            and_(
                Match.home_team_id.isnot(None),
                Match.away_team_id.isnot(None)
            )
        ).all()
        
        matches_with_results = []
        
        for match in matches:
            # Get the result if it exists
            result = db.query(MatchResult).filter(
                MatchResult.match_id == match.id
            ).first()
            
            match_data = {
                "match_id": match.id,
                "home_team": {
                    "id": match.home_team.id,
                    "name": match.home_team.name
                },
                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name
                },
                "stage": match.stage,
                "date": match.date.isoformat() if match.date else None,
                "result": {
                    "home_team_score": result.home_team_score if result else None,
                    "away_team_score": result.away_team_score if result else None,
                    "winner_team_id": result.winner_team_id if result else None
                }
            }
            
            matches_with_results.append(match_data)
        
        return matches_with_results
    
    @staticmethod
    def update_match_result(
        db: Session, 
        match_id: int, 
        home_team_score: int, 
        away_team_score: int
    ) -> Dict[str, Any]:
        """
        Update or create a match result.
        Winner team ID is calculated automatically based on scores.
        """
        # Verify the match exists and has both teams
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise ValueError(f"Match with ID {match_id} not found")
        
        if not match.home_team_id or not match.away_team_id:
            raise ValueError(f"Match {match_id} does not have both teams defined")
        
        # Validate scores
        if home_team_score < 0 or away_team_score < 0:
            raise ValueError("Scores must be non-negative")
        
        # Calculate winner automatically
        if home_team_score > away_team_score:
            winner_team_id = match.home_team_id
        elif away_team_score > home_team_score:
            winner_team_id = match.away_team_id
        else:
            winner_team_id = 0  # Draw (no team with ID 0)
        
        # Check if result already exists
        existing_result = db.query(MatchResult).filter(
            MatchResult.match_id == match_id
        ).first()
        
        if existing_result:
            # Update existing result
            existing_result.home_team_score = home_team_score
            existing_result.away_team_score = away_team_score
            existing_result.winner_team_id = winner_team_id
            result = existing_result
        else:
            # Create new result
            result = MatchResult(
                match_id=match_id,
                home_team_score=home_team_score,
                away_team_score=away_team_score,
                winner_team_id=winner_team_id
            )
            db.add(result)
        
        db.commit()
        db.refresh(result)
        
        # Update scoring for all users who predicted this match
        ScoringService.update_match_scoring_for_all_users(db, result)
        
        return {
            "match_id": match_id,
            "home_team_score": result.home_team_score,
            "away_team_score": result.away_team_score,
            "winner_team_id": result.winner_team_id,
            "message": "Match result updated successfully"
        }
