from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.team import Team
from models.base import Base

class MatchPrediction(Base):
    __tablename__ = "match_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    match_id = Column(Integer, nullable=False)
    home_score = Column(Integer, nullable=False)
    away_score = Column(Integer, nullable=False)
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GroupStagePrediction(Base):
    __tablename__ = "group_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    stage = Column(String, default="group")
    group = Column(String, nullable=False)  # A, B, C, D...
    positions = Column(String, nullable=False)  # JSON string of team IDs positions
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ThirdPlacePrediction(Base):
    __tablename__ = "third_place_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    stage = Column(String, default="third_place")
    advancing_team_ids = Column(String, nullable=False)  # JSON string of 8 team IDs that will advance
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnockoutStagePrediction(Base):
    __tablename__ = "knockout_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    stage = Column(String, nullable=False)  # round16, quarter, semi, final
    knockout_match_id = Column(Integer, nullable=False)
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    winner_team = relationship("Team")
