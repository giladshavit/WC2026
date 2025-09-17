from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import Base

class GroupStageResult(Base):
    __tablename__ = "group_stage_results"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    first_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    second_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    third_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fourth_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group")
    first_place_team = relationship("Team", foreign_keys=[first_place])
    second_place_team = relationship("Team", foreign_keys=[second_place])
    third_place_team = relationship("Team", foreign_keys=[third_place])
    fourth_place_team = relationship("Team", foreign_keys=[fourth_place])

class ThirdPlaceResult(Base):
    __tablename__ = "third_place_results"
    
    id = Column(Integer, primary_key=True, index=True)
    first_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    second_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    third_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fourth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fifth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    sixth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    seventh_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    eighth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    first_team = relationship("Team", foreign_keys=[first_team_qualifying])
    second_team = relationship("Team", foreign_keys=[second_team_qualifying])
    third_team = relationship("Team", foreign_keys=[third_team_qualifying])
    fourth_team = relationship("Team", foreign_keys=[fourth_team_qualifying])
    fifth_team = relationship("Team", foreign_keys=[fifth_team_qualifying])
    sixth_team = relationship("Team", foreign_keys=[sixth_team_qualifying])
    seventh_team = relationship("Team", foreign_keys=[seventh_team_qualifying])
    eighth_team = relationship("Team", foreign_keys=[eighth_team_qualifying])

class KnockoutStageResult(Base):
    __tablename__ = "knockout_stage_results"
    
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)  # refers to matches (73-104)
    team_1 = Column(Integer, ForeignKey("teams.id"), nullable=True)  # nullable until results are available
    team_2 = Column(Integer, ForeignKey("teams.id"), nullable=True)  # nullable until results are available
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # nullable until results are available
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    match = relationship("Match", foreign_keys=[match_id])
    team_1_obj = relationship("Team", foreign_keys=[team_1])
    team_2_obj = relationship("Team", foreign_keys=[team_2])
    winner_team = relationship("Team", foreign_keys=[winner_team_id])
