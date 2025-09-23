from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from datetime import datetime

from services.match_service import MatchService
from services.team_service import TeamService
from services.group_service import GroupService
from services.results_service import ResultsService
from models.groups import Group
from database import get_db

router = APIRouter()

# Pydantic models for request validation
class GroupStageMatchRequest(BaseModel):
    pass  # deprecated

class KnockoutMatchRequest(BaseModel):
    pass  # deprecated

class TeamRequest(BaseModel):
    name: str

class MultipleTeamsRequest(BaseModel):
    teams: List[TeamRequest]

class UpdateTeamGroupRequest(BaseModel):
    team_id: int
    group_letter: str
    group_position: int

@router.post("/admin/teams", response_model=Dict[str, Any])
def create_team(team_request: TeamRequest, db: Session = Depends(get_db)):
    """
    Create a new team (admin only)
    """
    result = TeamService.create_team(
        db, 
        team_request.name
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/admin/teams/batch", response_model=Dict[str, Any])
def create_multiple_teams(teams_request: MultipleTeamsRequest, db: Session = Depends(get_db)):
    """
    Create multiple teams at once (admin only)
    """
    teams_data = [
        {
            "name": team.name
        }
        for team in teams_request.teams
    ]
    
    result = TeamService.create_multiple_teams(db, teams_data)
    return result

@router.put("/admin/teams/{team_id}/group", response_model=Dict[str, Any])
def update_team_group(team_id: int, group_request: UpdateTeamGroupRequest, db: Session = Depends(get_db)):
    """
    Update a team with its group information (admin only)
    """
    result = TeamService.update_team_group(
        db, 
        team_id, 
        group_request.group_letter, 
        group_request.group_position
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/teams", response_model=List[Dict[str, Any]])
def get_all_teams(db: Session = Depends(get_db)):
    """
    Get all teams (admin only)
    """
    return TeamService.get_all_teams(db)

@router.post("/admin/matches/group-stage", response_model=Dict[str, Any])
def create_group_stage_match():
    raise HTTPException(status_code=410, detail="Deprecated: matches are created by scripts")

@router.post("/admin/matches/knockout", response_model=Dict[str, Any])
def create_knockout_match():
    raise HTTPException(status_code=410, detail="Deprecated: matches are created by scripts")

# Group management endpoints
@router.post("/admin/groups", response_model=Dict[str, Any])
def create_group(group_name: str, db: Session = Depends(get_db)):
    """
    Create a new group (admin only)
    """
    result = GroupService.create_group(db, group_name)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/groups", response_model=List[Dict[str, Any]])
def get_all_groups(db: Session = Depends(get_db)):
    """
    Get all groups (admin only)
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
    Create a result for a group (admin only)
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
    Get group results (admin only)
    """
    return GroupService.get_group_results(db, group_id)

class UpdateGroupRequest(BaseModel):
    team_1: int
    team_2: int
    team_3: int
    team_4: int

class MatchResultRequest(BaseModel):
    home_team_score: int
    away_team_score: int

class GroupStageResultRequest(BaseModel):
    first_place_team_id: int
    second_place_team_id: int
    third_place_team_id: int
    fourth_place_team_id: int

@router.put("/admin/groups/{group_name}", response_model=Dict[str, Any])
def update_group(group_name: str, update_request: UpdateGroupRequest, db: Session = Depends(get_db)):
    """
    Update a group with its teams (admin only)
    """
    # Find group by name
    group = db.query(Group).filter(Group.name == group_name).first()
    if not group:
        raise HTTPException(status_code=404, detail=f"Group {group_name} not found")
    
    # Update teams
    group.team_1 = update_request.team_1
    group.team_2 = update_request.team_2
    group.team_3 = update_request.team_3
    group.team_4 = update_request.team_4
    
    db.commit()
    db.refresh(group)
    
    return {"id": group.id, "name": group.name, "updated": True}

# Match results endpoints
@router.get("/admin/matches/results", response_model=List[Dict[str, Any]])
def get_all_matches_with_results(db: Session = Depends(get_db)):
    """
    Get all matches with their current results (admin only)
    Only returns matches where both teams are defined
    """
    return ResultsService.get_all_matches_with_results(db)

@router.put("/admin/matches/{match_id}/result", response_model=Dict[str, Any])
def update_match_result(
    match_id: int, 
    result_request: MatchResultRequest, 
    db: Session = Depends(get_db)
):
    """
    Update or create a match result (admin only)
    """
    try:
        result = ResultsService.update_match_result(
            db=db,
            match_id=match_id,
            home_team_score=result_request.home_team_score,
            away_team_score=result_request.away_team_score
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Group results endpoints
@router.get("/admin/groups/results", response_model=List[Dict[str, Any]])
def get_all_groups_with_results(db: Session = Depends(get_db)):
    """
    Get all groups with their current results (admin only)
    """
    return ResultsService.get_all_groups_with_results(db)

@router.put("/admin/groups/{group_id}/result", response_model=Dict[str, Any])
def update_group_stage_result(
    group_id: int,
    result_request: GroupStageResultRequest,
    db: Session = Depends(get_db)
):
    """
    Update or create a group stage result (admin only)
    """
    try:
        result = ResultsService.update_group_stage_result(
            db=db,
            group_id=group_id,
            first_place_team_id=result_request.first_place_team_id,
            second_place_team_id=result_request.second_place_team_id,
            third_place_team_id=result_request.third_place_team_id,
            fourth_place_team_id=result_request.fourth_place_team_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")