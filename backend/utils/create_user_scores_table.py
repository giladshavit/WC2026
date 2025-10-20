#!/usr/bin/env python3
"""
Simple script to create the user_scores table and add first record
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.user_scores import UserScores
from sqlalchemy.orm import Session

def create_table_and_first_record():
    """Create the user_scores table and add first record"""
    from database import engine
    from models.base import Base
    
    # Create the table
    print("Creating user_scores table...")
    Base.metadata.create_all(bind=engine, tables=[UserScores.__table__])
    print("✅ user_scores table created successfully!")
    
    # Add first record for user_id = 1
    db = next(get_db())
    
    try:
        # Check if record already exists
        existing = db.query(UserScores).filter(UserScores.user_id == 1).first()
        if existing:
            print("Record for user_id=1 already exists, skipping...")
            return
        
        # Create new record
        user_scores = UserScores(
            user_id=1,
            matches_score=0,
            groups_score=0,
            third_place_score=0,
            knockout_score=0,
            total_points=0
        )
        
        db.add(user_scores)
        db.commit()
        print("✅ Added first record for user_id=1 with all scores = 0")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding first record: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Creating user_scores table and adding first record...")
    create_table_and_first_record()
    print("🎉 Done!")
