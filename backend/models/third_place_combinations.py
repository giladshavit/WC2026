from sqlalchemy import Column, Integer, String, Text
from .base import Base

class ThirdPlaceCombination(Base):
    __tablename__ = 'third_place_combinations_new'
    
    id = Column(Integer, primary_key=True)
    combination = Column(Text, nullable=False)  # Full combination string
    group_a_3rd = Column(String(10), nullable=True)
    group_b_3rd = Column(String(10), nullable=True)
    group_c_3rd = Column(String(10), nullable=True)
    group_d_3rd = Column(String(10), nullable=True)
    group_e_3rd = Column(String(10), nullable=True)
    group_f_3rd = Column(String(10), nullable=True)
    group_g_3rd = Column(String(10), nullable=True)
    group_h_3rd = Column(String(10), nullable=True)
    hash_key = Column(String(100), nullable=False, unique=True)  # Sorted combination for easy lookup
    
    def __repr__(self):
        return f"<ThirdPlaceCombination(id={self.id}, combination='{self.combination}')>"
