from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.base import Base

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(1), nullable=False, unique=True)  # A, B, C, D...
    created_at = Column(DateTime, default=datetime.utcnow)

class GroupResult(Base):
    __tablename__ = "group_results"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    position = Column(Integer, nullable=False)  # 1, 2, 3, 4
    points = Column(Integer, default=0)  # נקודות שהקבוצה צברה
    goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0)
    goal_difference = Column(Integer, default=0)  # goals_for - goals_against
    
    # Relationships
    group = relationship("Group")
    team = relationship("Team")
