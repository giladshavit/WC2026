from sqlalchemy import Column, String, Integer
from .base import Base

class TournamentConfig(Base):
    __tablename__ = 'tournament_config'
    
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(100), nullable=False)
    
    @staticmethod
    def get_config(db, key: str, default: str = None):
        """Get config value by key"""
        config = db.query(TournamentConfig).filter(TournamentConfig.key == key).first()
        return config.value if config else default
    
    @staticmethod
    def set_config(db, key: str, value: str):
        """Set config value by key"""
        config = db.query(TournamentConfig).filter(TournamentConfig.key == key).first()
        
        if config:
            config.value = value
        else:
            config = TournamentConfig(key=key, value=value)
            db.add(config)
        
        db.commit()
