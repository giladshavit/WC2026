#!/usr/bin/env python3
"""
Script to delete all teams from the database.
This will remove all teams from the teams table.

This will remove all team data but keep the database structure intact.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.team import Team


def delete_all_teams():
    """Delete all teams from the teams table."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Starting deletion of all teams...")
        print("This will delete all teams from the teams table.")
        print()
        
        # Count records before deletion
        team_count = db.query(Team).count()
        
        print(f"Teams to be deleted: {team_count}")
        
        if team_count == 0:
            print("No teams found to delete.")
            return
        
        print(f"Proceeding to delete all {team_count} team records...")
        
        # Delete all teams
        print("\nDeleting teams...")
        deleted_teams = db.query(Team).delete()
        print(f"Deleted {deleted_teams} teams")
        
        # Commit the changes
        db.commit()
        
        print(f"Successfully deleted {deleted_teams} team records.")
        
        # Verify deletion
        remaining_teams = db.query(Team).count()
        print(f"Verification - Remaining teams: {remaining_teams}")
        
        if remaining_teams == 0:
            print("✅ All teams have been successfully deleted!")
        else:
            print("⚠️  Some teams may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_all_teams()
