from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import Match
from .team import Team

class GroupStageMatch(Match):
    __tablename__ = "group_stage_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, default="group")
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    group = Column(String, nullable=False)  # A, B, C, D...
    
    # Relationships - זה אומר איך לגשת לקבוצות
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    
    __mapper_args__ = {
        'polymorphic_identity': 'group_stage_match',
    }

class KnockoutMatch(Match):
    __tablename__ = "knockout_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # round16, quarter, semi, final
    match_number = Column(Integer, nullable=False)
    home_team_source = Column(String, nullable=False)  # "A1", "winner_of_match_1"
    away_team_source = Column(String, nullable=False)  # "B2", "winner_of_match_2"
    home_team_id = Column(Integer, ForeignKey("teams.id"))  # הקבוצה האמיתית
    away_team_id = Column(Integer, ForeignKey("teams.id"))  # הקבוצה האמיתית
    affects_matches = Column(String)  # JSON string of match IDs that this affects
    
    # Relationships
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    
    __mapper_args__ = {
        'polymorphic_identity': 'knockout_match',
    }
