from typing import Dict, List, Any
from sqlalchemy.orm import Session
from models.team import Team

class TeamService:
    
    @staticmethod
    def create_team(db: Session, name: str) -> Dict[str, Any]:
        """
        Create a new team
        """
        # Check if the team already exists
        existing_team = db.query(Team).filter(Team.name == name).first()
        
        if existing_team:
            return {"error": f"Team {name} already exists"}
        
        team = Team(name=name)
        
        db.add(team)
        db.commit()
        db.refresh(team)
        
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
        team = db.query(Team).filter(Team.id == team_id).first()
        
        if not team:
            return {"error": f"Team with id {team_id} not found"}
        
        team.group_letter = group_letter
        team.group_position = group_position
        
        db.commit()
        db.refresh(team)
        
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
        teams = db.query(Team).all()
        return [
            {
                "id": team.id,
                "name": team.name,
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