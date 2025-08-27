from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime

from .base import Base

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    country_code = Column(String, nullable=False, unique=True)  # ARG, BRA, FRA
    flag_url = Column(String)  # URL לדגל הקבוצה
    created_at = Column(DateTime, default=datetime.utcnow)
