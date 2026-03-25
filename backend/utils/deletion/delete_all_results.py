#!/usr/bin/env python3
"""
Script to delete all results from all result tables.
This script is divided into two parts:
1. Delete match results (individual match scores)
2. Delete path results (groups, 3rd place, and knockout stage results)

This will remove all tournament results but keep the database structure intact.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult, KnockoutStageResult


def delete_match_results():
    """Delete all match results (individual match scores)."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("=== DELETING MATCH RESULTS ===")
        
        # Count records before deletion
        match_result_count = db.query(MatchResult).count()
        
        print(f"Match results to be deleted: {match_result_count}")
        
        if match_result_count == 0:
            print("No match results found to delete.")
            return
        
        print(f"Proceeding to delete all {match_result_count} match result records...")
        
        # Delete match results
        deleted_match_results = db.query(MatchResult).delete()
        print(f"Deleted {deleted_match_results} match results")
        
        # Commit the changes
        db.commit()
        
        print(f"Successfully deleted {deleted_match_results} match result records.")
        
        # Verify deletion
        remaining_match_results = db.query(MatchResult).count()
        print(f"Verification - Remaining match results: {remaining_match_results}")
        
        if remaining_match_results == 0:
            print("✅ All match results have been successfully deleted!")
        else:
            print("⚠️  Some match results may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def delete_path_results():
    """Delete all path results (groups, 3rd place, and knockout stage results)."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("\n=== DELETING PATH RESULTS ===")
        
        # Count records before deletion
        group_result_count = db.query(GroupStageResult).count()
        third_place_result_count = db.query(ThirdPlaceResult).count()
        knockout_result_count = db.query(KnockoutStageResult).count()
        
        total_before = group_result_count + third_place_result_count + knockout_result_count
        
        print(f"Path results to be deleted:")
        print(f"  - Group stage results: {group_result_count}")
        print(f"  - Third place results: {third_place_result_count}")
        print(f"  - Knockout stage results: {knockout_result_count}")
        print(f"  - Total: {total_before}")
        
        if total_before == 0:
            print("No path results found to delete.")
            return
        
        print(f"Proceeding to delete all {total_before} path result records...")
        
        # Delete path results
        print("\nDeleting path results...")
        
        # Delete group stage results
        deleted_group = db.query(GroupStageResult).delete()
        print(f"Deleted {deleted_group} group stage results")
        
        # Delete third place results
        deleted_third_place = db.query(ThirdPlaceResult).delete()
        print(f"Deleted {deleted_third_place} third place results")
        
        # Delete knockout stage results
        deleted_knockout = db.query(KnockoutStageResult).delete()
        print(f"Deleted {deleted_knockout} knockout stage results")
        
        # Commit the changes
        db.commit()
        
        total_deleted = deleted_group + deleted_third_place + deleted_knockout
        print(f"Successfully deleted {total_deleted} path result records.")
        
        # Verify deletion
        remaining_group = db.query(GroupStageResult).count()
        remaining_third_place = db.query(ThirdPlaceResult).count()
        remaining_knockout = db.query(KnockoutStageResult).count()
        
        print(f"\nVerification - Remaining path results:")
        print(f"  - Group stage results: {remaining_group}")
        print(f"  - Third place results: {remaining_third_place}")
        print(f"  - Knockout stage results: {remaining_knockout}")
        
        if remaining_group + remaining_third_place + remaining_knockout == 0:
            print("✅ All path results have been successfully deleted!")
        else:
            print("⚠️  Some path results may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def delete_all_results():
    """Delete all results (both match results and path results)."""
    
    print("Starting deletion of all results...")
    print("This will delete:")
    print("1. Match results (individual match scores)")
    print("2. Path results (groups, 3rd place, knockout stage)")
    print()
    
    # Delete match results
    delete_match_results()
    
    # Delete path results
    delete_path_results()
    
    print("\n🎉 All results deletion completed!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Delete results from the database')
    parser.add_argument('--match-only', action='store_true', 
                       help='Delete only match results')
    parser.add_argument('--path-only', action='store_true', 
                       help='Delete only path results (groups, 3rd place, knockout)')
    
    args = parser.parse_args()
    
    if args.match_only:
        delete_match_results()
    elif args.path_only:
        delete_path_results()
    else:
        delete_all_results()
