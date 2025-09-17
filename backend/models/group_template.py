from sqlalchemy import Column, String, Integer
from .base import Base

class GroupTemplate(Base):
    __tablename__ = "group_template"
    
    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(1), nullable=False, unique=True)  # A, B, C, D...
    first_place_match_id = Column(Integer, nullable=False)  # Which match first place is assigned to
    second_place_match_id = Column(Integer, nullable=False)  # Which match second place is assigned to
    
    def __repr__(self):
        return f"<GroupTemplate(group_name='{self.group_name}', first_place_match_id={self.first_place_match_id}, second_place_match_id={self.second_place_match_id})>"
