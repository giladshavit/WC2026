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
        from models.user import User
        from models.user_scores import UserScores
        
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user scores from new table
        user_scores = db.query(UserScores).filter(UserScores.user_id == user_id).first()
        
        if not user_scores:
            # Create default scores if they don't exist
            user_scores = UserScores(
                user_id=user_id,
                matches_score=0,
                groups_score=0,
                third_place_score=0,
                knockout_score=0,
                total_points=0
            )
            db.add(user_scores)
            db.commit()
            db.refresh(user_scores)
        
        breakdown = {
            "user_id": user_id,
            "user_name": user.name,
            "total_points": user_scores.total_points,
            "breakdown": {
                "matches_score": user_scores.matches_score,
                "groups_score": user_scores.groups_score,
                "third_place_score": user_scores.third_place_score,
                "knockout_score": user_scores.knockout_score
            }
        }
        
        return breakdown
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user breakdown: {str(e)}")
