from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.matches import Match
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult
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
    
    @staticmethod
    def update_group_stage_result(
        db: Session,
        group_id: int,
        first_place_team_id: int,
        second_place_team_id: int,
        third_place_team_id: int,
        fourth_place_team_id: int
    ) -> Dict[str, Any]:
        """
        Update or create a group stage result.
        """
        # Validate that all teams are different
        team_ids = [first_place_team_id, second_place_team_id, third_place_team_id, fourth_place_team_id]
        if len(set(team_ids)) != 4:
            raise ValueError("All 4 teams must be different")
        
        # Check if result already exists
        existing_result = db.query(GroupStageResult).filter(
            GroupStageResult.group_id == group_id
        ).first()
        
        if existing_result:
            # Update existing result
            existing_result.first_place = first_place_team_id
            existing_result.second_place = second_place_team_id
            existing_result.third_place = third_place_team_id
            existing_result.fourth_place = fourth_place_team_id
            result = existing_result
        else:
            # Create new result
            result = GroupStageResult(
                group_id=group_id,
                first_place=first_place_team_id,
                second_place=second_place_team_id,
                third_place=third_place_team_id,
                fourth_place=fourth_place_team_id
            )
            db.add(result)
        
        db.commit()
        db.refresh(result)
        
        # Update scoring for all users who predicted this group
        ScoringService.update_group_scoring_for_all_users(db, result)
        
        return {
            "group_id": group_id,
            "first_place": result.first_place,
            "second_place": result.second_place,
            "third_place": result.third_place,
            "fourth_place": result.fourth_place,
            "message": "Group stage result updated successfully"
        }
    
    @staticmethod
    def get_all_groups_with_results(db: Session) -> List[Dict[str, Any]]:
        """
        Get all groups with their current results (admin only).
        """
        from models.groups import Group
        
        groups = db.query(Group).all()
        groups_with_results = []
        
        for group in groups:
            # Get the result if it exists
            result = db.query(GroupStageResult).filter(
                GroupStageResult.group_id == group.id
            ).first()
            
            group_data = {
                "group_id": group.id,
                "group_name": group.name,
                "teams": [
                    {"id": group.team_1_obj.id, "name": group.team_1_obj.name},
                    {"id": group.team_2_obj.id, "name": group.team_2_obj.name},
                    {"id": group.team_3_obj.id, "name": group.team_3_obj.name},
                    {"id": group.team_4_obj.id, "name": group.team_4_obj.name}
                ],
                "result": {
                    "first_place": result.first_place if result else None,
                    "second_place": result.second_place if result else None,
                    "third_place": result.third_place if result else None,
                    "fourth_place": result.fourth_place if result else None
                } if result else None
            }
            
            groups_with_results.append(group_data)
        
        return groups_with_results
    
    @staticmethod
    def get_third_place_results(db: Session) -> Dict[str, Any]:
        """
        Get current third place qualifying results and eligible teams (admin only).
        """
        result = db.query(ThirdPlaceResult).first()
        
        # Get eligible teams (teams that finished in 3rd place)
        eligible_teams = ResultsService.get_third_place_teams_from_groups(db)
        
        response_data = {
            "eligible_teams": eligible_teams,
            "has_result": False,
            "message": "No third place results set yet"
        }
        
        if result:
            response_data.update({
                "has_result": True,
                "result": {
                    "first_team_qualifying": result.first_team_qualifying,
                    "second_team_qualifying": result.second_team_qualifying,
                    "third_team_qualifying": result.third_team_qualifying,
                    "fourth_team_qualifying": result.fourth_team_qualifying,
                    "fifth_team_qualifying": result.fifth_team_qualifying,
                    "sixth_team_qualifying": result.sixth_team_qualifying,
                    "seventh_team_qualifying": result.seventh_team_qualifying,
                    "eighth_team_qualifying": result.eighth_team_qualifying
                }
            })
        
        return response_data
    
    @staticmethod
    def update_third_place_result(
        db: Session,
        first_team_qualifying: int,
        second_team_qualifying: int,
        third_team_qualifying: int,
        fourth_team_qualifying: int,
        fifth_team_qualifying: int,
        sixth_team_qualifying: int,
        seventh_team_qualifying: int,
        eighth_team_qualifying: int
    ) -> Dict[str, Any]:
        """
        Update or create third place qualifying results.
        """
        # Validate that all teams are different
        team_ids = [
            first_team_qualifying, second_team_qualifying, third_team_qualifying, fourth_team_qualifying,
            fifth_team_qualifying, sixth_team_qualifying, seventh_team_qualifying, eighth_team_qualifying
        ]
        if len(set(team_ids)) != 8:
            raise ValueError("All 8 teams must be different")
        
        # Check if result already exists
        existing_result = db.query(ThirdPlaceResult).first()
        
        if existing_result:
            # Update existing result
            existing_result.first_team_qualifying = first_team_qualifying
            existing_result.second_team_qualifying = second_team_qualifying
            existing_result.third_team_qualifying = third_team_qualifying
            existing_result.fourth_team_qualifying = fourth_team_qualifying
            existing_result.fifth_team_qualifying = fifth_team_qualifying
            existing_result.sixth_team_qualifying = sixth_team_qualifying
            existing_result.seventh_team_qualifying = seventh_team_qualifying
            existing_result.eighth_team_qualifying = eighth_team_qualifying
            result = existing_result
        else:
            # Create new result
            result = ThirdPlaceResult(
                first_team_qualifying=first_team_qualifying,
                second_team_qualifying=second_team_qualifying,
                third_team_qualifying=third_team_qualifying,
                fourth_team_qualifying=fourth_team_qualifying,
                fifth_team_qualifying=fifth_team_qualifying,
                sixth_team_qualifying=sixth_team_qualifying,
                seventh_team_qualifying=seventh_team_qualifying,
                eighth_team_qualifying=eighth_team_qualifying
            )
            db.add(result)
        
        db.commit()
        db.refresh(result)
        
        # Update scoring for all users who predicted third place qualifying teams
        ScoringService.update_third_place_scoring_for_all_users(db, result)
        
        return {
            "first_team_qualifying": result.first_team_qualifying,
            "second_team_qualifying": result.second_team_qualifying,
            "third_team_qualifying": result.third_team_qualifying,
            "fourth_team_qualifying": result.fourth_team_qualifying,
            "fifth_team_qualifying": result.fifth_team_qualifying,
            "sixth_team_qualifying": result.sixth_team_qualifying,
            "seventh_team_qualifying": result.seventh_team_qualifying,
            "eighth_team_qualifying": result.eighth_team_qualifying,
            "message": "Third place qualifying results updated successfully"
        }
    
    @staticmethod
    def get_third_place_teams_from_groups(db: Session) -> List[Dict[str, Any]]:
        """
        Get all teams that finished in 3rd place from group stage results.
        This is used to populate the dropdown for third place qualifying selection.
        """
        from models.groups import Group
        
        groups = db.query(Group).all()
        third_place_teams = []
        
        for group in groups:
            result = db.query(GroupStageResult).filter(
                GroupStageResult.group_id == group.id
            ).first()
            
            if result and result.third_place:
                # Get team details
                team = db.query(Team).filter(Team.id == result.third_place).first()
                if team:
                    third_place_teams.append({
                        "id": team.id,
                        "name": team.name,
                        "group_name": group.name
                    })
        
        return third_place_teams
