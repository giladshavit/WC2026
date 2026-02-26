#!/usr/bin/env python3
"""
Migration: Add is_team1_modified, is_team2_modified, is_winner_modified to knockout_stage_predictions_draft.
"""

import sqlite3
import os
import sys


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


def add_draft_modified_flags():
    """Add modified flags to knockout_stage_predictions_draft"""
    db_path = find_database()
    print(f"Found database at: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Adding is_team1_modified, is_team2_modified, is_winner_modified to knockout_stage_predictions_draft...")
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions_draft
            ADD COLUMN is_team1_modified INTEGER DEFAULT 0 NOT NULL
        """)
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions_draft
            ADD COLUMN is_team2_modified INTEGER DEFAULT 0 NOT NULL
        """)
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions_draft
            ADD COLUMN is_winner_modified INTEGER DEFAULT 0 NOT NULL
        """)
        conn.commit()
        print("✅ Successfully added draft modified flags!")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Columns already exist, skipping...")
        else:
            print(f"❌ Error: {e}")
            conn.rollback()
            sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    add_draft_modified_flags()
