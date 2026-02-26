#!/usr/bin/env python3
"""Add match statistics fields to match_predictions and user_scores tables."""
import sqlite3
import os


def add_match_statistics_fields():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'world_cup_predictions.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # match_predictions: add status column
        cursor.execute("PRAGMA table_info(match_predictions)")
        mp_columns = [col[1] for col in cursor.fetchall()]

        if 'status' not in mp_columns:
            cursor.execute("ALTER TABLE match_predictions ADD COLUMN status TEXT DEFAULT 'pending' NOT NULL")
            print("Added 'status' to match_predictions")
        else:
            print("'status' already exists in match_predictions")

        # user_scores: add 4 counter columns
        cursor.execute("PRAGMA table_info(user_scores)")
        us_columns = [col[1] for col in cursor.fetchall()]

        for col_name in ['matches_exact_count', 'matches_correct_count', 'matches_wrong_count', 'matches_total_judged']:
            if col_name not in us_columns:
                cursor.execute(f"ALTER TABLE user_scores ADD COLUMN {col_name} INTEGER DEFAULT 0")
                print(f"Added '{col_name}' to user_scores")
            else:
                print(f"'{col_name}' already exists in user_scores")

        conn.commit()
        print("\nDone!")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    add_match_statistics_fields()
