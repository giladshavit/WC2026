#!/usr/bin/env python3
"""
Migration: Add first_place_team_slot and second_place_team_slot to group_template.
Populates correct slot values per WC 2026 bracket.
"""

import sqlite3
import os
import sys

# Add backend root to path (3 levels up from migrations folder)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


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


# (group_name, first_place_match_id, first_place_team_slot, second_place_match_id, second_place_team_slot)
slot_mappings = [
    ("A", 79, 1, 73, 1),
    ("B", 85, 1, 73, 2),
    ("C", 76, 1, 75, 2),
    ("D", 81, 1, 88, 1),
    ("E", 74, 1, 78, 1),
    ("F", 75, 1, 76, 2),
    ("G", 82, 1, 88, 2),
    ("H", 84, 1, 86, 2),
    ("I", 77, 1, 78, 2),
    ("J", 86, 1, 84, 2),
    ("K", 87, 1, 83, 1),
    ("L", 80, 1, 83, 2),
]


def add_group_template_slots():
    """Add slot columns and populate with correct values"""
    db_path = find_database()
    print(f"Found database at: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Add columns
        print("Adding first_place_team_slot and second_place_team_slot to group_template...")
        cursor.execute(
            "ALTER TABLE group_template ADD COLUMN first_place_team_slot INTEGER NOT NULL DEFAULT 1"
        )
        cursor.execute(
            "ALTER TABLE group_template ADD COLUMN second_place_team_slot INTEGER NOT NULL DEFAULT 1"
        )
        conn.commit()
        print("  Columns added.")

        # Update each row with correct slot values
        print("\nUpdating slot values per group:")
        for group_name, fp_match_id, fp_slot, sp_match_id, sp_slot in slot_mappings:
            cursor.execute(
                """
                UPDATE group_template
                SET first_place_team_slot = ?, second_place_team_slot = ?
                WHERE group_name = ?
                """,
                (fp_slot, sp_slot, group_name),
            )
            if cursor.rowcount > 0:
                print(f"  {group_name}: first_place_slot={fp_slot}, second_place_slot={sp_slot}")
            else:
                print(f"  ⚠️  {group_name}: no row found (match_ids: {fp_match_id}, {sp_match_id})")

        conn.commit()

        # Summary
        print("\n--- Summary ---")
        cursor.execute(
            "SELECT group_name, first_place_match_id, first_place_team_slot, "
            "second_place_match_id, second_place_team_slot FROM group_template ORDER BY group_name"
        )
        rows = cursor.fetchall()
        for row in rows:
            print(f"  {row[0]}: match1={row[1]} slot1={row[2]}, match2={row[3]} slot2={row[4]}")

        print("\n✅ Migration complete.")

    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Columns already exist. Updating slot values only...")
            conn.rollback()
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            for group_name, fp_match_id, fp_slot, sp_match_id, sp_slot in slot_mappings:
                cursor.execute(
                    """
                    UPDATE group_template
                    SET first_place_team_slot = ?, second_place_team_slot = ?
                    WHERE group_name = ?
                    """,
                    (fp_slot, sp_slot, group_name),
                )
            conn.commit()
            print("✅ Slot values updated.")
        else:
            print(f"❌ Error: {e}")
            conn.rollback()
            sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    add_group_template_slots()
