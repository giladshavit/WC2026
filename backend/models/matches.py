from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.team import Team
from models.base import Base

class Match(Base):
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # "group", "round32", "round16", "quarter", "semi", "final"
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    status = Column(String, default="scheduled")  # scheduled, live, finished
    date = Column(DateTime, nullable=False)
    
    # Fields for group stage matches
    group = Column(String, nullable=True)  # A, B, C, D... (only for group stage)
    
    # Fields for knockout matches
    match_number = Column(Integer, nullable=True)  # only for knockout matches
    home_team_source = Column(String, nullable=True)  # "A1", "winner_of_match_1" (only for knockout)
    away_team_source = Column(String, nullable=True)  # "B2", "winner_of_match_2" (only for knockout)
    affects_matches = Column(String, nullable=True)  # JSON string of match IDs that this affects (only for knockout)
    
    # Relationships
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    
    @property
    def is_group_stage(self):
        """Check if this is a group stage match"""
        return self.stage == "group"
    
    @property
    def is_knockout(self):
        """Check if this is a knockout match"""
        return self.stage in ["round32", "round16", "quarter", "semi", "final"]
    
    @property
    def is_round32(self):
        """Check if this is a round32 match"""
        return self.stage == "round32"
    
    @property
    def is_round16(self):
        """Check if this is a round16 match"""
        return self.stage == "round16"
    
    @property
    def is_quarter(self):
        """Check if this is a quarter final match"""
        return self.stage == "quarter"
    
    @property
    def is_semi(self):
        """Check if this is a semi final match"""
        return self.stage == "semi"
    
    @property
    def is_final(self):
        """Check if this is a final match"""
        return self.stage == "final"