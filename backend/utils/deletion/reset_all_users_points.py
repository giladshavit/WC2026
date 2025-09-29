#!/usr/bin/env python3
"""
Script to reset all users' points to zero.
This will set total_points = 0 for all users in the database.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.user import User

def reset_all_users_points():
    """Reset all users' points to zero."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Starting reset of all users' points...")
        
        # Count users before reset
        user_count = db.query(User).count()
        users_with_points = db.query(User).filter(User.total_points > 0).count()
        
        print(f"Users found: {user_count}")
        print(f"Users with points > 0: {users_with_points}")
        
        if user_count == 0:
            print("No users found to reset.")
            return
        
        if users_with_points == 0:
            print("All users already have 0 points.")
            return
        
        print(f"Proceeding to reset points for {users_with_points} users...")
        
        # Reset all users' points to 0
        updated_count = db.query(User).update({User.total_points: 0})
        
        # Commit the changes
        db.commit()
        
        print(f"Successfully reset points for {updated_count} users.")
        
        # Verify reset
        remaining_users_with_points = db.query(User).filter(User.total_points > 0).count()
        
        print(f"Verification - Users with points > 0: {remaining_users_with_points}")
        
        if remaining_users_with_points == 0:
            print("✅ All users' points have been successfully reset!")
        else:
            print("⚠️  Some users may still have points.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reset_all_users_points()
