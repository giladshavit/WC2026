"""
Migration: add indexes for standings queries performance.
Run once: python backend/utils/migrations/add_standings_indexes.py
  # or from backend: python -m utils.migrations.add_standings_indexes
"""
import sys
import os

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import text
from database import SessionLocal


def run():
    db = SessionLocal()
    try:
        statements = [
            "CREATE INDEX IF NOT EXISTS idx_user_scores_total ON user_scores(total_points DESC)",
            "CREATE INDEX IF NOT EXISTS idx_user_scores_matches ON user_scores(matches_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_user_scores_groups ON user_scores(groups_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_user_scores_knockout ON user_scores(knockout_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_user_scores_bonus ON user_scores(bonus_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_user_scores_penalty ON user_scores(penalty ASC)",
            "CREATE INDEX IF NOT EXISTS idx_league_membership_league ON league_memberships(league_id)",
        ]
        for stmt in statements:
            db.execute(text(stmt))
        db.commit()
        print("✅ Indexes created")
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
