"""
Add knockout_result_id column to matches_template.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

from database import engine


def add_knockout_result_id() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        columns = [col["name"] for col in inspector.get_columns("matches_template")]
        if "knockout_result_id" in columns:
            print("knockout_result_id already exists on matches_template.")
            return

        conn.execute(
            text(
                "ALTER TABLE matches_template "
                "ADD COLUMN knockout_result_id INTEGER "
                "REFERENCES knockout_stage_results(id)"
            )
        )
        print("Added knockout_result_id to matches_template.")


if __name__ == "__main__":
    add_knockout_result_id()
