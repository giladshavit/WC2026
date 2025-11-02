"""
Migration script to create knockout_stage_predictions_draft table
Run this script to create the draft table for knockout predictions.
"""

import sqlite3
import os
import sys

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_draft_table(db_path: str):
    """Create the draft table in the database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create the table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knockout_stage_predictions_draft (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            knockout_result_id INTEGER NOT NULL,
            template_match_id INTEGER NOT NULL,
            stage VARCHAR(20) NOT NULL,
            team1_id INTEGER,
            team2_id INTEGER,
            winner_team_id INTEGER,
            status VARCHAR(20) DEFAULT 'gray',
            knockout_pred_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(knockout_result_id) REFERENCES knockout_stage_results(id),
            FOREIGN KEY(template_match_id) REFERENCES matches_template(id),
            FOREIGN KEY(team1_id) REFERENCES teams(id),
            FOREIGN KEY(team2_id) REFERENCES teams(id),
            FOREIGN KEY(winner_team_id) REFERENCES teams(id),
            FOREIGN KEY(knockout_pred_id) REFERENCES knockout_stage_predictions(id)
        )
    """)
    
    # Create indexes for common queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_draft_user_id ON knockout_stage_predictions_draft(user_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_draft_user_match ON knockout_stage_predictions_draft(user_id, template_match_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_draft_knockout_pred_id ON knockout_stage_predictions_draft(knockout_pred_id)
    """)
    
    conn.commit()
    conn.close()
    print("✅ Draft table created successfully!")

if __name__ == "__main__":
    # Find database path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Try different possible database locations
    possible_db_paths = [
        os.path.join(project_root, "database.db"),
        os.path.join(project_root, "world_cup_predictions.db"),
        os.path.join(script_dir, "world_cup_predictions.db"),
    ]
    
    db_path = None
    for path in possible_db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Could not find database file. Please specify the path:")
        db_path = input("Database path: ").strip()
        if not os.path.exists(db_path):
            print(f"❌ Database file not found: {db_path}")
            sys.exit(1)
    
    print(f"📁 Using database: {db_path}")
    create_draft_table(db_path)

