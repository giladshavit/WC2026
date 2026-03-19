from sqlalchemy import Boolean, Column, Integer, ForeignKey
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
    bonus_score = Column(Integer, default=0, nullable=False)
    bonus_penalty = Column(Integer, default=0, nullable=False)
    classic_total_score = Column(Integer, default=0, nullable=False)
    
    # Match prediction accuracy counters
    matches_total_judged = Column(Integer, default=0)
    
    # Penalty points (penalty = total sum of groups + third_place + knockout)
    penalty = Column(Integer, default=0)
    groups_penalty = Column(Integer, default=0, nullable=False)
    third_place_penalty = Column(Integer, default=0, nullable=False)
    knockout_penalty = Column(Integer, default=0, nullable=False)
    has_used_bracket_reset = Column(Boolean, default=False, nullable=False)
    free_changes = Column(Integer, default=0, nullable=False)
    free_changes_used = Column(Integer, default=0, nullable=False)
    
    # Total points (sum of all scores above minus penalty)
    total_points = Column(Integer, default=0)
    
    # Relationship to User
    user = relationship("User", backref="scores")
