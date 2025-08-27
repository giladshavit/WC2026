from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.team import Team
from models.base import Base

class GroupStageMatch(Base):
    __tablename__ = "group_stage_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, default="group")
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    group = Column(String, nullable=False)  # A, B, C, D...
    status = Column(String, default="scheduled")  # scheduled, live, finished
    date = Column(DateTime, nullable=False)
    
    # Relationships - זה אומר איך לגשת לקבוצות
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])

class KnockoutMatch(Base):
    __tablename__ = "knockout_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # round16, quarter, semi, final
    match_number = Column(Integer, nullable=False)
    home_team_source = Column(String, nullable=False)  # "A1", "winner_of_match_1"
    away_team_source = Column(String, nullable=False)  # "B2", "winner_of_match_2"
    home_team_id = Column(Integer, ForeignKey("teams.id"))  # הקבוצה האמיתית
    away_team_id = Column(Integer, ForeignKey("teams.id"))  # הקבוצה האמיתית
    affects_matches = Column(String)  # JSON string of match IDs that this affects
    status = Column(String, default="scheduled")  # scheduled, live, finished
    date = Column(DateTime, nullable=False)
    
    # Relationships
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
