"""
Migration: Add score_mode column to leagues table.
Run once: python backend/utils/migrations/add_league_score_mode.py
"""
import sys
import os
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from database import SessionLocal
from sqlalchemy import text

def run():
    db = SessionLocal()
    try:
        # Check if column already exists
        result = db.execute(text("PRAGMA table_info(leagues)")).fetchall()
        columns = [row[1] for row in result]
        if "score_mode" in columns:
            print("Column score_mode already exists. Skipping.")
            return

        db.execute(text("ALTER TABLE leagues ADD COLUMN score_mode VARCHAR(10) NOT NULL DEFAULT 'all'"))
        db.commit()
        print("Migration complete: score_mode added to leagues.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
