#!/usr/bin/env python3
"""
Migration: Ensure match_predictions.status contains only valid MatchPredictionStatus values.
Existing column is VARCHAR; values should already be 'pending', 'exact', 'correct_outcome', 'wrong'.
This migration normalizes any NULL or invalid values to 'pending' for Enum compatibility.
"""

import sqlite3
import os
import sys

VALID_STATUSES = ("pending", "exact", "correct_outcome", "wrong")


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


def migrate_match_predictions_status():
    """Normalize invalid status values to 'pending'."""
    db_path = find_database()
    print(f"Found database at: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute(
            "UPDATE match_predictions SET status = 'pending' WHERE status IS NULL"
        )
        null_count = cursor.rowcount

        cursor.execute(
            (
                "UPDATE match_predictions SET status = 'pending' "
                "WHERE status NOT IN (?, ?, ?, ?)"
            ),
            VALID_STATUSES,
        )
        invalid_count = cursor.rowcount

        conn.commit()
        if null_count > 0 or invalid_count > 0:
            print(
                f"✅ Normalized {null_count} NULL and {invalid_count} invalid "
                "status values to 'pending'"
            )
        else:
            print("✅ All status values already valid. No changes needed.")
    except sqlite3.Error as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_match_predictions_status()
