"""
Migration: Fix draw predictions — set predicted_winner = 0 where home_score = away_score and predicted_winner IS NULL.
"""
import sys
import os

_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import text


def upgrade(db):
    result = db.execute(text("""
        UPDATE match_predictions
        SET predicted_winner = 0
        WHERE home_score IS NOT NULL
          AND away_score IS NOT NULL
          AND home_score = away_score
          AND predicted_winner IS NULL
    """))
    db.commit()
    count = result.rowcount if hasattr(result, 'rowcount') else '?'
    print(f"Migration complete: fixed {count} draw predictions (predicted_winner=NULL -> 0)")


if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        upgrade(db)
    finally:
        db.close()
