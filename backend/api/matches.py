from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from services.match_service import MatchService
from database import get_db

router = APIRouter()

@router.get("/matches", response_model=List[Dict[str, Any]])
def get_all_matches(db: Session = Depends(get_db)):
    """
    Get all matches without user context (filters out matches with undefined teams)
    """
    return MatchService.get_all_matches_basic(db)
