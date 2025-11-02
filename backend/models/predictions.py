from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from .team import Team
from .base import Base

class MatchPrediction(Base):
    __tablename__ = "match_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)  # Single matches table
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    predicted_winner = Column(Integer, ForeignKey("teams.id"), nullable=True)  # NULL for draw
    points = Column(Integer, default=0, nullable=False)  # Points awarded for this prediction
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    match = relationship("Match")  # Direct relationship
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
    points = Column(Integer, default=0, nullable=False)  # Points awarded for this group prediction
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    
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
    changed_groups = Column(String(50), nullable=True)  # JSON string like "A,B,C" for groups with changed 3rd place
    points = Column(Integer, default=0, nullable=False)  # Points awarded for this third place prediction
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    
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
    knockout_result_id = Column(Integer, ForeignKey("knockout_stage_results.id"), nullable=False)  # Link to result
    template_match_id = Column(Integer, ForeignKey("matches_template.id"), nullable=False)  # Link to template (path)
    stage = Column(String(20), nullable=False)  # round32, round16, quarter, semi, final, third_place
    team1_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # First team
    team2_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Second team
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    status = Column(String(20), nullable=True, default="gray")  # green/yellow/red/gray
    points = Column(Integer, default=0, nullable=False)  # Points earned for this prediction
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    knockout_result = relationship("KnockoutStageResult")  # Link to result
    # template_match = relationship("MatchTemplate", foreign_keys=[template_match_id])  # Link to template - temporarily disabled
    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])
    winner_team = relationship("Team", foreign_keys=[winner_team_id])

class KnockoutStagePredictionDraft(Base):
    __tablename__ = "knockout_stage_predictions_draft"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    knockout_result_id = Column(Integer, ForeignKey("knockout_stage_results.id"), nullable=False)  # Link to result
    template_match_id = Column(Integer, ForeignKey("matches_template.id"), nullable=False)  # Link to template (path)
    stage = Column(String(20), nullable=False)  # round32, round16, quarter, semi, final, third_place
    team1_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # First team
    team2_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Second team
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    status = Column(String(20), nullable=True, default="gray")  # green/yellow/red/gray
    knockout_pred_id = Column(Integer, ForeignKey("knockout_stage_predictions.id"), nullable=True)  # Link to original prediction
    
    # Relationships
    user = relationship("User")
    knockout_result = relationship("KnockoutStageResult")
    knockout_pred = relationship("KnockoutStagePrediction", foreign_keys=[knockout_pred_id])
    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])
    winner_team = relationship("Team", foreign_keys=[winner_team_id])