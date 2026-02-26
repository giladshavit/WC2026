#!/usr/bin/env python3
"""
Migration: Allow NULL for place columns in group_stage_predictions and third_place_predictions.
Required for empty predictions created at user registration.
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


def migrate_group_stage_predictions(cursor):
    """Recreate group_stage_predictions with nullable first_place, second_place, third_place, fourth_place"""
    cursor.execute("""
        CREATE TABLE group_stage_predictions_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            first_place INTEGER,
            second_place INTEGER,
            third_place INTEGER,
            fourth_place INTEGER,
            points INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_editable BOOLEAN DEFAULT 1,
            correct_positions_count INTEGER,
            first_correct INTEGER,
            second_correct INTEGER,
            third_correct INTEGER,
            fourth_correct INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(first_place) REFERENCES teams(id),
            FOREIGN KEY(second_place) REFERENCES teams(id),
            FOREIGN KEY(third_place) REFERENCES teams(id),
            FOREIGN KEY(fourth_place) REFERENCES teams(id)
        )
    """)
    cursor.execute("""
        INSERT INTO group_stage_predictions_new
        SELECT id, user_id, group_id, first_place, second_place, third_place, fourth_place,
               points, created_at, updated_at, is_editable, correct_positions_count,
               first_correct, second_correct, third_correct, fourth_correct
        FROM group_stage_predictions
    """)
    cursor.execute("DROP TABLE group_stage_predictions")
    cursor.execute("ALTER TABLE group_stage_predictions_new RENAME TO group_stage_predictions")


def migrate_third_place_predictions(cursor):
    """Recreate third_place_predictions with nullable qualifying columns"""
    cursor.execute("""
        CREATE TABLE third_place_predictions_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            first_team_qualifying INTEGER,
            second_team_qualifying INTEGER,
            third_team_qualifying INTEGER,
            fourth_team_qualifying INTEGER,
            fifth_team_qualifying INTEGER,
            sixth_team_qualifying INTEGER,
            seventh_team_qualifying INTEGER,
            eighth_team_qualifying INTEGER,
            changed_groups VARCHAR(50),
            points INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_editable BOOLEAN DEFAULT 1,
            correct_groups_count INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(first_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(second_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(third_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(fourth_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(fifth_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(sixth_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(seventh_team_qualifying) REFERENCES teams(id),
            FOREIGN KEY(eighth_team_qualifying) REFERENCES teams(id)
        )
    """)
    cursor.execute("""
        INSERT INTO third_place_predictions_new
        SELECT id, user_id, first_team_qualifying, second_team_qualifying, third_team_qualifying,
               fourth_team_qualifying, fifth_team_qualifying, sixth_team_qualifying,
               seventh_team_qualifying, eighth_team_qualifying, changed_groups, points,
               created_at, updated_at, is_editable, correct_groups_count
        FROM third_place_predictions
    """)
    cursor.execute("DROP TABLE third_place_predictions")
    cursor.execute("ALTER TABLE third_place_predictions_new RENAME TO third_place_predictions")


def run_migration():
    """Run the migration"""
    db_path = find_database()
    print(f"Found database at: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    try:
        print("Migrating group_stage_predictions (allow NULL for place columns)...")
        migrate_group_stage_predictions(cursor)
        print("  Done.")

        print("Migrating third_place_predictions (allow NULL for qualifying columns)...")
        migrate_third_place_predictions(cursor)
        print("  Done.")

        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON")
        print("\n✅ Migration complete.")
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
