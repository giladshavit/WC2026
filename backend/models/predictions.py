from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .team import Team
from .base import Base

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
    first_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    second_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    third_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fourth_place = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    group = relationship("Group")
    first_place_team = relationship("Team", foreign_keys=[first_place])
    second_place_team = relationship("Team", foreign_keys=[second_place])
    third_place_team = relationship("Team", foreign_keys=[third_place])
    fourth_place_team = relationship("Team", foreign_keys=[fourth_place])

class ThirdPlacePrediction(Base):
    __tablename__ = "third_place_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    first_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    second_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    third_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fourth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    fifth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    sixth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    seventh_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    eighth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    first_team = relationship("Team", foreign_keys=[first_team_qualifying])
    second_team = relationship("Team", foreign_keys=[second_team_qualifying])
    third_team = relationship("Team", foreign_keys=[third_team_qualifying])
    fourth_team = relationship("Team", foreign_keys=[fourth_team_qualifying])
    fifth_team = relationship("Team", foreign_keys=[fifth_team_qualifying])
    sixth_team = relationship("Team", foreign_keys=[sixth_team_qualifying])
    seventh_team = relationship("Team", foreign_keys=[seventh_team_qualifying])
    eighth_team = relationship("Team", foreign_keys=[eighth_team_qualifying])

class KnockoutStagePrediction(Base):
    __tablename__ = "knockout_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    knockout_result_id = Column(Integer, ForeignKey("knockout_stage_results.id"), nullable=False)  # קישור לתוצאה
    template_match_id = Column(Integer, ForeignKey("matches_template.id"), nullable=False)  # קישור לטמפלייט (למסלול)
    team1_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # קבוצה ראשונה
    team2_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # קבוצה שנייה
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    knockout_result = relationship("KnockoutStageResult")  # קישור לתוצאה
    # template_match = relationship("MatchTemplate", foreign_keys=[template_match_id])  # קישור לטמפלייט - זמנית מושבת
    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])
    winner_team = relationship("Team", foreign_keys=[winner_team_id])