from sqlalchemy import Column, String, Integer
from .base import Base


class GroupTemplate(Base):
    __tablename__ = "group_template"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(1), nullable=False, unique=True)
    first_place_match_id = Column(Integer, nullable=False)
    second_place_match_id = Column(Integer, nullable=False)
    first_place_team_slot = Column(Integer, nullable=False, default=1)  # 1 or 2 - which team slot in the knockout match
    second_place_team_slot = Column(Integer, nullable=False, default=1)  # 1 or 2 - which team slot in the knockout match

    def __repr__(self):
        return f"<GroupTemplate(group_name='{self.group_name}', first_place_match_id={self.first_place_match_id}, second_place_match_id={self.second_place_match_id})>"
