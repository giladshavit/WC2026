from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base

class UserScores(Base):
    __tablename__ = "user_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Scores by prediction type
    matches_score = Column(Integer, default=0)
    groups_score = Column(Integer, default=0)
    third_place_score = Column(Integer, default=0)
    knockout_score = Column(Integer, default=0)
    
    # Penalty points
    penalty = Column(Integer, default=0)
    
    # Total points (sum of all scores above minus penalty)
    total_points = Column(Integer, default=0)
    
    # Relationship to User
    user = relationship("User", backref="scores")
