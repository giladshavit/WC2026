#!/usr/bin/env python3
"""
Script to create random group stage predictions for a user.
"""

import sys
import os
import random

# Point to backend root: utils -> backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.groups import Group
from models.predictions import GroupStagePrediction
from models.team import Team


def create_random_group_predictions(user_id: int, seed: int = None):
    """
    Create random group stage predictions by randomly shuffling teams in each group.
    
    Args:
        user_id: The user ID to create predictions for
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
                continue
            
            # Shuffle teams randomly
            shuffled_teams = teams.copy()
            random.shuffle(shuffled_teams)
            
            # Assign positions
            first_place = shuffled_teams[0].id
            second_place = shuffled_teams[1].id
            third_place = shuffled_teams[2].id
            fourth_place = shuffled_teams[3].id
            
            print(f"  🎲 Random prediction:")
            print(f"     1st: {shuffled_teams[0].name}")
            print(f"     2nd: {shuffled_teams[1].name}")
            print(f"     3rd: {shuffled_teams[2].name}")
            print(f"     4th: {shuffled_teams[3].name}")
            
            # Check if prediction already exists
            existing_prediction = db.query(GroupStagePrediction).filter(
                GroupStagePrediction.user_id == user_id,
                GroupStagePrediction.group_id == group.id
            ).first()
            
            if existing_prediction:
                # Update existing prediction
                existing_prediction.first_place = first_place
                existing_prediction.second_place = second_place
                existing_prediction.third_place = third_place
                existing_prediction.fourth_place = fourth_place
                print(f"  ✅ Updated prediction for group {group.name}")
                updated_count += 1
            else:
                # Create new prediction
                prediction = GroupStagePrediction(
                    user_id=user_id,
                    group_id=group.id,
                    first_place=first_place,
                    second_place=second_place,
                    third_place=third_place,
                    fourth_place=fourth_place
                )
                db.add(prediction)
                print(f"  ✅ Created prediction for group {group.name}")
                created_count += 1
        
        # Commit all changes
        db.commit()
        
        # Summary
        print("\n" + "=" * 50)
        print("Summary:")
        print("=" * 50)
        print(f"✅ Created: {created_count}")
        print(f"🔄 Updated: {updated_count}")
        print(f"📊 Total groups: {len(groups)}")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    user_id = 4
    if len(sys.argv) >= 2 and sys.argv[1].isdigit():
        user_id = int(sys.argv[1])
    
    seed = None
    if len(sys.argv) >= 3 and sys.argv[2].isdigit():
        seed = int(sys.argv[2])
    
    print("=" * 50)
    print("Create Random Group Stage Predictions")
    print("=" * 50)
    print(f"User ID: {user_id}")
    if seed:
        print(f"Random seed: {seed}")
    print("=" * 50)
    
    create_random_group_predictions(user_id, seed)





