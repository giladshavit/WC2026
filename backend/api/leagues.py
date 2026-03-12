from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
import re

from database import get_db
from services.league_service import LeagueService
from services.auth_service import AuthService
from models.user import User

router = APIRouter()
security = HTTPBearer()

# Pydantic models for request/response
class CreateLeagueRequest(BaseModel):
    name: str
    description: Optional[str] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError("League name must be at least 3 characters long")
        if len(v) > 100:
            raise ValueError("League name must be less than 100 characters")
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError("Description must be less than 500 characters")
        return v

class JoinLeagueRequest(BaseModel):
    invite_code: str

    @validator('invite_code')
    def validate_invite_code(cls, v):
        if not re.match(r"^[A-Z0-9]{8}$", v):
            raise ValueError("Invite code must be exactly 8 uppercase letters and numbers")
        return v

class LeagueResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    created_by: int
    created_at: str
    member_count: int
    joined_at: Optional[str] = None

class LeagueStanding(BaseModel):
    rank: int
    user_id: int
    username: str
    name: str
    total_points: int
    matches_points: int
    groups_points: int
    third_place_points: int
    knockout_points: int
    bonus_points: int = 0
    penalty: int = 0
    joined_at: Optional[str] = None

class LeagueStandingsResponse(BaseModel):
    league_info: Optional[Dict[str, Any]] = None
    standings: List[LeagueStanding]
    total_count: int
    page: int
    page_size: int
    current_user_entry: Optional[LeagueStanding] = None


class MemberMatchPrediction(BaseModel):
    user_id: int
    username: str
    name: Optional[str] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    points: int
    prediction_status: Optional[str] = None  # 'exact', 'correct_outcome', 'wrong', None
    is_tempted: bool = False


class LeagueMatchPredictionsResponse(BaseModel):
    match_id: int
    match_status: str
    actual_result: Optional[Dict[str, Any]] = None  # {home_score, away_score} or null
    predictions: List[MemberMatchPrediction]


# Dependency to get current user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    try:
        token = credentials.credentials
        return AuthService.get_current_user(db, token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

@router.post("/leagues", response_model=LeagueResponse)
def create_league(
    league_data: CreateLeagueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new league.
    
    - **name**: League name (3-100 characters)
    - **description**: Optional description (max 500 characters)
    """
    try:
        result = LeagueService.create_league(
            db=db,
            user_id=current_user.id,
            name=league_data.name,
            description=league_data.description
        )
        return LeagueResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create league: {str(e)}"
        )

@router.get("/leagues", response_model=List[LeagueResponse])
def get_user_leagues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all leagues that the current user is a member of.
    """
    try:
        leagues = LeagueService.get_user_leagues(db=db, user_id=current_user.id)
        return [LeagueResponse(**league) for league in leagues]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user leagues: {str(e)}"
        )

@router.post("/leagues/join", response_model=Dict[str, Any])
def join_league(
    join_data: JoinLeagueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Join a league using an invite code.
    
    - **invite_code**: 8-character invite code
    """
    try:
        result = LeagueService.join_league_by_code(
            db=db,
            user_id=current_user.id,
            invite_code=join_data.invite_code
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join league: {str(e)}"
        )

@router.get("/leagues/global", response_model=LeagueStandingsResponse)
def get_global_standings(
    sort_by: str = Query("total", enum=["total", "matches", "groups", "knockout", "bonus", "fine"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get global standings (all users).
    """
    try:
        result = LeagueService.get_global_standings(
            db=db,
            current_user_id=current_user.id,
            sort_by=sort_by,
            page=page,
            page_size=page_size,
        )
        standings_data = [LeagueStanding(**s) for s in result["standings"]]
        current_entry = LeagueStanding(**result["current_user_entry"]) if result.get("current_user_entry") else None
        return LeagueStandingsResponse(
            league_info=None,
            standings=standings_data,
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            current_user_entry=current_entry,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get global standings: {str(e)}"
        )

@router.get("/leagues/{league_id}/standings", response_model=LeagueStandingsResponse)
def get_league_standings(
    league_id: int,
    sort_by: str = Query("total", enum=["total", "matches", "groups", "knockout", "bonus", "fine"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get standings for a specific league.

    - **league_id**: League ID
    """
    try:
        result = LeagueService.get_league_standings(
            db=db,
            league_id=league_id,
            current_user_id=current_user.id,
            sort_by=sort_by,
            page=page,
            page_size=page_size,
        )
        league_info = LeagueService.get_league_info(db=db, league_id=league_id)
        standings_data = [LeagueStanding(**s) for s in result["standings"]]
        current_entry = LeagueStanding(**result["current_user_entry"]) if result.get("current_user_entry") else None
        return LeagueStandingsResponse(
            league_info=league_info,
            standings=standings_data,
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            current_user_entry=current_entry,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get league standings: {str(e)}"
        )

@router.get("/leagues/global/match/{match_id}/predictions", response_model=LeagueMatchPredictionsResponse)
def get_global_match_predictions(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all users' predictions for a match (global league).
    Only available when match has started (live or finished).
    """
    try:
        result = LeagueService.get_global_match_predictions(db=db, match_id=match_id)
        return LeagueMatchPredictionsResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get global match predictions: {str(e)}"
        )


@router.delete("/leagues/{league_id}/leave")
def leave_league(
    league_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove the current user from a league."""
    LeagueService.leave_league(db, user_id=current_user.id, league_id=league_id)
    return {"message": "Successfully left the league"}


@router.get("/leagues/{league_id}/match/{match_id}/predictions", response_model=LeagueMatchPredictionsResponse)
def get_league_match_predictions(
    league_id: int,
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all league members' predictions for a match.
    Only available when match has started (live or finished).
    """
    try:
        result = LeagueService.get_league_match_predictions(db=db, league_id=league_id, match_id=match_id)
        return LeagueMatchPredictionsResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get league match predictions: {str(e)}"
        )


@router.get("/leagues/{league_id}", response_model=LeagueResponse)
def get_league_info(
    league_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get basic information about a league.
    
    - **league_id**: League ID
    """
    try:
        league_info = LeagueService.get_league_info(db=db, league_id=league_id)
        return LeagueResponse(**league_info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get league info: {str(e)}"
        )
