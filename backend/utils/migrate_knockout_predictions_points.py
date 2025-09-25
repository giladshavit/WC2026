#!/usr/bin/env python3
"""
Migration script to add points field to knockout_stage_predictions table
"""

import sqlite3
import os
import shutil

def migrate_knockout_predictions_points():
    """Add points field to knockout_stage_predictions table"""
    
    db_path = "world_cup_predictions.db"
    backup_path = "world_cup_predictions_backup_knockout_points.db"
    
    print("Starting migration: Add points field to knockout_stage_predictions...")
    
    # Create backup
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"Created backup: {backup_path}")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add points column to knockout_stage_predictions table
        cursor.execute("""
            ALTER TABLE knockout_stage_predictions 
            ADD COLUMN points INTEGER DEFAULT 0 NOT NULL
        """)
        
        conn.commit()
        print("✅ Successfully added points field to knockout_stage_predictions table")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(knockout_stage_predictions)")
        columns = cursor.fetchall()
        points_column = [col for col in columns if col[1] == 'points']
        
        if points_column:
            print("✅ Verified: points column exists")
        else:
            print("❌ Error: points column not found")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        
        # Restore from backup if migration failed
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, db_path)
            print("Restored from backup due to migration failure")
            
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_knockout_predictions_points()
