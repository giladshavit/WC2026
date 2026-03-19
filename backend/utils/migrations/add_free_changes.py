#!/usr/bin/env python3
"""
One-time migration: Add free_changes and free_changes_used to user_scores.

- Adds free_changes INTEGER NOT NULL DEFAULT 0
- Adds free_changes_used INTEGER NOT NULL DEFAULT 0

Idempotent: safe to run multiple times. Skips columns that already exist.
"""
import os
import sys

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import create_engine, text

# Use same DATABASE_URL as main app (database.py)
_db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_default_sqlite = f"sqlite:///{os.path.join(_db_dir, 'world_cup_predictions.db')}"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)


def column_exists(conn, table: str, column: str) -> bool:
    """Check if a column exists in user_scores (SQLite PRAGMA)."""
    result = conn.execute(text(f"PRAGMA table_info({table})"))
    columns = [row[1] for row in result.fetchall()]
    return column in columns


def run_migration():
    """Run the migration"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    dialect = "postgresql" if "postgresql" in SQLALCHEMY_DATABASE_URL else "sqlite"
    print(f"Using {dialect}")

    try:
        with engine.connect() as conn:
            added = 0

            if not column_exists(conn, "user_scores", "free_changes"):
                if dialect == "sqlite":
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN free_changes INTEGER NOT NULL DEFAULT 0"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS free_changes INTEGER NOT NULL DEFAULT 0"
                    ))
                added += 1
                print("Added free_changes to user_scores")

            if not column_exists(conn, "user_scores", "free_changes_used"):
                if dialect == "sqlite":
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN free_changes_used INTEGER NOT NULL DEFAULT 0"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS free_changes_used INTEGER NOT NULL DEFAULT 0"
                    ))
                added += 1
                print("Added free_changes_used to user_scores")

            conn.commit()

        if added > 0:
            print(f"✅ Successfully applied {added} change(s)!")
        else:
            print("✅ All columns already exist. No changes needed.")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
