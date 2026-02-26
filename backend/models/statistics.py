from sqlalchemy import Column, Integer
from .base import Base


class ThirdPlaceGroupCounts(Base):
    """
    Singleton table: how many users picked each group to qualify from 3rd place.
    Single row with 12 counters (groups A-L).
    Updated on every third place prediction create/update.
    """
    __tablename__ = "third_place_group_counts"

    id = Column(Integer, primary_key=True, index=True)

    group_a = Column(Integer, default=0, nullable=False)
    group_b = Column(Integer, default=0, nullable=False)
    group_c = Column(Integer, default=0, nullable=False)
    group_d = Column(Integer, default=0, nullable=False)
    group_e = Column(Integer, default=0, nullable=False)
    group_f = Column(Integer, default=0, nullable=False)
    group_g = Column(Integer, default=0, nullable=False)
    group_h = Column(Integer, default=0, nullable=False)
    group_i = Column(Integer, default=0, nullable=False)
    group_j = Column(Integer, default=0, nullable=False)
    group_k = Column(Integer, default=0, nullable=False)
    group_l = Column(Integer, default=0, nullable=False)
