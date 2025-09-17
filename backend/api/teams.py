from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from models.team import Team
from database import get_db

router = APIRouter()

@router.get("/teams", response_model=List[Dict[str, Any]])
def get_teams(db: Session = Depends(get_db)):
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

@router.get("/teams/{team_id}", response_model=Dict[str, Any])
def get_team(team_id: int, db: Session = Depends(get_db)):
    """
    Get a specific team
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {
        "id": team.id,
        "name": team.name,
        "group_letter": team.group_letter,
        "group_position": team.group_position,
        "goals_for": team.goals_for,
        "goals_against": team.goals_against
    }
