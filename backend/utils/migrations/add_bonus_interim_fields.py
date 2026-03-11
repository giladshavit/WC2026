"""
Migration: Add interim (live/current) value columns to bonus_results table.
Display-only, no scoring. Safe to re-run.
Supports both SQLite and PostgreSQL.
"""
import os
import sys

_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from sqlalchemy import create_engine, text

_db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_default_sqlite = f"sqlite:///{os.path.join(_db_dir, 'world_cup_predictions.db')}"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)

INTERIM_COLUMNS = [
    "g1_interim", "g2_interim", "g3_interim", "g4_interim", "g5_interim",
    "k1_interim", "k2_interim", "k3_interim", "t1_interim", "t2_interim",
]


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


def run():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    dialect = "postgresql" if "postgresql" in SQLALCHEMY_DATABASE_URL else "sqlite"
    print(f"Using {dialect}")

    try:
        with engine.connect() as conn:
            added = 0
            for col_name in INTERIM_COLUMNS:
                if add_column_if_not_exists(conn, "bonus_results", col_name, "TEXT", dialect):
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
    run()
