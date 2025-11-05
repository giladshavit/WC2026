#!/usr/bin/env python3
"""
Migration script to add is_team1_valid and is_team2_valid fields to knockout predictions tables.
"""

import sqlite3
import os
import sys

def find_database():
    """Find the database file"""
    # Check current directory and parent directories
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

def add_validity_fields():
    """Add is_team1_valid and is_team2_valid fields to both knockout prediction tables"""
    db_path = find_database()
    print(f"Found database at: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add fields to knockout_stage_predictions
        print("Adding is_team1_valid and is_team2_valid to knockout_stage_predictions...")
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions 
            ADD COLUMN is_team1_valid INTEGER DEFAULT 1 NOT NULL
        """)
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions 
            ADD COLUMN is_team2_valid INTEGER DEFAULT 1 NOT NULL
        """)
        
        # Add fields to knockout_stage_predictions_draft
        print("Adding is_team1_valid and is_team2_valid to knockout_stage_predictions_draft...")
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions_draft 
            ADD COLUMN is_team1_valid INTEGER DEFAULT 1 NOT NULL
        """)
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions_draft 
            ADD COLUMN is_team2_valid INTEGER DEFAULT 1 NOT NULL
        """)
        
        conn.commit()
        print("✅ Successfully added validity fields to both tables!")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Fields already exist, skipping...")
        else:
            print(f"❌ Error: {e}")
            conn.rollback()
            sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    add_validity_fields()

