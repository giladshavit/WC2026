from typing import Dict, List, Any
from sqlalchemy.orm import Session
from ..models.team import Team

class TeamService:
    
    @staticmethod
    def create_team(db: Session, name: str, country_code: str, flag_url: str = None) -> Dict[str, Any]:
        """
        יוצר קבוצה חדשה
        """
        # בודק אם הקבוצה כבר קיימת
        existing_team = db.query(Team).filter(
            (Team.name == name) | (Team.country_code == country_code)
        ).first()
        
        if existing_team:
            return {"error": f"Team {name} or country code {country_code} already exists"}
        
        team = Team(
            name=name,
            country_code=country_code,
            flag_url=flag_url
        )
        
        db.add(team)
        db.commit()
        db.refresh(team)
        
        return {
            "id": team.id,
            "name": team.name,
            "country_code": team.country_code,
            "flag_url": team.flag_url
        }

    @staticmethod
    def get_all_teams(db: Session) -> List[Dict[str, Any]]:
        """
        מביא את כל הקבוצות
        """
        teams = db.query(Team).all()
        return [
            {
                "id": team.id,
                "name": team.name,
                "country_code": team.country_code,
                "flag_url": team.flag_url
            }
            for team in teams
        ]

    @staticmethod
    def create_multiple_teams(db: Session, teams_data: List[Dict]) -> Dict[str, Any]:
        """
        יוצר מספר קבוצות בבת אחת
        """
        created_teams = []
        errors = []
        
        for team_data in teams_data:
            name = team_data.get("name")
            country_code = team_data.get("country_code")
            flag_url = team_data.get("flag_url")
            
            if not name or not country_code:
                errors.append(f"Missing name or country_code for team: {team_data}")
                continue
            
            result = TeamService.create_team(db, name, country_code, flag_url)
            
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
