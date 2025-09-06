from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.base import Base

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(1), nullable=False, unique=True)  # A, B, C, D...
    team_1 = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team_2 = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team_3 = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team_4 = Column(Integer, ForeignKey("teams.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    team_1_obj = relationship("Team", foreign_keys=[team_1])
    team_2_obj = relationship("Team", foreign_keys=[team_2])
    team_3_obj = relationship("Team", foreign_keys=[team_3])
    team_4_obj = relationship("Team", foreign_keys=[team_4])

