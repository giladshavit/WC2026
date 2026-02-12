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
from services.database import DBReader, DBWriter, DBUtils


class ResultsService:
    """Service for managing match results and admin operations."""
    
    @staticmethod
    def get_all_matches_with_results(db: Session) -> List[Dict[str, Any]]:
        """
        Get all matches that have both teams defined, with their current results.
        Returns matches with home_team, away_team, stage, date, and result data.
        """
        # Get all matches where both teams are defined
        matches = DBReader.get_matches_with_teams(db)
        
        matches_with_results = []
        
        for match in matches:
            # Get the result if it exists
            result = DBReader.get_match_result(db, match.id)
            
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
        match = DBReader.get_match(db, match_id)
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
        existing_result = DBReader.get_match_result(db, match_id)
        
        if existing_result:
            # Update existing result
            result = DBWriter.update_match_result(
                db,
                existing_result,
                home_team_score=home_team_score,
                away_team_score=away_team_score,
                home_team_score_120=home_team_score_120,
                away_team_score_120=away_team_score_120,
                home_team_penalties=home_team_penalties,
                away_team_penalties=away_team_penalties,
                outcome_type=outcome_type,
                winner_team_id=winner_team_id
            )
        else:
            # Create new result
            result = DBWriter.create_match_result(
                db,
                match_id=match_id,
                home_score=home_team_score,
                away_score=away_team_score,
                winner_id=winner_team_id,
                home_score_120=home_team_score_120,
                away_score_120=away_team_score_120,
                home_penalties=home_team_penalties,
                away_penalties=away_team_penalties,
                outcome_type=outcome_type
            )
        
        DBUtils.commit(db)
        DBUtils.refresh(db, result)
        
        # Update match status to finished
        DBWriter.set_match_status(db, match, "finished")
        DBUtils.commit(db)
        
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
        existing_result = DBReader.get_group_stage_result(db, group_id)
        
        if existing_result:
            # Update existing result
            result = DBWriter.update_group_stage_result(
                db,
                existing_result,
                first_place=first_place_team_id,
                second_place=second_place_team_id,
                third_place=third_place_team_id,
                fourth_place=fourth_place_team_id
            )
        else:
            # Create new result
            result = DBWriter.create_group_stage_result(
                db,
                group_id=group_id,
                first=first_place_team_id,
                second=second_place_team_id,
                third=third_place_team_id,
                fourth=fourth_place_team_id
            )
        
        # Update is_eliminated for new teams
        # Places 1, 2, 3: not eliminated (False)
        # Place 4: eliminated (True)
        first_place_team = DBReader.get_team(db, first_place_team_id)
        second_place_team = DBReader.get_team(db, second_place_team_id)
        third_place_team = DBReader.get_team(db, third_place_team_id)
        fourth_place_team = DBReader.get_team(db, fourth_place_team_id)
        
        if first_place_team:
            DBWriter.update_team_eliminated(db, first_place_team, False)
        if second_place_team:
            DBWriter.update_team_eliminated(db, second_place_team, False)
        if third_place_team:
            DBWriter.update_team_eliminated(db, third_place_team, False)
        if fourth_place_team:
            DBWriter.update_team_eliminated(db, fourth_place_team, True)
        
        DBUtils.commit(db)
        DBUtils.refresh(db, result)
        
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
        groups = DBReader.get_all_groups(db)
        groups_with_results = []
        
        for group in groups:
            # Get the result if it exists
            result = DBReader.get_group_stage_result(db, group.id)
            
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
        result = DBReader.get_third_place_result(db)
        
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
        existing_result = DBReader.get_third_place_result(db)
        
        if existing_result:
            # Update existing result
            result = DBWriter.update_third_place_result(
                db,
                existing_result,
                first_team_qualifying=first_team_qualifying,
                second_team_qualifying=second_team_qualifying,
                third_team_qualifying=third_team_qualifying,
                fourth_team_qualifying=fourth_team_qualifying,
                fifth_team_qualifying=fifth_team_qualifying,
                sixth_team_qualifying=sixth_team_qualifying,
                seventh_team_qualifying=seventh_team_qualifying,
                eighth_team_qualifying=eighth_team_qualifying
            )
        else:
            # Create new result
            result = DBWriter.create_third_place_result(
                db,
                first_team_qualifying=first_team_qualifying,
                second_team_qualifying=second_team_qualifying,
                third_team_qualifying=third_team_qualifying,
                fourth_team_qualifying=fourth_team_qualifying,
                fifth_team_qualifying=fifth_team_qualifying,
                sixth_team_qualifying=sixth_team_qualifying,
                seventh_team_qualifying=seventh_team_qualifying,
                eighth_team_qualifying=eighth_team_qualifying
            )
        
        DBUtils.commit(db)
        DBUtils.refresh(db, result)
        
        # Update is_eliminated for third place teams
        # Teams that qualify: not eliminated (False)
        # Teams that don't qualify: eliminated (True)
        qualifying_team_ids = [
            first_team_qualifying, second_team_qualifying, third_team_qualifying, fourth_team_qualifying,
            fifth_team_qualifying, sixth_team_qualifying, seventh_team_qualifying, eighth_team_qualifying
        ]
        
        # Get all third place teams from group stage results
        group_results = DBReader.get_all_group_stage_results(db)
        all_third_place_team_ids = [gr.third_place for gr in group_results]
        
        # Update is_eliminated for all third place teams
        for third_place_team_id in all_third_place_team_ids:
            team = DBReader.get_team(db, third_place_team_id)
            if team:
                # If team is in qualifying list, not eliminated; otherwise, eliminated
                DBWriter.update_team_eliminated(
                    db,
                    team,
                    third_place_team_id not in qualifying_team_ids
                )
        
        DBUtils.commit(db)
        
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
        groups = DBReader.get_all_groups(db)
        third_place_teams = []
        
        for group in groups:
            result = DBReader.get_group_stage_result(db, group.id)
            
            if result and result.third_place:
                # Get team details
                team = DBReader.get_team(db, result.third_place)
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
        knockout_matches = DBReader.get_knockout_matches_with_teams(
            db,
            ['round32', 'round16', 'quarter', 'semi', 'final']
        )
        
        matches_with_results = []
        
        for match in knockout_matches:
            # Get the knockout stage result
            knockout_result = DBReader.get_knockout_result(db, match.id)
            
            # Get match result (scores)
            match_result = DBReader.get_match_result(db, match.id)
            
            # Get team details
            home_team = DBReader.get_team(db, match.home_team_id)
            away_team = DBReader.get_team(db, match.away_team_id)
            
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
        knockout_result = DBReader.get_knockout_result(db, match_id)
        
        if knockout_result:
            # Update the winner
            DBWriter.update_knockout_result(db, knockout_result, winner_team_id=winner_team_id)
            DBUtils.commit(db)
            DBUtils.refresh(db, knockout_result)
            print(f"Updated KnockoutStageResult for match {match_id} with winner {winner_team_id}")
            
            # Process predictions (status + scoring) via KnockoutService
            team_1_id = knockout_result.team_1
            team_2_id = knockout_result.team_2
            if team_1_id and team_2_id:
                from services.predictions.knockout_service import KnockoutService
                loser_team_id = team_2_id if winner_team_id == team_1_id else team_1_id
                KnockoutService.process_knockout_match_result(
                    db, match_id, winner_team_id, loser_team_id
                )
            
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
        match = DBReader.get_match(db, match_id)
        if not match:
            return
        
        current_template = DBReader.get_match_template(db, match.match_number)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return
        
        next_template_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position
        
        next_match = DBReader.get_match_by_number(db, next_template_id)
        
        if not next_match:
            return
        
        next_knockout_result = DBReader.get_knockout_result(db, next_match.id)
        
        if not next_knockout_result:
            return
        
        if position == 1:
            DBWriter.update_knockout_result(db, next_knockout_result, team_1=winner_team_id)
            DBWriter.update_match(db, next_match, home_team_id=winner_team_id)
        elif position == 2:
            DBWriter.update_knockout_result(db, next_knockout_result, team_2=winner_team_id)
            DBWriter.update_match(db, next_match, away_team_id=winner_team_id)
        
        DBUtils.commit(db)
    
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
        predictions = DBReader.get_knockout_predictions_by_stage(db, 'round32')
        
        for prediction in predictions:
            from services.predictions.knockout_service import KnockoutService
            KnockoutService._compute_and_set_status(db, prediction, check_reachable=False)
        
        DBUtils.commit(db)
    
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
    def update_knockout_statuses_after_round32(db: Session, stage: str = None):
        """
        Updates knockout prediction statuses for stages after Round of 32.
        Delegates to KnockoutService.initialize_all_knockout_statuses.
        """
        from services.predictions.knockout_service import KnockoutService
        KnockoutService.initialize_all_knockout_statuses(db)
        DBUtils.commit(db)
    
    @staticmethod
    def reset_all_user_scores(db: Session) -> Dict[str, Any]:
        """
        Reset all user scores to zero and all prediction points to zero (admin only)
        """
        from models.user_scores import UserScores
        from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
        
        try:
            # Get all user scores
            all_scores = DBReader.get_all_user_scores(db)
            count = 0
            
            for user_scores in all_scores:
                DBWriter.reset_user_scores(db, user_scores)
                count += 1
            
            # Reset all prediction points
            match_pred_count = DBWriter.reset_match_prediction_points(db)
            group_pred_count = DBWriter.reset_group_prediction_points(db)
            third_place_pred_count = DBWriter.reset_third_place_prediction_points(db)
            knockout_pred_count = DBWriter.reset_knockout_prediction_points(db)
            
            DBUtils.commit(db)
            
            return {
                "message": f"Successfully reset scores for {count} users and {match_pred_count + group_pred_count + third_place_pred_count + knockout_pred_count} predictions",
                "users_reset": count,
                "match_predictions_reset": match_pred_count,
                "group_predictions_reset": group_pred_count,
                "third_place_predictions_reset": third_place_pred_count,
                "knockout_predictions_reset": knockout_pred_count
            }
        except Exception as e:
            DBUtils.rollback(db)
            raise Exception(f"Error resetting user scores: {str(e)}")
    
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
        predictions = DBReader.get_knockout_predictions_by_match(db, match_id)
        
        for pred in predictions:
            DBWriter.update_knockout_prediction(db, pred, is_editable=False)
        
        DBUtils.flush(db)
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
        knockout_result = DBReader.get_knockout_result(db, match_id)
        
        if knockout_result:
            # Update existing result
            DBWriter.update_knockout_result(
                db,
                knockout_result,
                team_1=team_1_id,
                team_2=team_2_id,
                winner_team_id=winner_team_id
            )
        else:
            # Create new result
            knockout_result = DBWriter.create_knockout_result(
                db,
                match_id=match_id,
                team1_id=team_1_id,
                team2_id=team_2_id,
                winner_id=winner_team_id
            )
        
        DBUtils.flush(db)
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
        print(f"Updating knockout result for match {match_id}, team_1_id: {team_1_id}, team_2_id: {team_2_id}, winner_team_id: {winner_team_id}")
        # 1. Verify match exists
        match = DBReader.get_match(db, match_id)
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

        # 4. Process all predictions: status updates and scoring (replaces ScoringService)
        from services.predictions.knockout_service import KnockoutService
        loser_team_id = team_2_id if winner_team_id == team_1_id else team_1_id
        KnockoutService.process_knockout_match_result(
            db, match_id, winner_team_id, loser_team_id
        )
        
        # 5. Process each prediction for invalidation
        for prediction in predictions:
            print(f"Processing prediction: {prediction.id}, winner_team_id: {prediction.winner_team_id}, winner_team_id_from_result: {winner_team_id}")
            if prediction.winner_team_id and prediction.winner_team_id != winner_team_id:
                wrong_winner_team_id = prediction.winner_team_id
                next_prediction, position = KnockoutService._find_next_prediction_and_position(
                    db, prediction
                )

                if next_prediction and position:
                    team_at_position = next_prediction.team1_id if position == 1 else next_prediction.team2_id
                    if team_at_position == wrong_winner_team_id:
                        if position == 1:
                            KnockoutService.set_team(db, next_prediction, team1_id=0)
                        else:
                            KnockoutService.set_team(db, next_prediction, team2_id=0)

            KnockoutService._compute_and_set_status(db, prediction)
        
        DBUtils.commit(db)
        
        return {
            "success": True,
            "message": "Knockout result updated successfully",
            "match_id": match_id
        }
    
    @staticmethod
    def build_round32_bracket_from_results(db: Session) -> Dict[str, Any]:
        """
        Build Round of 32 bracket from actual group stage and third place results.
        This creates/updates Match records and KnockoutStageResult records for Round of 32.
        
        Returns:
            Dict with success status and summary
        """
        from models.third_place_combinations import ThirdPlaceCombination
        from models.matches_template import MatchTemplate
        from datetime import datetime, timedelta
        
        try:
            # Step 1: Verify we have all required results
            group_results = DBReader.get_all_group_stage_results(db)
            if len(group_results) != 12:
                raise ValueError(f"Expected 12 group results, found {len(group_results)}")
            
            third_place_result = DBReader.get_third_place_result(db)
            if not third_place_result:
                raise ValueError("No third place results found")
            
            # Step 2: Build the list of third-place qualifiers from actual results
            qualifying_teams = [
                third_place_result.first_team_qualifying,
                third_place_result.second_team_qualifying,
                third_place_result.third_team_qualifying,
                third_place_result.fourth_team_qualifying,
                third_place_result.fifth_team_qualifying,
                third_place_result.sixth_team_qualifying,
                third_place_result.seventh_team_qualifying,
                third_place_result.eighth_team_qualifying
            ]
            
            # Find the groups of the qualifying teams
            third_place_groups = []
            for team_id in qualifying_teams:
                team = DBReader.get_team(db, team_id)
                if team:
                    third_place_groups.append(team.group_letter)
            
            # Step 3: Find the matching combination
            hash_key = ''.join(sorted(third_place_groups))
            combination = DBReader.get_third_place_combination_by_hash(db, hash_key)
            
            if not combination:
                raise ValueError(f"No combination found for hash_key: {hash_key}")
            
            # Step 4: Create mapping for third-place teams
            third_team_mapping = {
                '3rd_team_1': 'match_1E',
                '3rd_team_2': 'match_1I',
                '3rd_team_3': 'match_1A',
                '3rd_team_4': 'match_1L',
                '3rd_team_5': 'match_1D',
                '3rd_team_6': 'match_1G',
                '3rd_team_7': 'match_1B',
                '3rd_team_8': 'match_1K'
            }
            
            # Step 5: Get round 32 templates
            round32_templates = DBReader.get_match_templates_by_stage_ordered(db, 'round32')
            
            if len(round32_templates) != 16:
                raise ValueError(f"Expected 16 round32 templates, found {len(round32_templates)}")
            
            # Step 6: Helper function to resolve team from source
            def get_team_for_source(team_source: str):
                if team_source.startswith('3rd_team_'):
                    # Third-place team from actual results
                    column_name = third_team_mapping.get(team_source)
                    if not column_name:
                        return None
                    
                    third_place_source = getattr(combination, column_name, None)  # 3A, 3B, etc.
                    if not third_place_source:
                        return None
                    
                    group_letter = third_place_source[1]  # 3A -> A
                    group = DBReader.get_group_by_name(db, group_letter)
                    
                    if group:
                        result = DBReader.get_group_stage_result(db, group.id)
                        
                        if result:
                            return DBReader.get_team(db, result.third_place)
                    
                    return None
                else:
                    # Regular team (1A, 2B, etc.) from actual results
                    if len(team_source) >= 2 and team_source[0].isdigit():
                        group_letter = team_source[1]  # 1A -> A
                        position = int(team_source[0])  # 1A -> 1
                        
                        group = DBReader.get_group_by_name(db, group_letter)
                        if group:
                            result = DBReader.get_group_stage_result(db, group.id)
                            
                            if result:
                                if position == 1:
                                    return DBReader.get_team(db, result.first_place)
                                elif position == 2:
                                    return DBReader.get_team(db, result.second_place)
                    
                    return None
            
            # Step 7: Create/update matches and results
            base_date = datetime(2026, 7, 1)
            matches_created = 0
            matches_updated = 0
            results_created = 0
            results_updated = 0
            
            for i, template in enumerate(round32_templates):
                match_id = 73 + i  # Matches 73-88
                
                # Resolve the participating teams
                home_team = get_team_for_source(template.team_1)
                away_team = get_team_for_source(template.team_2)
                
                if not home_team or not away_team:
                    continue
                
                # Create or update Match record
                match_date = base_date + timedelta(days=i//2)  # 2 matches per day
                match_time = datetime.combine(match_date.date(), datetime.min.time().replace(hour=16 + (i % 2) * 3))
                
                existing_match = DBReader.get_match(db, match_id)
                if not existing_match:
                    DBWriter.create_match(
                        db,
                        id=match_id,
                        stage='round32',
                        home_team_id=home_team.id,
                        away_team_id=away_team.id,
                        status='scheduled',
                        date=match_time,
                        match_number=template.id,
                        home_team_source=template.team_1,
                        away_team_source=template.team_2
                    )
                    matches_created += 1
                else:
                    update_kwargs = {
                        "home_team_id": home_team.id,
                        "away_team_id": away_team.id,
                        "home_team_source": template.team_1,
                        "away_team_source": template.team_2,
                        "status": "scheduled",
                    }
                    if not existing_match.date:
                        update_kwargs["date"] = match_time
                    if not existing_match.match_number:
                        update_kwargs["match_number"] = template.id
                    DBWriter.update_match(db, existing_match, **update_kwargs)
                    matches_updated += 1
                
                # Create or update KnockoutStageResult record
                existing_result = DBReader.get_knockout_result(db, match_id)
                
                if not existing_result:
                    DBWriter.create_knockout_result(
                        db,
                        match_id=match_id,
                        team1_id=home_team.id,
                        team2_id=away_team.id,
                        winner_id=None
                    )
                    results_created += 1
                else:
                    DBWriter.update_knockout_result(
                        db,
                        existing_result,
                        team_1=home_team.id,
                        team_2=away_team.id
                    )
                    # Don't reset winner_team_id if it exists
                    results_updated += 1
            
            DBUtils.commit(db)
            
            return {
                "success": True,
                "message": "Round of 32 bracket built successfully",
                "matches_created": matches_created,
                "matches_updated": matches_updated,
                "results_created": results_created,
                "results_updated": results_updated,
                "total_matches": 16,
                "combination_hash": hash_key
            }
            
        except Exception as e:
            DBUtils.rollback(db)
            raise Exception(f"Error building Round of 32 bracket: {str(e)}")