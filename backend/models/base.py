from datetime import datetime
from typing import List, Optional
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Match(Base):
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="scheduled")  # scheduled, live, finished
    date = Column(DateTime, nullable=False)
    
    __mapper_args__ = {
        'polymorphic_identity': 'match',
        'polymorphic_on': 'type'
    }

class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __mapper_args__ = {
        'polymorphic_identity': 'prediction',
        'polymorphic_on': 'type'
    }
