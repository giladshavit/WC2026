#!/usr/bin/env python3
"""Add user profile statistics fields (Prompt 12 schema changes)."""
import sqlite3
import os


def add_user_profile_statistics_fields():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'world_cup_predictions.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # group_stage_predictions: add accuracy columns
        cursor.execute("PRAGMA table_info(group_stage_predictions)")
        gsp_columns = [col[1] for col in cursor.fetchall()]

        for col_name, col_def in [
            ('correct_positions_count', 'INTEGER'),
            ('first_correct', 'INTEGER'),
            ('second_correct', 'INTEGER'),
            ('third_correct', 'INTEGER'),
            ('fourth_correct', 'INTEGER'),
        ]:
            if col_name not in gsp_columns:
                cursor.execute(f"ALTER TABLE group_stage_predictions ADD COLUMN {col_name} {col_def}")
                print(f"Added '{col_name}' to group_stage_predictions")
            else:
                print(f"'{col_name}' already exists in group_stage_predictions")

        # third_place_predictions: add correct_groups_count
        cursor.execute("PRAGMA table_info(third_place_predictions)")
        tpp_columns = [col[1] for col in cursor.fetchall()]

        if 'correct_groups_count' not in tpp_columns:
            cursor.execute("ALTER TABLE third_place_predictions ADD COLUMN correct_groups_count INTEGER")
            print("Added 'correct_groups_count' to third_place_predictions")
        else:
            print("'correct_groups_count' already exists in third_place_predictions")

        # third_place_group_counts: create table if not exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='third_place_group_counts'"
        )
        if cursor.fetchone() is None:
            cursor.execute("""
                CREATE TABLE third_place_group_counts (
                    id INTEGER PRIMARY KEY,
                    group_a INTEGER NOT NULL DEFAULT 0,
                    group_b INTEGER NOT NULL DEFAULT 0,
                    group_c INTEGER NOT NULL DEFAULT 0,
                    group_d INTEGER NOT NULL DEFAULT 0,
                    group_e INTEGER NOT NULL DEFAULT 0,
                    group_f INTEGER NOT NULL DEFAULT 0,
                    group_g INTEGER NOT NULL DEFAULT 0,
                    group_h INTEGER NOT NULL DEFAULT 0,
                    group_i INTEGER NOT NULL DEFAULT 0,
                    group_j INTEGER NOT NULL DEFAULT 0,
                    group_k INTEGER NOT NULL DEFAULT 0,
                    group_l INTEGER NOT NULL DEFAULT 0
                )
            """)
            print("Created table 'third_place_group_counts'")
        else:
            print("Table 'third_place_group_counts' already exists")

        conn.commit()
        print("\nDone!")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    add_user_profile_statistics_fields()
