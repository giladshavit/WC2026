#!/usr/bin/env python3
"""
Script to delete all groups from the database.
This will remove all groups from both:
1. groups table (actual tournament groups with teams)
2. group_template table (group templates/paths)

This will remove all group data but keep the database structure intact.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.groups import Group
from models.group_template import GroupTemplate


def delete_all_groups():
    """Delete all groups from the groups table only (keep group_template)."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Starting deletion of all groups...")
        print("This will delete:")
        print("1. Tournament groups (groups table)")
        print("2. Group templates (group_template table) - PRESERVED")
        print()
        
        # Count records before deletion
        group_count = db.query(Group).count()
        template_count = db.query(GroupTemplate).count()
        
        print(f"Records to be deleted:")
        print(f"  - Tournament groups: {group_count}")
        print(f"  - Group templates: {template_count} (will be preserved)")
        
        if group_count == 0:
            print("No tournament groups found to delete.")
            return
        
        print(f"Proceeding to delete {group_count} tournament group records...")
        
        # Delete tournament groups only
        print("\nDeleting tournament groups...")
        deleted_groups = db.query(Group).delete()
        print(f"Deleted {deleted_groups} tournament groups")
        
        # Commit the changes
        db.commit()
        
        print(f"\nSuccessfully deleted {deleted_groups} tournament group records.")
        
        # Verify deletion
        remaining_groups = db.query(Group).count()
        remaining_templates = db.query(GroupTemplate).count()
        
        print(f"\nVerification - Remaining records:")
        print(f"  - Tournament groups: {remaining_groups}")
        print(f"  - Group templates: {remaining_templates} (preserved)")
        
        if remaining_groups == 0:
            print("✅ All tournament groups have been successfully deleted!")
        else:
            print("⚠️  Some tournament groups may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_all_groups()
