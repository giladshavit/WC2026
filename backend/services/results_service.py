from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.matches import Match
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult
from models.team import Team
from .scoring_service import ScoringService
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult


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
        away_team_score: int,
        home_team_score_120: Optional[int] = None,
        away_team_score_120: Optional[int] = None,
        home_team_penalties: Optional[int] = None,
        away_team_penalties: Optional[int] = None,
        outcome_type: str = "regular"
    ) -> Dict[str, Any]:
        """
        Update or create a match result.
        Winner team ID is calculated automatically based on final scores.
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
        
        # Calculate winner based on outcome type
        winner_team_id = ResultsService._calculate_winner(
            match.home_team_id, match.away_team_id,
            home_team_score, away_team_score,
            home_team_score_120, away_team_score_120,
            home_team_penalties, away_team_penalties,
            outcome_type
        )
        
        # Check if result already exists
        existing_result = db.query(MatchResult).filter(
            MatchResult.match_id == match_id
        ).first()
        
        if existing_result:
            # Update existing result
            existing_result.home_team_score = home_team_score
            existing_result.away_team_score = away_team_score
            existing_result.home_team_score_120 = home_team_score_120
            existing_result.away_team_score_120 = away_team_score_120
            existing_result.home_team_penalties = home_team_penalties
            existing_result.away_team_penalties = away_team_penalties
            existing_result.outcome_type = outcome_type
            existing_result.winner_team_id = winner_team_id
            result = existing_result
        else:
            # Create new result
            result = MatchResult(
                match_id=match_id,
                home_team_score=home_team_score,
                away_team_score=away_team_score,
                home_team_score_120=home_team_score_120,
                away_team_score_120=away_team_score_120,
                home_team_penalties=home_team_penalties,
                away_team_penalties=away_team_penalties,
                outcome_type=outcome_type,
                winner_team_id=winner_team_id
            )
            db.add(result)
        
        db.commit()
        db.refresh(result)
        
        
        # Update KnockoutStageResult if this is a knockout match
        if match.is_knockout:
            ResultsService._update_knockout_stage_result(db, match_id, winner_team_id)
        
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
    
    @staticmethod
    def get_knockout_matches_with_results(db: Session) -> List[Dict[str, Any]]:
        """
        Get all knockout matches with their current results.
        Only returns matches where both teams are defined.
        """
        from models.matches import Match
        from models.team import Team
        from models.results import KnockoutStageResult
        
        # Get all knockout matches
        knockout_matches = db.query(Match).filter(
            Match.stage.in_(['round32', 'round16', 'quarter', 'semi', 'final'])
        ).filter(
            Match.home_team_id.isnot(None),
            Match.away_team_id.isnot(None)
        ).all()
        
        matches_with_results = []
        
        for match in knockout_matches:
            # Get the knockout stage result
            knockout_result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.match_id == match.id
            ).first()
            
            # Get match result (scores)
            match_result = db.query(MatchResult).filter(
                MatchResult.match_id == match.id
            ).first()
            
            # Get team details
            home_team = db.query(Team).filter(Team.id == match.home_team_id).first()
            away_team = db.query(Team).filter(Team.id == match.away_team_id).first()
            
            if home_team and away_team:
                match_data = {
                    "match_id": match.id,
                    "stage": match.stage,
                    "home_team": {
                        "id": home_team.id,
                        "name": home_team.name
                    },
                    "away_team": {
                        "id": away_team.id,
                        "name": away_team.name
                    },
                    "date": match.date.isoformat() if match.date else None,
                    "status": match.status,
                    "knockout_result": None,
                    "match_result": None,
                    "has_result": False
                }
                
                # Add knockout result if exists
                if knockout_result:
                    match_data["knockout_result"] = {
                        "team_1": knockout_result.team_1,
                        "team_2": knockout_result.team_2,
                        "winner_team_id": knockout_result.winner_team_id
                    }
                
                # Add match result (scores) if exists
                if match_result:
                    match_data["match_result"] = {
                        "home_team_score": match_result.home_team_score,
                        "away_team_score": match_result.away_team_score,
                        "home_team_score_120": match_result.home_team_score_120,
                        "away_team_score_120": match_result.away_team_score_120,
                        "home_team_penalties": match_result.home_team_penalties,
                        "away_team_penalties": match_result.away_team_penalties,
                        "outcome_type": match_result.outcome_type,
                        "winner_team_id": match_result.winner_team_id
                    }
                    match_data["has_result"] = True
                
                matches_with_results.append(match_data)
        
        return matches_with_results
    
    @staticmethod
    def _calculate_winner(
        home_team_id: int, away_team_id: int,
        home_score_90: int, away_score_90: int,
        home_score_120: Optional[int], away_score_120: Optional[int],
        home_penalties: Optional[int], away_penalties: Optional[int],
        outcome_type: str
    ) -> int:
        """
        Calculate the winner based on the outcome type and scores.
        Returns the team ID of the winner, or 0 for a draw.
        """
        if outcome_type == "penalties":
            # Winner determined by penalties
            if home_penalties is not None and away_penalties is not None:
                if home_penalties > away_penalties:
                    return home_team_id
                elif away_penalties > home_penalties:
                    return away_team_id
                else:
                    return 0  # Draw in penalties (shouldn't happen)
            else:
                return 0  # No penalty data
        
        elif outcome_type == "extra_time":
            # Winner determined by extra time scores
            if home_score_120 is not None and away_score_120 is not None:
                if home_score_120 > away_score_120:
                    return home_team_id
                elif away_score_120 > home_score_120:
                    return away_team_id
                else:
                    return 0  # Draw after extra time (shouldn't happen)
            else:
                return 0  # No extra time data
        
        else:  # outcome_type == "regular"
            # Winner determined by 90-minute scores
            if home_score_90 > away_score_90:
                return home_team_id
            elif away_score_90 > home_score_90:
                return away_team_id
            else:
                return 0  # Draw

    @staticmethod
    def _update_knockout_stage_result(db: Session, match_id: int, winner_team_id: int):
        """
        Update KnockoutStageResult with the winner of the match.
        This is called when a knockout match result is entered.
        """
        from models.results import KnockoutStageResult
        
        # Find the knockout stage result for this match
        knockout_result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == match_id
        ).first()
        
        if knockout_result:
            # Update the winner
            knockout_result.winner_team_id = winner_team_id
            db.commit()
            db.refresh(knockout_result)
            print(f"Updated KnockoutStageResult for match {match_id} with winner {winner_team_id}")
            
            # Update scoring for knockout stage predictions
            ScoringService.update_knockout_scoring_for_all_users(db, knockout_result)
            
            
            # Create or update the next knockout match
            ResultsService._create_or_update_next_knockout_stage(db, match_id, winner_team_id)
        else:
            print(f"No KnockoutStageResult found for match {match_id}")

    @staticmethod
    @staticmethod
    def _create_or_update_next_knockout_stage(db: Session, match_id: int, winner_team_id: int):
        """
        Find the next knockout match and update it with the winner.
        This is called when a knockout match result is entered.
        """
        # Find the template of the current match
        current_template = db.query(MatchTemplate).filter(
            MatchTemplate.id == match_id
        ).first()
        
        if not current_template or not current_template.winner_next_knockout_match:
            print(f"No next match template found for match {match_id}")
            return
        
        # Get next match info from template
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        print(f"Next match: {next_match_id}, position: {position}, winner: {winner_team_id}")
        
        # Find both the knockout result and the match record
        next_knockout_result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        next_match = db.query(Match).filter(Match.id == next_match_id).first()
        
        if not next_knockout_result or not next_match:
            print(f"No KnockoutStageResult or Match found for next match {next_match_id}")
            return
        
        # Update the knockout result with the winner
        if position == 1:
            next_knockout_result.team_1 = winner_team_id
            next_match.home_team_id = winner_team_id
            print(f"Updated next match {next_match_id} team_1/home_team with winner {winner_team_id}")
        elif position == 2:
            next_knockout_result.team_2 = winner_team_id
            next_match.away_team_id = winner_team_id
            print(f"Updated next match {next_match_id} team_2/away_team with winner {winner_team_id}")
        
        db.commit()
        db.refresh(next_knockout_result)
        db.refresh(next_match)
