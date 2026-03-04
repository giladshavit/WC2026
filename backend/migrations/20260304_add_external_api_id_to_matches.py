"""
Add external_api_id column to matches table.
Stores football-data.org match ID for sync with external API.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

from database import engine


def add_external_api_id() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        columns = [col["name"] for col in inspector.get_columns("matches")]
        if "external_api_id" in columns:
            print("external_api_id already exists on matches.")
            return

        conn.execute(
            text("ALTER TABLE matches ADD COLUMN external_api_id INTEGER")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_matches_external_api_id ON matches (external_api_id)")
        )
        print("Added external_api_id to matches.")


if __name__ == "__main__":
    add_external_api_id()
