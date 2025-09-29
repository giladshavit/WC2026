#!/usr/bin/env python3
"""
Script to delete all matches from the database.
This will remove all matches from:
1. matches table (actual tournament matches)

This will remove all match data but keep the database structure intact.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.matches import Match


def delete_all_matches():
    """Delete all matches from the matches table."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Starting deletion of all matches...")
        print("This will delete:")
        print("1. Tournament matches (matches table)")
        print()
        
        # Count records before deletion
        match_count = db.query(Match).count()
        
        print(f"Records to be deleted:")
        print(f"  - Tournament matches: {match_count}")
        
        if match_count == 0:
            print("No matches found to delete.")
            return
        
        print(f"Proceeding to delete all {match_count} match records...")
        
        # Delete tournament matches
        print("\nDeleting tournament matches...")
        deleted_matches = db.query(Match).delete()
        print(f"Deleted {deleted_matches} tournament matches")
        
        # Commit the changes
        db.commit()
        
        print(f"\nSuccessfully deleted {deleted_matches} match records.")
        
        # Verify deletion
        remaining_matches = db.query(Match).count()
        
        print(f"\nVerification - Remaining records:")
        print(f"  - Tournament matches: {remaining_matches}")
        
        if remaining_matches == 0:
            print("✅ All matches have been successfully deleted!")
        else:
            print("⚠️  Some matches may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_all_matches()
