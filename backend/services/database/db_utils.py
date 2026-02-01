"""
DBUtils: Database session utility operations.
Handles commit, flush, rollback, and refresh.
"""
from sqlalchemy.orm import Session


class DBUtils:
    """Database utility operations — session management only."""

    @staticmethod
    def commit(db: Session) -> None:
        """Commit all pending changes to database."""
        db.commit()

    @staticmethod
    def flush(db: Session) -> None:
        """Flush pending changes without committing (gets IDs)."""
        db.flush()

    @staticmethod
    def rollback(db: Session) -> None:
        """Rollback all pending changes."""
        db.rollback()

    @staticmethod
    def refresh(db: Session, obj) -> None:
        """Refresh an object from database."""
        db.refresh(obj)
