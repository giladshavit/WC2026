from sqlalchemy import Column, Integer, String
from .base import Base

class ThirdPlaceCombination(Base):
    __tablename__ = 'third_place_combinations'
    
    id = Column(Integer, primary_key=True)
    match_1A = Column(String(10), nullable=False)   # 3A (third-place team playing against 1A)
    match_1B = Column(String(10), nullable=False)   # 3B (third-place team playing against 1B)
    match_1D = Column(String(10), nullable=False)   # 3C (third-place team playing against 1D)
    match_1E = Column(String(10), nullable=False)   # 3D (third-place team playing against 1E)
    match_1G = Column(String(10), nullable=False)   # 3E (third-place team playing against 1G)
    match_1I = Column(String(10), nullable=False)   # 3F (third-place team playing against 1I)
    match_1K = Column(String(10), nullable=False)   # 3G (third-place team playing against 1K)
    match_1L = Column(String(10), nullable=False)   # 3H (third-place team playing against 1L)
    hash_key = Column(String(20), nullable=False, unique=True)  # Short hash key (e.g., ABCDEFGH)
    
    def __repr__(self):
        return f"<ThirdPlaceCombination(id={self.id}, hash_key='{self.hash_key}')>"
    
    @staticmethod
    def create_hash_key(teams):
        """Create a short hash_key by sorting teams alphabetically"""
        # Extract only the letter from the team (3A -> A)
        letters = [team[1] for team in sorted(teams)]
        return ''.join(letters)