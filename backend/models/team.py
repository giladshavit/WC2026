from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, CHAR

from .base import Base

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    flag_url = Column(String, nullable=True)  # URL to team flag image
    
    # Group stage information
    group_letter = Column(CHAR(1), nullable=True)  # A, B, C, D, E, F, G, H, I, J, K, L
    group_position = Column(Integer, nullable=True)  # 1, 2, 3, 4 (position in group)
    goals_for = Column(Integer, default=0)  # goals scored
    goals_against = Column(Integer, default=0)  # goals conceded
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @property
    def goal_difference(self):
        """Calculate goal difference (goals_for - goals_against)"""
        return self.goals_for - self.goals_against
    
    def __repr__(self):
        return f"<Team(id={self.id}, name='{self.name}', group='{self.group_letter}', position={self.group_position})>"
