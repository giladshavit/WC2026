#!/usr/bin/env python3
"""
Script to create random group stage results.

This script randomly assigns positions 1-4 to teams in each group,
completely independent of any predictions.
"""

import sys
import os
import argparse
import random

# Point to backend root: utils -> backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.groups import Group
from models.results import GroupStageResult
from models.team import Team
from services.results_service import ResultsService


def create_random_results(update_existing: bool = False, seed: int = None):
    """
    Create random group stage results by randomly shuffling teams in each group.
    
    Args:
        update_existing: If True, update existing results. If False, skip groups with existing results.
        seed: Random seed for reproducibility (optional)
    """
    if seed is not None:
        random.seed(seed)
        print(f"Using random seed: {seed}")
    
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
            
            # Get teams in this group
            teams = [
                group.team_1_obj,
                group.team_2_obj,
                group.team_3_obj,
                group.team_4_obj
            ]
            
            # Filter out None values (just in case)
            teams = [team for team in teams if team is not None]
            
            if len(teams) != 4:
                print(f"  ❌ Group {group.name} has {len(teams)} teams instead of 4")
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
            
            # Shuffle teams randomly
            shuffled_teams = teams.copy()
            random.shuffle(shuffled_teams)
            
            # Assign positions
            first_place = shuffled_teams[0].id
            second_place = shuffled_teams[1].id
            third_place = shuffled_teams[2].id
            fourth_place = shuffled_teams[3].id
            
            print(f"  🎲 Random assignment:")
            print(f"     1st: {shuffled_teams[0].name}")
            print(f"     2nd: {shuffled_teams[1].name}")
            print(f"     3rd: {shuffled_teams[2].name}")
            print(f"     4th: {shuffled_teams[3].name}")
            
            try:
                # Create or update result
                result = ResultsService.update_group_stage_result(
                    db=db,
                    group_id=group.id,
                    first_place_team_id=first_place,
                    second_place_team_id=second_place,
                    third_place_team_id=third_place,
                    fourth_place_team_id=fourth_place
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
        description='Create random group stage results by randomly shuffling teams in each group'
    )
    parser.add_argument(
        '--update-existing',
        action='store_true',
        help='Update existing results instead of skipping them'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=None,
        help='Random seed for reproducibility (optional)'
    )
    
    args = parser.parse_args()
    
    print("=" * 50)
    print("Create Random Group Stage Results")
    print("=" * 50)
    print(f"Update existing: {args.update_existing}")
    if args.seed:
        print(f"Random seed: {args.seed}")
    print("=" * 50)
    
    create_random_results(
        update_existing=args.update_existing,
        seed=args.seed
    )


if __name__ == "__main__":
    main()

