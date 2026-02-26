from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from services.statistics import (
    MatchStatisticsService,
    GroupStatisticsService,
    ThirdPlaceStatisticsService,
    KnockoutStatisticsService,
    UserProfileStatisticsService,
)
from database import get_db

router = APIRouter()


@router.get("/stats/matches/{match_id}", response_model=Dict[str, Any])
def get_match_statistics(match_id: int, db: Session = Depends(get_db)):
    """
    Stats for a match. Server returns the right data based on match state:
    - No result yet: winner distribution + popular scores
    - Has result: accuracy breakdown
    """
    result = MatchStatisticsService.get_match_statistics(db, match_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/stats/user/{user_id}/matches", response_model=Dict[str, Any])
def get_user_match_profile(user_id: int, db: Session = Depends(get_db)):
    """User's match prediction accuracy from stored counters."""
    result = MatchStatisticsService.get_user_match_profile(db, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.get("/stats/groups/{group_id}", response_model=Dict[str, Any])
def get_group_statistics(group_id: int, db: Session = Depends(get_db)):
    """Stats for a group. Server decides pre/post."""
    result = GroupStatisticsService.get_group_statistics(db, group_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/stats/third-place", response_model=Dict[str, Any])
def get_third_place_statistics(db: Session = Depends(get_db)):
    """
    Stats for third place qualifying predictions.
    - No result: % who picked each group
    - Has result: accuracy per group + distribution of correct groups (4-8)
    """
    return ThirdPlaceStatisticsService.get_third_place_statistics(db)


@router.get("/stats/knockout/{template_match_id}", response_model=Dict[str, Any])
def get_knockout_match_statistics(template_match_id: int, db: Session = Depends(get_db)):
    """
    Stats for a knockout match. Server decides pre/post:
    - No result: top 3 matchups with winner distribution
    - Has result: exact winner %, partial winner %, correct matchup %
    """
    return KnockoutStatisticsService.get_knockout_match_statistics(db, template_match_id)


@router.get("/stats/user/{user_id}/profile", response_model=Dict[str, Any])
def get_user_full_profile(user_id: int, db: Session = Depends(get_db)):
    """Complete user scoring profile for StatisticsScreen."""
    result = UserProfileStatisticsService.get_user_full_profile(db, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
