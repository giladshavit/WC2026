from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class League(Base):
    __tablename__ = "leagues"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String, nullable=True)
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("LeagueMembership", back_populates="league", cascade="all, delete-orphan")

class LeagueMembership(Base):
    __tablename__ = "league_memberships"
    
    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, ForeignKey('leagues.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    league = relationship("League", back_populates="members")
    user = relationship("User")
    
    __table_args__ = (UniqueConstraint('league_id', 'user_id', name='_league_user_uc'),)
