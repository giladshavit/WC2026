from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from datetime import datetime

from services.match_service import MatchService
from services.team_service import TeamService
from services.group_service import GroupService
from database import get_db

router = APIRouter()

# Pydantic models for request validation
class GroupStageMatchRequest(BaseModel):
    home_team_id: int
    away_team_id: int
    group: str
    date: datetime

class KnockoutMatchRequest(BaseModel):
    stage: str  # round16, quarter, semi, final
    match_number: int
    home_team_source: str
    away_team_source: str
    date: datetime

class TeamRequest(BaseModel):
    name: str
    country_code: str
    flag_url: str = None

class MultipleTeamsRequest(BaseModel):
    teams: List[TeamRequest]

@router.post("/admin/teams", response_model=Dict[str, Any])
def create_team(team_request: TeamRequest, db: Session = Depends(get_db)):
    """
    יוצר קבוצה חדשה (admin only)
    """
    result = TeamService.create_team(
        db, 
        team_request.name, 
        team_request.country_code, 
        team_request.flag_url
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/admin/teams/batch", response_model=Dict[str, Any])
def create_multiple_teams(teams_request: MultipleTeamsRequest, db: Session = Depends(get_db)):
    """
    יוצר מספר קבוצות בבת אחת (admin only)
    """
    teams_data = [
        {
            "name": team.name,
            "country_code": team.country_code,
            "flag_url": team.flag_url
        }
        for team in teams_request.teams
    ]
    
    result = TeamService.create_multiple_teams(db, teams_data)
    return result

@router.get("/admin/teams", response_model=List[Dict[str, Any]])
def get_all_teams(db: Session = Depends(get_db)):
    """
    מביא את כל הקבוצות (admin only)
    """
    return TeamService.get_all_teams(db)

@router.post("/admin/matches/group-stage", response_model=Dict[str, Any])
def create_group_stage_match(match_request: GroupStageMatchRequest, db: Session = Depends(get_db)):
    """
    יוצר משחק שלב בתים (admin only)
    """
    result = MatchService.create_group_stage_match(
        db, 
        match_request.home_team_id, 
        match_request.away_team_id, 
        match_request.group, 
        match_request.date
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/admin/matches/knockout", response_model=Dict[str, Any])
def create_knockout_match(match_request: KnockoutMatchRequest, db: Session = Depends(get_db)):
    """
    יוצר משחק נוקאאוט (admin only)
    """
    result = MatchService.create_knockout_match(
        db,
        match_request.stage,
        match_request.match_number,
        match_request.home_team_source,
        match_request.away_team_source,
        match_request.date
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# Group management endpoints
@router.post("/admin/groups", response_model=Dict[str, Any])
def create_group(group_name: str, db: Session = Depends(get_db)):
    """
    יוצר בית חדש (admin only)
    """
    result = GroupService.create_group(db, group_name)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/groups", response_model=List[Dict[str, Any]])
def get_all_groups(db: Session = Depends(get_db)):
    """
    מביא את כל הבתים (admin only)
    """
    return GroupService.get_all_groups(db)

@router.post("/admin/groups/{group_id}/results", response_model=Dict[str, Any])
def create_group_result(
    group_id: int,
    team_id: int,
    position: int,
    points: int = 0,
    goals_for: int = 0,
    goals_against: int = 0,
    db: Session = Depends(get_db)
):
    """
    יוצר תוצאה לבית (admin only)
    """
    result = GroupService.create_group_result(
        db, group_id, team_id, position, points, goals_for, goals_against
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/groups/{group_id}/results", response_model=List[Dict[str, Any]])
def get_group_results(group_id: int, db: Session = Depends(get_db)):
    """
    מביא את תוצאות הבית (admin only)
    """
    return GroupService.get_group_results(db, group_id)
