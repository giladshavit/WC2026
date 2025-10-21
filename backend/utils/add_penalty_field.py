#!/usr/bin/env python3
"""
Add penalty field to user_scores table
"""

import sqlite3
import os

def add_penalty_field():
    """Add penalty field to user_scores table"""
    
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), '..', 'world_cup_predictions.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if penalty field already exists
        cursor.execute("PRAGMA table_info(user_scores)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'penalty' in columns:
            print("✅ Penalty field already exists in user_scores table")
            return
        
        # Add penalty field before total_points
        cursor.execute("""
            ALTER TABLE user_scores 
            ADD COLUMN penalty INTEGER DEFAULT 0
        """)
        
        # Move penalty column to be before total_points
        # SQLite doesn't support reordering columns directly, so we need to recreate the table
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_scores'")
        table_sql = cursor.fetchone()[0]
        
        # Create new table with correct column order
        cursor.execute("""
            CREATE TABLE user_scores_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                matches_score INTEGER DEFAULT 0,
                groups_score INTEGER DEFAULT 0,
                third_place_score INTEGER DEFAULT 0,
                knockout_score INTEGER DEFAULT 0,
                penalty INTEGER DEFAULT 0,
                total_points INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Copy data from old table to new table
        cursor.execute("""
            INSERT INTO user_scores_new 
            (id, user_id, matches_score, groups_score, third_place_score, knockout_score, penalty, total_points)
            SELECT id, user_id, matches_score, groups_score, third_place_score, knockout_score, 0, total_points
            FROM user_scores
        """)
        
        # Drop old table
        cursor.execute("DROP TABLE user_scores")
        
        # Rename new table
        cursor.execute("ALTER TABLE user_scores_new RENAME TO user_scores")
        
        # Commit changes
        conn.commit()
        
        print("✅ Successfully added penalty field to user_scores table")
        print("✅ Penalty field is now positioned before total_points")
        
        # Show the updated table structure
        cursor.execute("PRAGMA table_info(user_scores)")
        columns = cursor.fetchall()
        print("\n📋 Updated user_scores table structure:")
        for column in columns:
            print(f"  - {column[1]} ({column[2]})")
        
    except Exception as e:
        print(f"❌ Error adding penalty field: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_penalty_field()
