#!/usr/bin/env python3
"""
Migration script to add new columns to the teams table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

def migrate_teams_table():
    """Add new columns to the teams table"""
    
    # Use the correct database path
    backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
    db_path = os.path.join(backend_dir, 'world_cup_predictions.db')
    print(f"Using database: {db_path}")
    
    # Create engine with absolute path
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        db = SessionLocal()
        
        # Add new columns to the teams table
        migration_queries = [
            "ALTER TABLE teams ADD COLUMN group_letter CHAR(1);",
            "ALTER TABLE teams ADD COLUMN group_position INTEGER;",
            "ALTER TABLE teams ADD COLUMN goals_for INTEGER DEFAULT 0;",
            "ALTER TABLE teams ADD COLUMN goals_against INTEGER DEFAULT 0;"
        ]
        
        for query in migration_queries:
            try:
                db.execute(text(query))
                print(f"Executed: {query}")
            except Exception as e:
                print(f"Error executing {query}: {e}")
        
        db.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_teams_table()
