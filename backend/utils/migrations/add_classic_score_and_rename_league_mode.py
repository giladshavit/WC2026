"""
Migration: Add classic_total_score to user_scores; 
rename league score_mode enum values all→multi, matches→classic
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.database import SessionLocal
from sqlalchemy import text

def run():
    db = SessionLocal()
    try:
        # 1. Add classic_total_score column
        db.execute(text("""
            ALTER TABLE user_scores 
            ADD COLUMN IF NOT EXISTS classic_total_score INTEGER NOT NULL DEFAULT 0
        """))
        
        # 2. Rename enum values (PostgreSQL approach)
        # Update existing rows
        db.execute(text("UPDATE leagues SET score_mode = 'multi' WHERE score_mode = 'all'"))
        db.execute(text("UPDATE leagues SET score_mode = 'classic' WHERE score_mode = 'matches'"))
        
        # Rename enum type values
        db.execute(text("ALTER TYPE leaguescoremode RENAME VALUE 'all' TO 'multi'"))
        db.execute(text("ALTER TYPE leaguescoremode RENAME VALUE 'matches' TO 'classic'"))
        
        db.commit()
        print("Migration completed successfully")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
