import sqlite3
import os

def migrate_add_is_editable():
    """Add is_editable field to prediction tables"""
    
    # Database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'world_cup_predictions.db')
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Adding is_editable columns to prediction tables...")
        
        # Add column to match_predictions table
        try:
            cursor.execute("ALTER TABLE match_predictions ADD COLUMN is_editable BOOLEAN DEFAULT 1")
            print("✓ Added is_editable to match_predictions")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ is_editable already exists in match_predictions")
            else:
                print(f"✗ Error adding is_editable to match_predictions: {e}")
        
        # Add column to group_stage_predictions table
        try:
            cursor.execute("ALTER TABLE group_stage_predictions ADD COLUMN is_editable BOOLEAN DEFAULT 1")
            print("✓ Added is_editable to group_stage_predictions")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ is_editable already exists in group_stage_predictions")
            else:
                print(f"✗ Error adding is_editable to group_stage_predictions: {e}")
        
        # Add column to third_place_predictions table
        try:
            cursor.execute("ALTER TABLE third_place_predictions ADD COLUMN is_editable BOOLEAN DEFAULT 1")
            print("✓ Added is_editable to third_place_predictions")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ is_editable already exists in third_place_predictions")
            else:
                print(f"✗ Error adding is_editable to third_place_predictions: {e}")
        
        # Add column to knockout_stage_predictions table
        try:
            cursor.execute("ALTER TABLE knockout_stage_predictions ADD COLUMN is_editable BOOLEAN DEFAULT 1")
            print("✓ Added is_editable to knockout_stage_predictions")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ is_editable already exists in knockout_stage_predictions")
            else:
                print(f"✗ Error adding is_editable to knockout_stage_predictions: {e}")
        
        # Commit changes
        conn.commit()
        print("\n✅ Successfully added is_editable columns to all prediction tables!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_add_is_editable()
