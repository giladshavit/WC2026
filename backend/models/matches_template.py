from sqlalchemy import Column, String, Integer, DateTime
from .base import Base

class MatchTemplate(Base):
    __tablename__ = "matches_template"
    
    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String, nullable=False)  # "group", "round32", "round16", "quarter", "semi", "final", "third_place"
    team_1 = Column(String, nullable=False)  # A1, 2B, Winner_M73, Best_3rd_ABCDF, etc.
    team_2 = Column(String, nullable=False)  # A2, 1E, Winner_M74, etc.
    status = Column(String, default="scheduled")  # scheduled, live, finished
    date = Column(DateTime, nullable=False)
    group = Column(String, nullable=True)  # A, B, C, D... (only for group stage)
    winner_destination = Column(String, nullable=True)  # 90_1, 89_2, etc. (only for knockout)
    
    def __repr__(self):
        return f"<MatchTemplate(id={self.id}, stage='{self.stage}', {self.team_1} vs {self.team_2})>"
