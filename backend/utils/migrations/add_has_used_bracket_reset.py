"""
Migration: Add has_used_bracket_reset column to user_scores.
Run once: python backend/utils/migrations/add_has_used_bracket_reset.py
  # or from backend: python -m utils.migrations.add_has_used_bracket_reset
"""
import sys
import os

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from database import SessionLocal


def main():
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE user_scores ADD COLUMN has_used_bracket_reset BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        db.commit()
        print("✅ Successfully added has_used_bracket_reset column to user_scores.")
    except OperationalError as e:
        db.rollback()
        if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
            print("✅ Column has_used_bracket_reset already exists. No changes needed.")
        else:
            print(f"❌ Migration failed: {e}")
            raise
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
