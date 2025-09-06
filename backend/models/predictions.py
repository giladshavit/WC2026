from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.team import Team
from models.base import Base

class MatchPrediction(Base):
    __tablename__ = "match_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)  # עכשיו רק טבלה אחת!
    home_score = Column(Integer, nullable=False)
    away_score = Column(Integer, nullable=False)
    predicted_winner = Column(Integer, ForeignKey("teams.id"), nullable=True)  # NULL for draw
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    match = relationship("Match")  # עכשיו יש לנו relationship ישיר!
    winner_team = relationship("Team", foreign_keys=[predicted_winner])

class GroupStagePrediction(Base):
    __tablename__ = "group_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    positions = Column(String, nullable=False)  # JSON string of team IDs positions: [team_id_1, team_id_2, team_id_3, team_id_4]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    group = relationship("Group")

class ThirdPlacePrediction(Base):
    __tablename__ = "third_place_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stage = Column(String, default="third_place")
    advancing_team_ids = Column(String, nullable=False)  # JSON string of 8 team IDs that will advance
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")

class KnockoutStagePrediction(Base):
    __tablename__ = "knockout_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stage = Column(String, nullable=False)  # round16, quarter, semi, final
    knockout_match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)  # עכשיו משתמש בטבלת matches המאוחדת
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    knockout_match = relationship("Match")  # עכשיו משתמש במודל Match המאוחד
    winner_team = relationship("Team")