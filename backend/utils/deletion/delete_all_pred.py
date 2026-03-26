#!/usr/bin/env python3
"""
Script to delete all predictions from all prediction tables.
This will remove all user predictions but keep the database structure intact.
"""

import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SQLALCHEMY_DATABASE_URL
from models.predictions import (
    BonusPrediction,
    KnockoutStagePredictionDraft,
    MatchPrediction,
    GroupStagePrediction,
    ThirdPlacePrediction,
    KnockoutStagePrediction,
)


def delete_all_predictions():
    """Delete all predictions from all prediction tables."""
    
    connect_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Starting deletion of all predictions...")
        
        # Count records before deletion
        bonus_pred_count = db.query(BonusPrediction).count()
        draft_count = db.query(KnockoutStagePredictionDraft).count()
        match_pred_count = db.query(MatchPrediction).count()
        group_pred_count = db.query(GroupStagePrediction).count()
        third_place_pred_count = db.query(ThirdPlacePrediction).count()
        knockout_pred_count = db.query(KnockoutStagePrediction).count()

        total_before = (
            bonus_pred_count
            + draft_count
            + match_pred_count
            + group_pred_count
            + third_place_pred_count
            + knockout_pred_count
        )

        print(f"Records to be deleted:")
        print(f"  - Bonus predictions: {bonus_pred_count}")
        print(f"  - Knockout draft rows: {draft_count}")
        print(f"  - Match predictions: {match_pred_count}")
        print(f"  - Group stage predictions: {group_pred_count}")
        print(f"  - Third place predictions: {third_place_pred_count}")
        print(f"  - Knockout stage predictions: {knockout_pred_count}")
        print(f"  - Total: {total_before}")
        
        if total_before == 0:
            print("No predictions found to delete.")
            return
        
        # Confirm deletion
        print(f"\nProceeding to delete all {total_before} prediction records...")
        
        # Delete all predictions (bonus/draft first — FKs to users/groups/teams/knockout)
        print("\nDeleting predictions...")

        deleted_bonus = db.query(BonusPrediction).delete()
        print(f"Deleted {deleted_bonus} bonus predictions")

        deleted_draft = db.query(KnockoutStagePredictionDraft).delete()
        print(f"Deleted {deleted_draft} knockout draft rows")

        # Delete match predictions
        deleted_match = db.query(MatchPrediction).delete()
        print(f"Deleted {deleted_match} match predictions")
        
        # Delete group stage predictions
        deleted_group = db.query(GroupStagePrediction).delete()
        print(f"Deleted {deleted_group} group stage predictions")
        
        # Delete third place predictions
        deleted_third_place = db.query(ThirdPlacePrediction).delete()
        print(f"Deleted {deleted_third_place} third place predictions")
        
        # Delete knockout stage predictions
        deleted_knockout = db.query(KnockoutStagePrediction).delete()
        print(f"Deleted {deleted_knockout} knockout stage predictions")
        
        # Commit the changes
        db.commit()
        
        total_deleted = (
            deleted_bonus
            + deleted_draft
            + deleted_match
            + deleted_group
            + deleted_third_place
            + deleted_knockout
        )
        print(f"\nSuccessfully deleted {total_deleted} prediction records.")

        # Verify deletion
        remaining_bonus = db.query(BonusPrediction).count()
        remaining_draft = db.query(KnockoutStagePredictionDraft).count()
        remaining_match = db.query(MatchPrediction).count()
        remaining_group = db.query(GroupStagePrediction).count()
        remaining_third_place = db.query(ThirdPlacePrediction).count()
        remaining_knockout = db.query(KnockoutStagePrediction).count()

        print(f"\nVerification - Remaining records:")
        print(f"  - Bonus predictions: {remaining_bonus}")
        print(f"  - Knockout draft rows: {remaining_draft}")
        print(f"  - Match predictions: {remaining_match}")
        print(f"  - Group stage predictions: {remaining_group}")
        print(f"  - Third place predictions: {remaining_third_place}")
        print(f"  - Knockout stage predictions: {remaining_knockout}")

        if (
            remaining_bonus
            + remaining_draft
            + remaining_match
            + remaining_group
            + remaining_third_place
            + remaining_knockout
            == 0
        ):
            print("✅ All predictions have been successfully deleted!")
        else:
            print("⚠️  Some predictions may still remain.")
            
    except Exception as e:
        print(f"Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_all_predictions()
