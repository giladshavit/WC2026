#!/usr/bin/env python3
"""
Migration: Add bonus_predictions table and bonus_score/bonus_penalty to user_scores.

- Creates bonus_predictions table with all columns
- Adds bonus_score (INTEGER DEFAULT 0) to user_scores
- Adds bonus_penalty (INTEGER DEFAULT 0) to user_scores

Supports both SQLite (dev) and PostgreSQL (prod). Safe to re-run.
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


def table_exists(conn, table: str, dialect: str) -> bool:
    """Check if a table exists."""
    if dialect == "sqlite":
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
            {"t": table},
        )
        return result.fetchone() is not None
    else:
        result = conn.execute(
            text("""
                SELECT 1 FROM information_schema.tables
                WHERE table_name = :table
            """),
            {"table": table},
        )
        return result.fetchone() is not None


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


def run_migration():
    """Run the migration"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    dialect = "postgresql" if "postgresql" in SQLALCHEMY_DATABASE_URL else "sqlite"
    print(f"Using {dialect}")

    try:
        with engine.connect() as conn:
            added = 0

            # 1. Create bonus_predictions table if not exists
            if not table_exists(conn, "bonus_predictions", dialect):
                if dialect == "sqlite":
                    conn.execute(text("""
                        CREATE TABLE bonus_predictions (
                            id INTEGER NOT NULL PRIMARY KEY,
                            user_id INTEGER NOT NULL UNIQUE,
                            g1_total_goals_group VARCHAR,
                            g2_top_group_id INTEGER,
                            g3_top_team_id INTEGER,
                            g4_perfect_teams VARCHAR,
                            g5_clean_sheet_teams VARCHAR,
                            k1_total_goals_knockout VARCHAR,
                            k2_penalty_shootouts VARCHAR,
                            k3_third_place_quarters VARCHAR,
                            t1_total_goals_tournament VARCHAR,
                            t2_scoreless_draws VARCHAR,
                            points INTEGER DEFAULT 0 NOT NULL,
                            penalty_points INTEGER DEFAULT 0 NOT NULL,
                            changes_count INTEGER DEFAULT 0 NOT NULL,
                            groups_is_editable BOOLEAN DEFAULT 1 NOT NULL,
                            knockout_is_editable BOOLEAN DEFAULT 1 NOT NULL,
                            tournament_is_editable BOOLEAN DEFAULT 1 NOT NULL,
                            groups_status VARCHAR DEFAULT 'pending' NOT NULL,
                            knockout_status VARCHAR DEFAULT 'pending' NOT NULL,
                            tournament_status VARCHAR DEFAULT 'pending' NOT NULL,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(user_id) REFERENCES users (id),
                            FOREIGN KEY(g2_top_group_id) REFERENCES groups (id),
                            FOREIGN KEY(g3_top_team_id) REFERENCES teams (id)
                        )
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS bonus_predictions (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                            g1_total_goals_group VARCHAR,
                            g2_top_group_id INTEGER REFERENCES groups(id),
                            g3_top_team_id INTEGER REFERENCES teams(id),
                            g4_perfect_teams VARCHAR,
                            g5_clean_sheet_teams VARCHAR,
                            k1_total_goals_knockout VARCHAR,
                            k2_penalty_shootouts VARCHAR,
                            k3_third_place_quarters VARCHAR,
                            t1_total_goals_tournament VARCHAR,
                            t2_scoreless_draws VARCHAR,
                            points INTEGER DEFAULT 0 NOT NULL,
                            penalty_points INTEGER DEFAULT 0 NOT NULL,
                            changes_count INTEGER DEFAULT 0 NOT NULL,
                            groups_is_editable BOOLEAN DEFAULT TRUE NOT NULL,
                            knockout_is_editable BOOLEAN DEFAULT TRUE NOT NULL,
                            tournament_is_editable BOOLEAN DEFAULT TRUE NOT NULL,
                            groups_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                            knockout_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                            tournament_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                            created_at TIMESTAMP,
                            updated_at TIMESTAMP
                        )
                    """))
                added += 1
                print("Created bonus_predictions table")

            # 2. Add bonus_score to user_scores
            if not column_exists(conn, "user_scores", "bonus_score", dialect):
                if dialect == "sqlite":
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN bonus_score INTEGER DEFAULT 0 NOT NULL"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS bonus_score INTEGER DEFAULT 0 NOT NULL"
                    ))
                added += 1
                print("Added bonus_score to user_scores")

            # 3. Add bonus_penalty to user_scores
            if not column_exists(conn, "user_scores", "bonus_penalty", dialect):
                if dialect == "sqlite":
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN bonus_penalty INTEGER DEFAULT 0 NOT NULL"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS bonus_penalty INTEGER DEFAULT 0 NOT NULL"
                    ))
                added += 1
                print("Added bonus_penalty to user_scores")

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
