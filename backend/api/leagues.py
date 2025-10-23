from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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
    joined_at: Optional[str] = None

class LeagueStandingsResponse(BaseModel):
    league_info: Optional[Dict[str, Any]] = None
    standings: List[LeagueStanding]

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
    db: Session = Depends(get_db)
):
    """
    Get global standings (all users).
    """
    try:
        standings = LeagueService.get_global_standings(db=db)
        standings_data = [LeagueStanding(**standing) for standing in standings]
        
        return LeagueStandingsResponse(
            league_info=None,  # No league info for global standings
            standings=standings_data
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get standings for a specific league.
    
    - **league_id**: League ID
    """
    try:
        # Get league info
        league_info = LeagueService.get_league_info(db=db, league_id=league_id)
        
        # Get standings
        standings = LeagueService.get_league_standings(db=db, league_id=league_id)
        standings_data = [LeagueStanding(**standing) for standing in standings]
        
        return LeagueStandingsResponse(
            league_info=league_info,
            standings=standings_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get league standings: {str(e)}"
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
