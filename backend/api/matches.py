from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from services.match_service import MatchService
from database import get_db

router = APIRouter()

@router.get("/matches", response_model=List[Dict[str, Any]])
def get_all_matches_with_predictions(db: Session = Depends(get_db)):
    """
    Get all matches (user-agnostic)
    """
    return MatchService.get_all_matches_with_predictions(db)
