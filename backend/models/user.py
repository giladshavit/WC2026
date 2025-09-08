from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime

from .base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    total_points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
