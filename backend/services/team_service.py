from typing import Dict, List, Any
from sqlalchemy.orm import Session
from models.team import Team
from services.database import DBReader, DBWriter, DBUtils

class TeamService:
    
    @staticmethod
    def create_team(db: Session, name: str) -> Dict[str, Any]:
        """
        Create a new team
        """
        # Check if the team already exists
        existing_team = DBReader.get_team_by_name(db, name)
        
        if existing_team:
            return {"error": f"Team {name} already exists"}
        
        team = DBWriter.create_team(db, name)
        
        DBUtils.commit(db)
        DBUtils.refresh(db, team)
        
        return {
            "id": team.id,
            "name": team.name,
            "group_letter": team.group_letter,
            "group_position": team.group_position,
            "goals_for": team.goals_for,
            "goals_against": team.goals_against
        }

    @staticmethod
    def update_team_group(db: Session, team_id: int, group_letter: str, group_position: int) -> Dict[str, Any]:
        """
        Update a team with its group information
        """
        team = DBReader.get_team(db, team_id)
        
        if not team:
            return {"error": f"Team with id {team_id} not found"}
        
        DBWriter.update_team_group(db, team, group_letter, group_position)
        
        DBUtils.commit(db)
        DBUtils.refresh(db, team)
        
        return {
            "id": team.id,
            "name": team.name,
            "group_letter": team.group_letter,
            "group_position": team.group_position,
            "updated": True
        }

    @staticmethod
    def get_all_teams(db: Session) -> List[Dict[str, Any]]:
        """
        Get all teams
        """
        teams = DBReader.get_all_teams(db)
        return [
            {
                "id": team.id,
                "name": team.name,
                "short_name": team.short_name,
                "flag_url": team.flag_url,
                "group_letter": team.group_letter,
                "group_position": team.group_position,
                "goals_for": team.goals_for,
                "goals_against": team.goals_against
            }
            for team in teams
        ]

    @staticmethod
    def create_multiple_teams(db: Session, teams_data: List[Dict]) -> Dict[str, Any]:
        """
        Create multiple teams at once
        """
        created_teams = []
        errors = []
        
        for team_data in teams_data:
            name = team_data.get("name")
            
            if not name:
                errors.append(f"Missing name for team: {team_data}")
                continue
            
            result = TeamService.create_team(db, name)
            
            if "error" in result:
                errors.append(result["error"])
            else:
                created_teams.append(result)
        
        return {
            "created_teams": created_teams,
            "errors": errors,
            "total_created": len(created_teams),
            "total_errors": len(errors)
        }