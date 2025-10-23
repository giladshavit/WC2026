#!/usr/bin/env python3
"""
Migration script to update User model for authentication system.
This script adds the new authentication fields to existing users.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import SQLALCHEMY_DATABASE_URL
from models.user import User
from services.auth_service import AuthService

def migrate_user_auth():
    """Migrate existing users to support authentication."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("Starting user authentication migration...")
        
        # Check if we need to add new columns
        with engine.connect() as conn:
            # Check if username column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('users') 
                WHERE name = 'username'
            """))
            username_exists = result.fetchone()[0] > 0
            
            # Check if password_hash column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('users') 
                WHERE name = 'password_hash'
            """))
            password_hash_exists = result.fetchone()[0] > 0
            
            # Check if last_login column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('users') 
                WHERE name = 'last_login'
            """))
            last_login_exists = result.fetchone()[0] > 0
            
            # Check if is_active column exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('users') 
                WHERE name = 'is_active'
            """))
            is_active_exists = result.fetchone()[0] > 0
        
        # Add missing columns
        if not username_exists:
            print("Adding username column...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR"))
                conn.commit()
        
        if not password_hash_exists:
            print("Adding password_hash column...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR NOT NULL DEFAULT ''"))
                conn.commit()
        
        if not last_login_exists:
            print("Adding last_login column...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))
                conn.commit()
        
        if not is_active_exists:
            print("Adding is_active column...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                conn.commit()
        
        # Fix email column to be nullable (SQLite limitation workaround)
        print("Updating email column to be nullable...")
        with engine.connect() as conn:
            # First, update any NULL emails to empty string
            conn.execute(text("UPDATE users SET email = '' WHERE email IS NULL"))
            conn.commit()
        
        # Update existing users
        existing_users = db.query(User).all()
        print(f"Found {len(existing_users)} existing users to migrate...")
        
        for user in existing_users:
            if not user.username:
                # Generate username from name
                username = user.name.lower().replace(' ', '_')
                # Ensure uniqueness
                original_username = username
                counter = 1
                while db.query(User).filter(User.username == username).first():
                    username = f"{original_username}_{counter}"
                    counter += 1
                
                user.username = username
                print(f"Set username for user {user.name}: {username}")
            
            if not user.password_hash:
                # Set a default password that users will need to change
                default_password = "changeme123"
                user.password_hash = AuthService.hash_password(default_password)
                print(f"Set default password for user {user.name}")
            
            if user.is_active is None:
                user.is_active = True
                print(f"Set is_active=True for user {user.name}")
        
        db.commit()
        print("Migration completed successfully!")
        
        # Print summary
        print("\nMigration Summary:")
        print(f"- Updated {len(existing_users)} users")
        print("- Added authentication fields")
        print("- Set default passwords to 'changeme123'")
        print("- Users should change their passwords on first login")
        
    except Exception as e:
        print(f"Migration failed: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_user_auth()
