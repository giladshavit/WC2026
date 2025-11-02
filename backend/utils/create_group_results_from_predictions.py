#!/usr/bin/env python3
"""
Script to create group stage results from user predictions.

This script takes predictions from a specific user (default: user_id=1)
and creates group stage results based on those predictions.
"""

import sys
import os
import argparse

# Point to backend root: utils -> backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.groups import Group
from models.predictions import GroupStagePrediction
from models.results import GroupStageResult
from services.results_service import ResultsService
from services.group_service import GroupService


def create_results_from_predictions(user_id: int = 1, update_existing: bool = False):
    """
    Create group stage results from user predictions.
    
    Args:
        user_id: ID of the user whose predictions to use (default: 1)
        update_existing: If True, update existing results. If False, skip groups with existing results.
    """
    db = SessionLocal()
    
    try:
        # Get all groups
        groups = db.query(Group).order_by(Group.name).all()
        print(f"Found {len(groups)} groups")
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for group in groups:
            print(f"\nProcessing Group {group.name} (ID: {group.id})...")
            
            # Get prediction for this group
            prediction = db.query(GroupStagePrediction).filter(
                GroupStagePrediction.user_id == user_id,
                GroupStagePrediction.group_id == group.id
            ).first()
            
            if not prediction:
                print(f"  ❌ No prediction found for user {user_id} in group {group.name}")
                error_count += 1
                continue
            
            # Check if result already exists
            existing_result = db.query(GroupStageResult).filter(
                GroupStageResult.group_id == group.id
            ).first()
            
            if existing_result and not update_existing:
                print(f"  ⚠️  Result already exists for group {group.name}, skipping...")
                skipped_count += 1
                continue
            
            # Get team names for display
            first_place_name = prediction.first_place_team.name if prediction.first_place_team else "N/A"
            second_place_name = prediction.second_place_team.name if prediction.second_place_team else "N/A"
            third_place_name = prediction.third_place_team.name if prediction.third_place_team else "N/A"
            fourth_place_name = prediction.fourth_place_team.name if prediction.fourth_place_team else "N/A"
            
            print(f"  📊 Prediction: 1st={first_place_name}, 2nd={second_place_name}, 3rd={third_place_name}, 4th={fourth_place_name}")
            
            try:
                # Create or update result
                result = ResultsService.update_group_stage_result(
                    db=db,
                    group_id=group.id,
                    first_place_team_id=prediction.first_place,
                    second_place_team_id=prediction.second_place,
                    third_place_team_id=prediction.third_place,
                    fourth_place_team_id=prediction.fourth_place
                )
                
                if existing_result:
                    print(f"  ✅ Updated result for group {group.name}")
                    updated_count += 1
                else:
                    print(f"  ✅ Created result for group {group.name}")
                    created_count += 1
                    
            except ValueError as e:
                print(f"  ❌ Validation error: {e}")
                error_count += 1
            except Exception as e:
                print(f"  ❌ Error creating result: {e}")
                error_count += 1
                db.rollback()
        
        # Summary
        print("\n" + "=" * 50)
        print("Summary:")
        print("=" * 50)
        print(f"✅ Created: {created_count}")
        print(f"🔄 Updated: {updated_count}")
        print(f"⚠️  Skipped: {skipped_count}")
        print(f"❌ Errors: {error_count}")
        print(f"📊 Total groups: {len(groups)}")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description='Create group stage results from user predictions'
    )
    parser.add_argument(
        '--user-id',
        type=int,
        default=1,
        help='User ID whose predictions to use (default: 1)'
    )
    parser.add_argument(
        '--update-existing',
        action='store_true',
        help='Update existing results instead of skipping them'
    )
    
    args = parser.parse_args()
    
    print("=" * 50)
    print("Create Group Stage Results from Predictions")
    print("=" * 50)
    print(f"User ID: {args.user_id}")
    print(f"Update existing: {args.update_existing}")
    print("=" * 50)
    
    create_results_from_predictions(
        user_id=args.user_id,
        update_existing=args.update_existing
    )


if __name__ == "__main__":
    main()

