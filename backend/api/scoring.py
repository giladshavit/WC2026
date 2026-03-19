from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import get_db
from services.scoring_service import ScoringService

router = APIRouter()


@router.get("/leaderboard", response_model=List[Dict[str, Any]])
async def get_leaderboard(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of users to return"),
    db: Session = Depends(get_db)
):
    """
    Get the leaderboard with top users by points.
    
    Args:
        limit: Maximum number of users to return (1-100)
        db: Database session
        
    Returns:
        List of users with their rank, name, and total points, ordered by points descending
    """
    try:
        leaderboard = ScoringService.get_leaderboard(db, limit)
        return leaderboard
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving leaderboard: {str(e)}")




@router.get("/user/{user_id}/breakdown", response_model=Dict[str, Any])
async def get_user_scoring_breakdown(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed scoring breakdown for a specific user from the new user_scores table.
    Shows points from each prediction type.
    
    Args:
        user_id: ID of the user
        db: Database session
        
    Returns:
        Detailed breakdown of user's points by prediction type
    """
    try:
        return ScoringService.get_user_scoring_breakdown(db, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user breakdown: {str(e)}")
