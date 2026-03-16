"""
Add new bonus prediction and results fields.

This migration is idempotent: it checks for column existence before ALTER TABLE.
"""

import os
import sys

from sqlalchemy import inspect, text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine  # noqa: E402


def add_bonus_prediction_fields() -> None:
  with engine.begin() as conn:
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("bonus_predictions")]

    if "g6_scoreless_draws_group" not in columns:
      conn.execute(
        text("ALTER TABLE bonus_predictions ADD COLUMN g6_scoreless_draws_group VARCHAR")
      )

    if "t2_champion_team_id" not in columns:
      conn.execute(
        text(
          "ALTER TABLE bonus_predictions "
          "ADD COLUMN t2_champion_team_id INTEGER REFERENCES teams(id)"
        )
      )

    if "t3_top_scorer" not in columns:
      conn.execute(
        text("ALTER TABLE bonus_predictions ADD COLUMN t3_top_scorer VARCHAR")
      )

    if "q_g6_status" not in columns:
      conn.execute(
        text(
          "ALTER TABLE bonus_predictions "
          "ADD COLUMN q_g6_status VARCHAR NOT NULL DEFAULT 'pending'"
        )
      )

    if "q_t3_status" not in columns:
      conn.execute(
        text(
          "ALTER TABLE bonus_predictions "
          "ADD COLUMN q_t3_status VARCHAR NOT NULL DEFAULT 'pending'"
        )
      )


def add_bonus_results_fields() -> None:
  with engine.begin() as conn:
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("bonus_results")]

    if "g6_correct" not in columns:
      conn.execute(
        text("ALTER TABLE bonus_results ADD COLUMN g6_correct VARCHAR")
      )

    if "t3_correct" not in columns:
      conn.execute(
        text("ALTER TABLE bonus_results ADD COLUMN t3_correct VARCHAR")
      )


def run() -> None:
  add_bonus_prediction_fields()
  add_bonus_results_fields()


if __name__ == "__main__":
  run()

