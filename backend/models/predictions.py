from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from services.predictions.enums import BonusSectionStatus

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
    status = Column(String, nullable=True)
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    is_tempted = Column(Boolean, default=False, nullable=False)
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
    first_place = Column(Integer, ForeignKey("teams.id"), nullable=True)
    second_place = Column(Integer, ForeignKey("teams.id"), nullable=True)
    third_place = Column(Integer, ForeignKey("teams.id"), nullable=True)
    fourth_place = Column(Integer, ForeignKey("teams.id"), nullable=True)
    points = Column(Integer, default=0, nullable=False)  # Points awarded for this group prediction
    penalty_points = Column(Integer, default=0, nullable=False)
    changes_count = Column(Integer, default=0, nullable=False)
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited

    # How many positions (0-4) user got right. None = not yet judged
    correct_positions_count = Column(Integer, nullable=True, default=None)
    # Per-position correctness for fast querying
    first_correct = Column(Boolean, nullable=True, default=None)
    second_correct = Column(Boolean, nullable=True, default=None)
    third_correct = Column(Boolean, nullable=True, default=None)
    fourth_correct = Column(Boolean, nullable=True, default=None)
    status = Column(String, nullable=False, default="pending")
    
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
    first_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    second_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    third_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    fourth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    fifth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    sixth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    seventh_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    eighth_team_qualifying = Column(Integer, ForeignKey("teams.id"), nullable=True)
    changed_groups = Column(String(50), nullable=True)  # JSON string like "A,B,C" for groups with changed 3rd place
    points = Column(Integer, default=0, nullable=False)  # Points awarded for this third place prediction
    penalty_points = Column(Integer, default=0, nullable=False)
    changes_count = Column(Integer, default=0, nullable=False)
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited

    # How many groups (0-8) user got right. None = not yet judged
    correct_groups_count = Column(Integer, nullable=True, default=None)
    status = Column(String, nullable=False, default="pending")
    
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
    is_team1_valid = Column(Boolean, default=True, nullable=False)  # Whether team1 is valid (can reach this match)
    is_team2_valid = Column(Boolean, default=True, nullable=False)  # Whether team2 is valid (can reach this match)
    points = Column(Integer, default=0, nullable=False)  # Points earned for this prediction
    penalty_points = Column(Integer, default=0, nullable=False)
    changes_count = Column(Integer, default=0, nullable=False)
    is_editable = Column(Boolean, default=True, nullable=False)  # Whether this prediction can be edited
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    knockout_result = relationship("KnockoutStageResult")  # Link to result
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
    current_winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    status = Column(String(20), nullable=True, default="gray")  # green/yellow/red/gray
    is_team1_valid = Column(Boolean, default=True, nullable=False)  # Whether team1 is valid (can reach this match)
    is_team2_valid = Column(Boolean, default=True, nullable=False)  # Whether team2 is valid (can reach this match)
    knockout_pred_id = Column(Integer, ForeignKey("knockout_stage_predictions.id"), nullable=True)  # Link to original prediction

    # Modified flags: True = user explicitly changed this field in the draft
    is_team1_modified = Column(Boolean, default=False, nullable=False)
    is_team2_modified = Column(Boolean, default=False, nullable=False)
    is_winner_modified = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User")
    knockout_result = relationship("KnockoutStageResult")
    knockout_pred = relationship("KnockoutStagePrediction", foreign_keys=[knockout_pred_id])
    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])
    winner_team = relationship("Team", foreign_keys=[winner_team_id])
    current_winner_team = relationship("Team", foreign_keys=[current_winner_team_id])


class BonusPrediction(Base):
    __tablename__ = "bonus_predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Group Stage answers
    g1_total_goals_group = Column(String, nullable=True)  # G1GoalsRange value
    g2_top_group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    g3_top_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    g4_perfect_teams = Column(String, nullable=True)  # G4PerfectTeams value
    g5_clean_sheet_teams = Column(String, nullable=True)  # G5CleanSheetTeams value
    g6_scoreless_draws_group = Column(String, nullable=True)  # G6ScorelessRange value (moved from t2)

    # Knockout answers
    k1_total_goals_knockout = Column(String, nullable=True)  # K1GoalsRange value
    k2_penalty_shootouts = Column(String, nullable=True)  # K2ShootoutsRange value
    k3_third_place_quarters = Column(String, nullable=True)  # K3ThirdPlaceQuarters value

    # Tournament answers
    t1_total_goals_tournament = Column(String, nullable=True)  # T1GoalsRange value
    t2_champion_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Who wins WC
    t3_top_scorer = Column(String, nullable=True)  # Top scorer string value (e.g. "messi", "other")

    # Scoring & Meta
    points = Column(Integer, default=0, nullable=False)
    penalty_points = Column(Integer, default=0, nullable=False)
    changes_count = Column(Integer, default=0, nullable=False)

    # Editable flags per section
    groups_is_editable = Column(Boolean, default=True, nullable=False)
    knockout_is_editable = Column(Boolean, default=True, nullable=False)
    tournament_is_editable = Column(Boolean, default=True, nullable=False)

    # Status per section (BonusSectionStatus values) — controls editability lock
    groups_status = Column(String, default=BonusSectionStatus.PENDING.value, nullable=False)
    knockout_status = Column(String, default=BonusSectionStatus.PENDING.value, nullable=False)
    tournament_status = Column(String, default=BonusSectionStatus.PENDING.value, nullable=False)

    # Per-question scoring status (BonusQuestionStatus values)
    q_g1_status = Column(String, default="pending", nullable=False)
    q_g2_status = Column(String, default="pending", nullable=False)
    q_g3_status = Column(String, default="pending", nullable=False)
    q_g4_status = Column(String, default="pending", nullable=False)
    q_g5_status = Column(String, default="pending", nullable=False)
    q_g6_status = Column(String, default="pending", nullable=False)
    q_k1_status = Column(String, default="pending", nullable=False)
    q_k2_status = Column(String, default="pending", nullable=False)
    q_k3_status = Column(String, default="pending", nullable=False)
    q_t1_status = Column(String, default="pending", nullable=False)
    q_t2_status = Column(String, default="pending", nullable=False)
    q_t3_status = Column(String, default="pending", nullable=False)

    # Per-prediction total score tracking
    bonus_score = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    top_group = relationship("Group", foreign_keys=[g2_top_group_id])
    top_team = relationship("Team", foreign_keys=[g3_top_team_id])
    champion_team = relationship("Team", foreign_keys=[t2_champion_team_id])