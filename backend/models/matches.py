from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from .team import Team
from .base import Base

class MatchStatus(Enum):
    """Match status enumeration"""
    SCHEDULED = "scheduled"           # נקבע - עד תחילת המשחק
    LIVE_EDITABLE = "live_editable"   # live שניתן לערוך (עד שעה מתחילת המשחק)
    LIVE_LOCKED = "live_locked"       # live שלא ניתן לערוך (משעה מתחילת המשחק)
    FINISHED = "finished"             # סיום

class Match(Base):
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # "group", "round32", "round16", "quarter", "semi", "final"
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # nullable for knockout matches
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # nullable for knockout matches
    status = Column(String, default=MatchStatus.SCHEDULED.value)  # scheduled, live_editable, live_locked, finished
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
    
    @property
    def is_editable(self) -> bool:
        """Check if match is editable - includes real-time validation"""
        # First check: status-based
        if self.status not in [MatchStatus.SCHEDULED.value, MatchStatus.LIVE_EDITABLE.value]:
            return False
            
        # Second check: real-time validation (covers the edge case)
        current_time = datetime.utcnow()
        time_since_match_start = (current_time - self.date).total_seconds() / 3600
        
        if time_since_match_start > 1.0:  # More than 1 hour since match start
            return False
            
        return True