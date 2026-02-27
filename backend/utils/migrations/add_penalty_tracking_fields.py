#!/usr/bin/env python3
"""
Migration: Add penalty tracking fields to prediction tables and user_scores.

- group_stage_predictions: penalty_points, changes_count
- third_place_predictions: penalty_points, changes_count
- knockout_stage_predictions: penalty_points, changes_count
- user_scores: groups_penalty, third_place_penalty, knockout_penalty

All new columns default to 0. Safe to re-run (checks if columns exist).
"""

import os
import sys

from sqlalchemy import create_engine, text


def find_database():
    """Find the database file"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(current_dir, "world_cup_predictions.db"),
        os.path.join(current_dir, "..", "world_cup_predictions.db"),
        os.path.join(current_dir, "..", "..", "world_cup_predictions.db"),
        "world_cup_predictions.db",
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    raise FileNotFoundError("Could not find world_cup_predictions.db")


def column_exists(conn, table: str, column: str) -> bool:
    """Check if a column exists in a table."""
    result = conn.execute(text(f"PRAGMA table_info({table})"))
    columns = [row[1] for row in result.fetchall()]
    return column in columns


def add_column_if_not_exists(conn, table: str, column: str, definition: str) -> bool:
    """Add column if it doesn't exist. Returns True if added."""
    if column_exists(conn, table, column):
        return False
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
    return True


def run_migration():
    """Run the migration"""
    db_path = find_database()
    print(f"Found database at: {db_path}")

    db_uri = "sqlite:///" + os.path.abspath(db_path).replace("\\", "/")
    engine = create_engine(db_uri)

    try:
        added = 0

        with engine.connect() as conn:
            # 1. group_stage_predictions
            if add_column_if_not_exists(
                conn, "group_stage_predictions", "penalty_points", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1
            if add_column_if_not_exists(
                conn, "group_stage_predictions", "changes_count", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1

            # 2. third_place_predictions
            if add_column_if_not_exists(
                conn, "third_place_predictions", "penalty_points", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1
            if add_column_if_not_exists(
                conn, "third_place_predictions", "changes_count", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1

            # 3. knockout_stage_predictions
            if add_column_if_not_exists(
                conn, "knockout_stage_predictions", "penalty_points", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1
            if add_column_if_not_exists(
                conn, "knockout_stage_predictions", "changes_count", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1

            # 4. user_scores
            if add_column_if_not_exists(
                conn, "user_scores", "groups_penalty", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1
            if add_column_if_not_exists(
                conn, "user_scores", "third_place_penalty", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1
            if add_column_if_not_exists(
                conn, "user_scores", "knockout_penalty", "INTEGER DEFAULT 0 NOT NULL"
            ):
                added += 1

            conn.commit()

        if added > 0:
            print(f"✅ Successfully added {added} column(s)!")
        else:
            print("✅ All columns already exist. No changes needed.")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migration()
