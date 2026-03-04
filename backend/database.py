import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use DATABASE_URL for PostgreSQL (bulk scoring); fallback to SQLite for dev
_db_dir = os.path.dirname(os.path.abspath(__file__))
_default_sqlite = f"sqlite:///{os.path.join(_db_dir, 'world_cup_predictions.db')}"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)

_connect_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=True)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
