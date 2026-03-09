"""
Migration: add status column to group_stage_predictions and third_place_predictions.
Sets status = 'settled' for predictions that already have a result, 'pending' otherwise.
Run once. Safe to re-run (checks if column exists first).
Supports both SQLite and PostgreSQL.
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
        # PostgreSQL
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
        # PostgreSQL: use ADD COLUMN IF NOT EXISTS
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"))
    return True


def run_migration():
    """Run the migration"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    dialect = "postgresql" if "postgresql" in SQLALCHEMY_DATABASE_URL else "sqlite"
    print(f"Using {dialect}")

    if dialect == "sqlite":
        col_def_gsp = "VARCHAR DEFAULT 'pending' NOT NULL"
        col_def_tpp = "VARCHAR DEFAULT 'pending' NOT NULL"
    else:
        col_def_gsp = "VARCHAR(50) DEFAULT 'pending' NOT NULL"
        col_def_tpp = "VARCHAR(50) DEFAULT 'pending' NOT NULL"

    try:
        with engine.connect() as conn:
            added = 0

            # 1. Add status to group_stage_predictions
            if add_column_if_not_exists(
                conn, "group_stage_predictions", "status", col_def_gsp, dialect
            ):
                added += 1

            # 2. Add status to third_place_predictions
            if add_column_if_not_exists(
                conn, "third_place_predictions", "status", col_def_tpp, dialect
            ):
                added += 1

            # 3. Set status='settled' for group_stage_predictions where group_stage_results exists
            if dialect == "sqlite":
                conn.execute(text("""
                    UPDATE group_stage_predictions
                    SET status = 'settled'
                    WHERE group_id IN (SELECT group_id FROM group_stage_results)
                """))
            else:
                conn.execute(text("""
                    UPDATE group_stage_predictions gsp
                    SET status = 'settled'
                    FROM group_stage_results gsr
                    WHERE gsp.group_id = gsr.group_id
                """))

            # 4. Set status='settled' for all third_place_predictions if third_place_results exists
            if dialect == "sqlite":
                conn.execute(text("""
                    UPDATE third_place_predictions
                    SET status = 'settled'
                    WHERE EXISTS (SELECT 1 FROM third_place_results)
                """))
            else:
                conn.execute(text("""
                    UPDATE third_place_predictions
                    SET status = 'settled'
                    WHERE EXISTS (SELECT 1 FROM third_place_results)
                """))

            conn.commit()

        if added > 0:
            print(f"✅ Successfully added {added} column(s)!")
        else:
            print("✅ All columns already exist. No changes needed.")
        print("✅ Status values updated for predictions with existing results.")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
