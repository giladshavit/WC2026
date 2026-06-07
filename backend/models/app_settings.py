from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Session

from .base import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(255), nullable=False)

    @staticmethod
    def get_bool(db: Session, key: str, default: bool = False) -> bool:
        setting = db.query(AppSettings).filter(AppSettings.key == key).first()
        if not setting:
            return default
        return setting.value.lower() in ("true", "1", "yes")
