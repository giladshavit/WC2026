import sqlite3
import os

def migrate_tournament_config():
    """Create tournament_config table and initialize current_stage"""
    
    # Database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'world_cup_predictions.db')
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Creating tournament_config table...")
        
        # Create tournament_config table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tournament_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            )
        """)
        
        # Insert default current_stage if it doesn't exist
        cursor.execute("""
            INSERT OR IGNORE INTO tournament_config (key, value) 
            VALUES ('current_stage', 'PRE_GROUP_STAGE')
        """)
        
        # Commit changes
        conn.commit()
        print("✅ Successfully created tournament_config table and initialized current_stage!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_tournament_config()
