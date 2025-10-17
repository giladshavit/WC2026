#!/usr/bin/env python3
"""
Script to add short_name column to teams table
"""

import sqlite3
import os

def add_short_name_column():
    """Add short_name column to teams table"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'world_cup_predictions.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add the short_name column
        cursor.execute("ALTER TABLE teams ADD COLUMN short_name VARCHAR(3)")
        
        # Commit the changes
        conn.commit()
        print("✅ Successfully added short_name column to teams table!")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("✅ short_name column already exists!")
        else:
            print(f"❌ Error adding short_name column: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_short_name_column()
