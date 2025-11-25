from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.matches import Match
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult, KnockoutStageResult
from models.team import Team
from models.matches_template import MatchTemplate
from models.predictions import KnockoutStagePrediction
from models.groups import Group
from .scoring_service import ScoringService
from .predictions import PredictionService, PredictionStatus


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
                "id": match.id,  # Also include id for compatibility
                "home_team": {
                    "id": match.home_team.id,
                    "name": match.home_team.name,
                    "flag_url": match.home_team.flag_url
                },
                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name,
                    "flag_url": match.away_team.flag_url
                },
                "stage": match.stage,
                "status": match.status,
                "date": match.date.isoformat() if match.date else None,
                "group": match.group,
                "result": {
                    "home_team_score": result.home_team_score if result else None,
                    "away_team_score": result.away_team_score if result else None,
                    "home_score": result.home_team_score if result else None,  # Also include for compatibility
                    "away_score": result.away_team_score if result else None,  # Also include for compatibility
                    "home_team_score_120": result.home_team_score_120 if result else None,
                    "away_team_score_120": result.away_team_score_120 if result else None,
                    "home_score_120": result.home_team_score_120 if result else None,  # Also include for compatibility
                    "away_score_120": result.away_team_score_120 if result else None,  # Also include for compatibility
                    "home_team_penalties": result.home_team_penalties if result else None,
                    "away_team_penalties": result.away_team_penalties if result else None,
                    "home_penalties": result.home_team_penalties if result else None,  # Also include for compatibility
                    "away_penalties": result.away_team_penalties if result else None,  # Also include for compatibility
                    "winner_team_id": result.winner_team_id if result else None,
                    "outcome_type": result.outcome_type if result else "regular"
                } if result else None
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
        
        # Update match status to finished
        match.status = "finished"
        db.commit()
        
        # Check if this is a knockout match
        is_knockout = match.stage in ['round32', 'round16', 'quarter', 'semi', 'final']
        
        # Update KnockoutStageResult if this is a knockout match
        if is_knockout:
            # Get team1 and team2 from the match
            team_1_id = match.home_team_id
            team_2_id = match.away_team_id
            # Call the new update_knockout_result function that handles predictions
            ResultsService.update_knockout_result(
                db, match_id, team_1_id, team_2_id, winner_team_id
            )
            # Note: update_knockout_result already handles scoring, so we skip the match scoring below
            return {
                "match_id": match_id,
                "home_team_score": result.home_team_score,
                "away_team_score": result.away_team_score,
                "winner_team_id": result.winner_team_id,
                "message": "Match result updated successfully"
            }
        
        # Update scoring for all users who predicted this match (only for non-knockout matches)
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
                    {
                        "id": group.team_1_obj.id, 
                        "name": group.team_1_obj.name,
                        "short_name": group.team_1_obj.short_name,
                        "flag_url": group.team_1_obj.flag_url
                    },
                    {
                        "id": group.team_2_obj.id, 
                        "name": group.team_2_obj.name,
                        "short_name": group.team_2_obj.short_name,
                        "flag_url": group.team_2_obj.flag_url
                    },
                    {
                        "id": group.team_3_obj.id, 
                        "name": group.team_3_obj.name,
                        "short_name": group.team_3_obj.short_name,
                        "flag_url": group.team_3_obj.flag_url
                    },
                    {
                        "id": group.team_4_obj.id, 
                        "name": group.team_4_obj.name,
                        "short_name": group.team_4_obj.short_name,
                        "flag_url": group.team_4_obj.flag_url
                    }
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
                        "short_name": team.short_name,
                        "flag_url": team.flag_url,
                        "group_id": group.id,
                        "group_name": group.name
                    })
        
        return third_place_teams
    
    @staticmethod
    def get_knockout_matches_with_results(db: Session) -> List[Dict[str, Any]]:
        """
        Get all knockout matches with their current results.
        Only returns matches where both teams are defined.
        """
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
                        "name": home_team.name,
                        "flag_url": home_team.flag_url
                    },
                    "away_team": {
                        "id": away_team.id,
                        "name": away_team.name,
                        "flag_url": away_team.flag_url
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
    def _create_or_update_next_knockout_stage(db: Session, match_id: int, winner_team_id: int):
        """
        Find the next knockout match and update it with the winner.
        This is called when a knockout match result is entered.
        """
        # First, get the Match to find its match_number
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            print(f"Match {match_id} not found")
            return
        
        # Find the template of the current match using match_number
        # For knockout matches, match_number corresponds to MatchTemplate.id
        current_template = None
        
        if match.match_number:
            # Use match_number to find template (most reliable)
            current_template = db.query(MatchTemplate).filter(
                MatchTemplate.id == match.match_number
            ).first()
        else:
            # Fallback: try to find by stage, date, and team sources
            # This is less reliable but better than nothing
            print(f"Warning: match_number is None for match {match_id}, trying fallback method")
            current_template = db.query(MatchTemplate).filter(
                MatchTemplate.stage == match.stage,
                MatchTemplate.date == match.date
            ).first()
            
            # If still not found and we have team sources, try matching by them
            if not current_template and match.home_team_source and match.away_team_source:
                current_template = db.query(MatchTemplate).filter(
                    MatchTemplate.stage == match.stage,
                    MatchTemplate.team_1 == match.home_team_source,
                    MatchTemplate.team_2 == match.away_team_source
                ).first()
        
        if not current_template:
            print(f"No template found for match {match_id} (stage: {match.stage}, match_number: {match.match_number})")
            return
        
        if not current_template.winner_next_knockout_match:
            print(f"Template {current_template.id} has no next match (this is probably the final)")
            return
        
        # Get next match info from template
        next_template_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position  # 1 or 2
        
        print(f"Next template: {next_template_id}, position: {position}, winner: {winner_team_id}")
        
        # Find the Match that corresponds to this template (using match_number)
        next_match = db.query(Match).filter(
            Match.match_number == next_template_id
        ).first()
        
        if not next_match:
            # Try to find by ID (in case match_number is not set)
            next_match = db.query(Match).filter(
                Match.id == next_template_id
            ).first()
        
        if not next_match:
            # Create the Match from template if it doesn't exist
            print(f"Creating Match for next template {next_template_id}")
            next_template = db.query(MatchTemplate).filter(
                MatchTemplate.id == next_template_id
            ).first()
            
            if not next_template:
                print(f"Template {next_template_id} not found, cannot create Match")
                return
            
            next_match = Match(
                id=next_template.id,
                stage=next_template.stage,
                home_team_id=None,
                away_team_id=None,
                status="scheduled",
                date=next_template.date,
                match_number=next_template.id,
                home_team_source=next_template.team_1,
                away_team_source=next_template.team_2
            )
            db.add(next_match)
            db.flush()
            print(f"Created Match {next_match.id} for template {next_template_id}")
        
        next_match_id = next_match.id
        
        # Find or create the knockout result for this match
        next_knockout_result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        if not next_knockout_result:
            # Create knockout result if it doesn't exist
            print(f"Creating KnockoutStageResult for next match {next_match_id}")
            next_knockout_result = KnockoutStageResult(
                match_id=next_match_id,
                team_1=None,
                team_2=None,
                winner_team_id=None
            )
            db.add(next_knockout_result)
            db.flush()
        
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
    
    @staticmethod
    def get_predicted_loser(prediction):
        """חישוב המפסידה מהניחוש"""
        predicted_winner = prediction.winner_team_id
        
        if predicted_winner == prediction.team1_id:
            return prediction.team2_id
        elif predicted_winner == prediction.team2_id:
            return prediction.team1_id
        
        return None
    
    @staticmethod
    def is_team_in_result(team_id, result):
        """בודק אם קבוצה נמצאת בתוצאה"""
        if not team_id or not result:
            return False
        return team_id in {result.team_1, result.team_2}
    
    @staticmethod
    def update_round32_statuses(db: Session):
        """
        מעדכן את הסטטוסים של כל ההימורים של 32 האחרונות בהתאם לתוצאות
        """
        # שלוף את כל ההימורים של 32 האחרונות
        predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.stage == 'round32'
        ).all()
        
        for prediction in predictions:
            # שלוף את התוצאה האמיתית של המשחק הזה
            result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.match_id == prediction.template_match_id
            ).first()
            
            if not result:
                continue
            
            # בדיקה של המנצחת
            if not ResultsService.is_team_in_result(prediction.winner_team_id, result):
                PredictionService.set_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
                continue
            
            # המנצחת במשחק האמיתי - בודקים את המפסידה
            predicted_loser = ResultsService.get_predicted_loser(prediction)
            status = PredictionStatus.PREDICTED if (predicted_loser and ResultsService.is_team_in_result(predicted_loser, result)) else PredictionStatus.MIGHT_CHANGE_PREDICT
            PredictionService.set_status(prediction, status)
        
        db.commit()
    
    @staticmethod
    def extract_match_id_from_winner_string(team_source: str) -> Optional[int]:
        """
        Extracts match ID from string like 'Winner_M73' -> 73
        Returns None if not a winner string
        """
        if team_source.startswith('Winner_M'):
            try:
                return int(team_source.split('_')[1][1:])  # 'Winner_M73' -> 'M73' -> '73' -> 73
            except (IndexError, ValueError):
                return None
        return None
    
    @staticmethod
    def get_source_match_ids(match_template: MatchTemplate) -> Tuple[Optional[int], Optional[int]]:
        """
        Returns the two source match IDs for a given match template.
        For example, for match 90 with team_1='Winner_M73' and team_2='Winner_M75', returns (73, 75)
        Returns (None, None) if no source matches found
        """
        source_match_1_id = ResultsService.extract_match_id_from_winner_string(match_template.team_1)
        source_match_2_id = ResultsService.extract_match_id_from_winner_string(match_template.team_2)
        return source_match_1_id, source_match_2_id
    
    @staticmethod
    def is_winner_reachable_recursive(db: Session, match_id: int, winner_team_id: int, visited: set = None) -> bool:
        """
        Recursively checks if a winner team can reach a specific match.
        
        Args:
            db: Database session
            match_id: The target match ID to check if winner can reach
            winner_team_id: The team ID to check reachability for
            visited: Set of visited match IDs to prevent infinite loops
        
        Returns:
            True if the winner team can reach this match, False otherwise
        """
        if visited is None:
            visited = set()
        
        # Prevent infinite loops
        if match_id in visited:
            return False
        visited.add(match_id)
        
        # Get the template for this match
        template = db.query(MatchTemplate).filter(MatchTemplate.id == match_id).first()
        if not template:
            return False
        
        # Check if this match has actual results with teams
        knockout_result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == match_id
        ).first()
        
        if knockout_result and knockout_result.team_1 and knockout_result.team_2:
            # Match has actual teams assigned - check if winner is one of them
            if winner_team_id in {knockout_result.team_1, knockout_result.team_2}:
                return True
            else:
                return False
        
        # Check if this is the first knockout stage (Round of 32) - base case
        if template.stage == 'round32':
            return True
        
        # Get the two source matches
        source_match_1_id, source_match_2_id = ResultsService.get_source_match_ids(template)
        
        # Recursively check if winner can reach from either source match
        # Using OR with early return - if first is True, won't check second
        return (source_match_1_id and ResultsService.is_winner_reachable_recursive(db, source_match_1_id, winner_team_id, visited.copy())) or \
               (source_match_2_id and ResultsService.is_winner_reachable_recursive(db, source_match_2_id, winner_team_id, visited.copy()))
    
    @staticmethod
    def is_winner_reachable(db: Session, prediction) -> bool:
        """
        Checks if the predicted winner can reach the current match based on actual results.
        This is the main entry point for checking reachability.
        
        Args:
            db: Database session
            prediction: The knockout prediction to check
        
        Returns:
            True if the predicted winner can reach this match, False otherwise
        """
        if not prediction.winner_team_id:
            return False
        
        return ResultsService.is_winner_reachable_recursive(db, prediction.template_match_id, prediction.winner_team_id)
    
    @staticmethod
    def is_prediction_must_change(prediction) -> bool:
        """
        Helper function to check if a prediction has MUST_CHANGE_PREDICT status.
        
        Args:
            prediction: The prediction to check
        
        Returns:
            True if status is MUST_CHANGE_PREDICT, False otherwise
        """
        try:
            PS = PredictionStatus
            return prediction.status and PS(prediction.status) == PS.MUST_CHANGE_PREDICT
        except (ValueError, AttributeError):
            return False
    
    @staticmethod
    def determine_status_by_previous_matches(prediction, source_pred_1, source_pred_2, db: Session):
        """
        Determines the status based on the status of previous matches.
        Returns the appropriate PredictionStatus or None if no change needed.
        """
        PS = PredictionStatus
        
        if not prediction.winner_team_id:
            return None
        
        # Get statuses from source predictions
        try:
            status_1 = PS(source_pred_1.status) if source_pred_1.status else None
            status_2 = PS(source_pred_2.status) if source_pred_2.status else None
        except ValueError:
            return None
        
        if not status_1 or not status_2:
            return None
        
        # Simplified Logic:
        # Cases 1+2+4+5: If neither prediction is MUST_CHANGE -> PREDICTED (green)
        if not ResultsService.is_prediction_must_change(source_pred_1) and \
           not ResultsService.is_prediction_must_change(source_pred_2):
            return PS.PREDICTED
        
        # Determine which prediction is the winner and which is the loser
        winner_prediction = source_pred_1 if (source_pred_1.winner_team_id == prediction.winner_team_id) else source_pred_2
        
        # If winner prediction is not MUST_CHANGE -> MIGHT_CHANGE (yellow)
        if not ResultsService.is_prediction_must_change(winner_prediction):
            return PS.MIGHT_CHANGE_PREDICT
        
        # Winner prediction is MUST_CHANGE -> Check if reachable from loser match
        return PS.MIGHT_CHANGE_PREDICT if ResultsService.is_winner_reachable(db, prediction) else PS.MUST_CHANGE_PREDICT
    
    @staticmethod
    def update_knockout_statuses_after_round32(db: Session, stage: str = None):
        """
        Updates knockout prediction statuses for stages after Round of 32.
        
        Args:
            db: Database session
            stage: Optional stage to update (e.g., 'round16', 'quarter', 'semi', 'final')
                  If None, updates all stages after round32
        
        This implements the complex logic for combining predecessor match statuses.
        """
        PS = PredictionStatus
        
        # Determine which stages to update
        if stage:
            stages_to_update = [stage]
        else:
            stages_to_update = ['round16', 'quarter', 'semi', 'final']
        
        for stage_name in stages_to_update:
            # Get all predictions for this stage
            predictions = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.stage == stage_name
            ).all()
            
            for prediction in predictions:
                # Get the match template
                template = db.query(MatchTemplate).filter(
                    MatchTemplate.id == prediction.template_match_id
                ).first()
                
                if not template:
                    continue
                
                # Get the two source matches
                source_match_1_id, source_match_2_id = ResultsService.get_source_match_ids(template)
                
                if not source_match_1_id or not source_match_2_id:
                    continue  # Skip if we can't find source matches
                
                # Get the statuses of the two source predictions (for the same user)
                source_pred_1 = db.query(KnockoutStagePrediction).filter(
                    KnockoutStagePrediction.template_match_id == source_match_1_id,
                    KnockoutStagePrediction.user_id == prediction.user_id
                ).first()
                
                source_pred_2 = db.query(KnockoutStagePrediction).filter(
                    KnockoutStagePrediction.template_match_id == source_match_2_id,
                    KnockoutStagePrediction.user_id == prediction.user_id
                ).first()
                
                if not source_pred_1 or not source_pred_2:
                    continue  # Skip if source predictions don't exist
                
                # Implement the 9-case logic
                new_status = ResultsService.determine_status_by_previous_matches(
                    prediction, source_pred_1, source_pred_2, db
                )
                
                if new_status:
                    PredictionService.set_status(prediction, new_status)
            
            db.commit()
    
    @staticmethod
    def reset_all_user_scores(db: Session) -> Dict[str, Any]:
        """
        Reset all user scores to zero and all prediction points to zero (admin only)
        """
        from models.user_scores import UserScores
        from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
        
        try:
            # Get all user scores
            all_scores = db.query(UserScores).all()
            count = 0
            
            for user_scores in all_scores:
                user_scores.matches_score = 0
                user_scores.groups_score = 0
                user_scores.third_place_score = 0
                user_scores.knockout_score = 0
                user_scores.penalty = 0
                user_scores.total_points = 0
                count += 1
            
            # Reset all prediction points
            match_pred_count = db.query(MatchPrediction).update({MatchPrediction.points: 0})
            group_pred_count = db.query(GroupStagePrediction).update({GroupStagePrediction.points: 0})
            third_place_pred_count = db.query(ThirdPlacePrediction).update({ThirdPlacePrediction.points: 0})
            knockout_pred_count = db.query(KnockoutStagePrediction).update({KnockoutStagePrediction.points: 0})
            
            db.commit()
            
            return {
                "message": f"Successfully reset scores for {count} users and {match_pred_count + group_pred_count + third_place_pred_count + knockout_pred_count} predictions",
                "users_reset": count,
                "match_predictions_reset": match_pred_count,
                "group_predictions_reset": group_pred_count,
                "third_place_predictions_reset": third_place_pred_count,
                "knockout_predictions_reset": knockout_pred_count
            }
        except Exception as e:
            db.rollback()
            raise Exception(f"Error resetting user scores: {str(e)}")
    
    @staticmethod
    def _invalidate_team_in_next_stage_recursive(
        db: Session,
        next_prediction,
        position: int,
        wrong_winner_team_id: int
    ) -> None:
        """
        Recursively invalidate a team in the next stage if it's not valid.
        
        Args:
            db: Database session
            next_prediction: The next prediction (already found)
            position: Position in next prediction (1 for team1, 2 for team2)
            wrong_winner_team_id: The team ID that was predicted but is wrong
        """
        from .predictions.shared import PredictionStatus
        from services.predictions.knock_pred_refactor_service import KnockPredRefactorService
        
        # Check which team is at the position in next prediction
        if position == 1:
            team_at_position = next_prediction.team1_id
            is_valid_field = 'is_team1_valid'
        else:  # position == 2
            team_at_position = next_prediction.team2_id
            is_valid_field = 'is_team2_valid'
        
        # Check if the team at position is the wrong winner - if not, nothing to do
        if team_at_position != wrong_winner_team_id:
            return
        
        # 1. Check if team is valid - if not, stop
        is_valid = getattr(next_prediction, is_valid_field, True)
        
        if not is_valid:
            return  # Already invalid, stop
        
        # 2. If valid, change to invalid
        setattr(next_prediction, is_valid_field, False)
        db.flush()
        
        # 3. Check if this is the winner in the next prediction
        if next_prediction.winner_team_id == wrong_winner_team_id:
            # 4. If yes: change status to red and call recursively with next prediction
            next_prediction.status = PredictionStatus.MUST_CHANGE_PREDICT.value
            db.flush()
            
            # Get the next prediction and position for recursive call
            next_next_prediction, next_next_position = KnockPredRefactorService._find_next_prediction_and_position(
                db, next_prediction
            )
            
            if next_next_prediction and next_next_position:
                ResultsService._invalidate_team_in_next_stage_recursive(
                    db, next_next_prediction, next_next_position, wrong_winner_team_id
                )
        else:
            # The winner is not the wrong winner - check if status is green (PREDICTED) and change to yellow (MIGHT_CHANGE_PREDICT)
            if next_prediction.status == PredictionStatus.PREDICTED.value:
                next_prediction.status = PredictionStatus.MIGHT_CHANGE_PREDICT.value
                db.flush()
    
    @staticmethod
    def _set_predictions_not_editable(db: Session, match_id: int) -> List[KnockoutStagePrediction]:
        """
        Set all predictions for a match to is_editable = False.
        
        Args:
            db: Database session
            match_id: The match template ID
            
        Returns:
            List of predictions that were updated
        """
        predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == match_id
        ).all()
        
        for pred in predictions:
            pred.is_editable = False
        
        db.flush()
        return predictions
    
    @staticmethod
    def _create_or_update_knockout_result(
        db: Session,
        match_id: int,
        team_1_id: int,
        team_2_id: int,
        winner_team_id: int
    ) -> KnockoutStageResult:
        """
        Create or update a knockout stage result.
        MOST IMPORTANT: This function updates the result with the winner_team_id.
        
        Args:
            db: Database session
            match_id: The match template ID
            team_1_id: Team 1 ID
            team_2_id: Team 2 ID
            winner_team_id: Winner team ID (THIS IS THE MOST IMPORTANT FIELD)
            
        Returns:
            The knockout result object
        """
        knockout_result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == match_id
        ).first()
        
        if knockout_result:
            # Update existing result
            knockout_result.team_1 = team_1_id
            knockout_result.team_2 = team_2_id
            knockout_result.winner_team_id = winner_team_id
        else:
            # Create new result
            knockout_result = KnockoutStageResult(
                match_id=match_id,
                team_1=team_1_id,
                team_2=team_2_id,
                winner_team_id=winner_team_id
            )
            db.add(knockout_result)
        
        db.flush()
        return knockout_result
    
    @staticmethod
    def update_knockout_result(
        db: Session,
        match_id: int,
        team_1_id: int,
        team_2_id: int,
        winner_team_id: int
    ) -> Dict[str, Any]:
        """
        Update or create a knockout stage result and process all predictions.
        
        This function:
        1. Sets match is_editable to False
        2. Updates/creates knockout result
        3. Processes all predictions:
           - Compares winner with prediction
           - Awards points if correct (via ScoringService)
           - If wrong, recursively invalidates teams in next stages
        
        Args:
            db: Database session
            match_id: The match template ID
            team_1_id: Team 1 ID
            team_2_id: Team 2 ID
            winner_team_id: Winner team ID
            
        Returns:
            Dict with success message
        """
        # 1. Verify match exists
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise ValueError(f"Match with ID {match_id} not found")
        
        # 2. Set is_editable to False for all predictions and get them
        predictions = ResultsService._set_predictions_not_editable(db, match_id)
        
        # 3. Update or create knockout result
        knockout_result = ResultsService._create_or_update_knockout_result(
            db, match_id, team_1_id, team_2_id, winner_team_id
        )
        
        # 3.5. Update the next knockout stage with the winner
        ResultsService._create_or_update_next_knockout_stage(db, match_id, winner_team_id)
        
        # 4. Process all predictions and award points (via ScoringService)
        ScoringService.update_knockout_scoring_for_all_users(db, knockout_result)
        
        # 5. Process each prediction for invalidation
        for prediction in predictions:
            if prediction.winner_team_id != winner_team_id:
                # Wrong prediction - invalidate team in next stages recursively
                # The wrong winner is prediction.winner_team_id (the one that was predicted but is wrong)
                wrong_winner_team_id = prediction.winner_team_id
                
                # Get the next prediction and position first
                from services.predictions.knock_pred_refactor_service import KnockPredRefactorService
                
                next_prediction, position = KnockPredRefactorService._find_next_prediction_and_position(
                    db, prediction
                )
                
                if next_prediction and position:
                    ResultsService._invalidate_team_in_next_stage_recursive(
                        db, next_prediction, position, wrong_winner_team_id
                    )
        
        db.commit()
        
        return {
            "success": True,
            "message": "Knockout result updated successfully",
            "match_id": match_id
        }
