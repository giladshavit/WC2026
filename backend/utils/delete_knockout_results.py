#!/usr/bin/env python3
"""
Script to delete all knockout stage results from the database.
"""

import sys
import os

# Point to backend root: utils -> backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.results import KnockoutStageResult


def delete_knockout_results():
    """Delete all knockout stage results."""
    db = SessionLocal()
    
    try:
        # Count records before deletion
        knockout_result_count = db.query(KnockoutStageResult).count()
        
        print("=" * 50)
        print("Delete Knockout Stage Results")
        print("=" * 50)
        print(f"Knockout results found: {knockout_result_count}")
        
        if knockout_result_count == 0:
            print("No knockout results to delete.")
            return
        
        print(f"Deleting {knockout_result_count} knockout results...")
        
        # Delete knockout stage results
        deleted_knockout = db.query(KnockoutStageResult).delete()
        
        # Commit the changes
        db.commit()
        
        print(f"✅ Successfully deleted {deleted_knockout} knockout result records.")
        
        # Verify deletion
        remaining_knockout = db.query(KnockoutStageResult).count()
        
        if remaining_knockout == 0:
            print("✅ All knockout results have been successfully deleted!")
        else:
            print(f"⚠️  {remaining_knockout} knockout results may still remain.")
            
    except Exception as e:
        print(f"❌ Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_knockout_results()

