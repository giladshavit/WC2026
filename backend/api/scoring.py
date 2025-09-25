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
    Get detailed scoring breakdown for a specific user.
    Shows points from each prediction type.
    
    Args:
        user_id: ID of the user
        db: Database session
        
    Returns:
        Detailed breakdown of user's points by prediction type
    """
    try:
        from models.user import User
        from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
        
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        breakdown = {
            "user_id": user_id,
            "user_name": user.name,
            "total_points": user.total_points,
            "breakdown": {
                "match_predictions": {
                    "total_predictions": 0,
                    "total_points": 0,
                    "average_points": 0
                },
                "group_predictions": {
                    "total_predictions": 0,
                    "total_points": 0
                },
                "third_place_predictions": {
                    "total_predictions": 0,
                    "total_points": 0
                },
                "knockout_predictions": {
                    "total_predictions": 0,
                    "total_points": 0
                }
            }
        }
        
        # Calculate match prediction breakdown
        match_predictions = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id
        ).all()
        
        match_points = 0
        for prediction in match_predictions:
            if prediction.points:
                match_points += prediction.points
        
        breakdown["breakdown"]["match_predictions"] = {
            "total_predictions": len(match_predictions),
            "total_points": match_points,
            "average_points": match_points / len(match_predictions) if match_predictions else 0
        }
        
        # Calculate knockout prediction breakdown
        knockout_predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).all()
        
        knockout_points = 0
        for prediction in knockout_predictions:
            if prediction.points:
                knockout_points += prediction.points
        
        breakdown["breakdown"]["knockout_predictions"] = {
            "total_predictions": len(knockout_predictions),
            "total_points": knockout_points
        }
        
        return breakdown
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user breakdown: {str(e)}")
