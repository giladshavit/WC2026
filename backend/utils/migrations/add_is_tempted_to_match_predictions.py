"""
Migration: add is_tempted to match_predictions
Adds a boolean column is_tempted (default False) to match_predictions table.
Safe to run multiple times (checks if column exists first).
Supports both SQLite and PostgreSQL.
"""
import os
import sys

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import text


def column_exists_sqlite(db, table: str, column: str) -> bool:
    """Check if a column exists in SQLite."""
    result = db.execute(text(f"PRAGMA table_info({table})"))
    columns = [row[1] for row in result.fetchall()]
    return column in columns


def upgrade(db):
    dialect = db.get_bind().dialect.name

    if dialect == "sqlite":
        if column_exists_sqlite(db, "match_predictions", "is_tempted"):
            print("Column is_tempted already exists. No changes needed.")
            return
        db.execute(text(
            "ALTER TABLE match_predictions ADD COLUMN is_tempted INTEGER NOT NULL DEFAULT 0"
        ))
    else:
        # PostgreSQL
        db.execute(text("""
            ALTER TABLE match_predictions
            ADD COLUMN IF NOT EXISTS is_tempted BOOLEAN NOT NULL DEFAULT FALSE;
        """))
    db.commit()
    print("Migration complete: is_tempted added to match_predictions")


if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        upgrade(db)
    finally:
        db.close()
