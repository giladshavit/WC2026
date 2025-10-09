from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from services.match_service import MatchService
from database import get_db

router = APIRouter()

# This file is now empty - match endpoints moved to predictions.py
