"""
Migration: add current_winner_team_id to knockout_stage_predictions_draft

Run: venv/bin/python3 backend/utils/migrations/add_current_winner_team_to_draft.py
"""

import sqlite3
import os
import sys

def add_column(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(knockout_stage_predictions_draft)")
    cols = [row[1] for row in cur.fetchall()]
    if 'current_winner_team_id' in cols:
        print('✅ Column current_winner_team_id already exists')
        conn.close()
        return
    cur.execute("ALTER TABLE knockout_stage_predictions_draft ADD COLUMN current_winner_team_id INTEGER")
    conn.commit()
    conn.close()
    print('✅ Column current_winner_team_id added successfully')

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # Check database.py to find the correct DB path
    db_file = 'world_cup_predictions.db'  # Default from database.py
    candidates = [
        os.path.join(project_root, db_file),
        os.path.join(project_root, 'database.db'),
    ]
    db_path = next((p for p in candidates if os.path.exists(p)), None)
    if not db_path:
        print('❌ Database file not found.')
        sys.exit(1)
    print(f"📁 Using database: {db_path}")
    add_column(db_path)


