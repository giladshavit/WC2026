"""
Migration: Add per-question status columns to bonus_predictions table.
Run once on dev DB.
Supports both SQLite and PostgreSQL. Safe to re-run.
"""
import os
import sys

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import create_engine, text

# Use same DATABASE_URL as main app
_db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_default_sqlite = f"sqlite:///{os.path.join(_db_dir, 'world_cup_predictions.db')}"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)


def column_exists(conn, table: str, column: str, dialect: str) -> bool:
    """Check if a column exists in a table."""
    if dialect == "sqlite":
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        columns = [row[1] for row in result.fetchall()]
        return column in columns
    else:
        result = conn.execute(
            text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = :table AND column_name = :column
            """),
            {"table": table, "column": column},
        )
        return result.fetchone() is not None


def add_column_if_not_exists(conn, table: str, column: str, definition: str, dialect: str) -> bool:
    """Add column if it doesn't exist. Returns True if added."""
    if column_exists(conn, table, column, dialect):
        return False
    if dialect == "sqlite":
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
    else:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"))
    return True


NEW_COLUMNS = [
    ("q_g1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g3_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g4_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g5_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k3_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_t1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_t2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("bonus_score", "INTEGER NOT NULL DEFAULT 0"),
]


def run_migration():
    """Run the migration"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    dialect = "postgresql" if "postgresql" in SQLALCHEMY_DATABASE_URL else "sqlite"
    print(f"Using {dialect}")

    try:
        with engine.connect() as conn:
            added = 0
            for col_name, col_def in NEW_COLUMNS:
                if add_column_if_not_exists(conn, "bonus_predictions", col_name, col_def, dialect):
                    print(f"Added: {col_name}")
                    added += 1
                else:
                    print(f"Skipped {col_name}: already exists")

            conn.commit()

        if added > 0:
            print(f"✅ Successfully applied {added} change(s)!")
        else:
            print("✅ All changes already applied. No changes needed.")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
