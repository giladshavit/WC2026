from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from services.group_service import GroupService
from database import get_db

router = APIRouter()

@router.get("/groups", response_model=List[Dict[str, Any]])
def get_groups_with_teams(db: Session = Depends(get_db)):
    """
    Get all groups with their teams
    """
    return GroupService.get_all_groups_with_teams(db)

@router.get("/groups/{group_name}", response_model=Dict[str, Any])
def get_group_with_teams(group_name: str, db: Session = Depends(get_db)):
    """
    Get a specific group with its teams
    """
    result = GroupService.get_group_with_teams(db, group_name)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result
