from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import Prediction
from .team import Team

class MatchPrediction(Prediction):
    __tablename__ = "match_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, nullable=False)
    home_score = Column(Integer, nullable=False)
    away_score = Column(Integer, nullable=False)
    
    __mapper_args__ = {
        'polymorphic_identity': 'match_prediction',
    }

class GroupStagePrediction(Prediction):
    __tablename__ = "group_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, default="group")
    group = Column(String, nullable=False)  # A, B, C, D...
    positions = Column(String, nullable=False)  # JSON string of team IDs positions
    
    __mapper_args__ = {
        'polymorphic_identity': 'group_stage_prediction',
    }

class ThirdPlacePrediction(Prediction):
    __tablename__ = "third_place_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, default="third_place")
    advancing_team_ids = Column(String, nullable=False)  # JSON string of 8 team IDs that will advance
    
    __mapper_args__ = {
        'polymorphic_identity': 'third_place_prediction',
    }

class KnockoutStagePrediction(Prediction):
    __tablename__ = "knockout_stage_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # round16, quarter, semi, final
    knockout_match_id = Column(Integer, nullable=False)
    winner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    # Relationship
    winner_team = relationship("Team")
    
    __mapper_args__ = {
        'polymorphic_identity': 'knockout_stage_prediction',
    }
