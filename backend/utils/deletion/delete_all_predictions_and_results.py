#!/usr/bin/env python3
"""
Script to delete all predictions and results.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction, KnockoutStagePredictionDraft
from models.results import MatchResult, GroupStageResult, ThirdPlaceResult, KnockoutStageResult

def delete_all():
    """Delete all predictions and results."""
    
    db = SessionLocal()
    
    try:
        print("🗑️  Starting deletion of all predictions and results...")
        
        # Delete predictions (with error handling for missing tables)
        print("\n📋 Deleting predictions...")
        deleted_match = 0
        deleted_group = 0
        deleted_third_place = 0
        deleted_knockout = 0
        deleted_knockout_draft = 0
        
        try:
            deleted_match = db.query(MatchPrediction).delete()
            print(f"  ✅ Deleted {deleted_match} match predictions")
        except Exception as e:
            print(f"  ⚠️  No match_predictions table or error: {e}")
        
        try:
            deleted_group = db.query(GroupStagePrediction).delete()
            print(f"  ✅ Deleted {deleted_group} group stage predictions")
        except Exception as e:
            print(f"  ⚠️  No group_stage_predictions table or error: {e}")
        
        try:
            deleted_third_place = db.query(ThirdPlacePrediction).delete()
            print(f"  ✅ Deleted {deleted_third_place} third place predictions")
        except Exception as e:
            print(f"  ⚠️  No third_place_predictions table or error: {e}")
        
        try:
            deleted_knockout = db.query(KnockoutStagePrediction).delete()
            print(f"  ✅ Deleted {deleted_knockout} knockout stage predictions")
        except Exception as e:
            print(f"  ⚠️  No knockout_stage_predictions table or error: {e}")
        
        try:
            deleted_knockout_draft = db.query(KnockoutStagePredictionDraft).delete()
            print(f"  ✅ Deleted {deleted_knockout_draft} knockout stage draft predictions")
        except Exception as e:
            print(f"  ⚠️  No knockout_stage_predictions_draft table or error: {e}")
        
        # Delete results (with error handling for missing tables)
        print("\n📊 Deleting results...")
        deleted_match_results = 0
        deleted_group_results = 0
        deleted_third_place_results = 0
        deleted_knockout_results = 0
        
        try:
            deleted_match_results = db.query(MatchResult).delete()
            print(f"  ✅ Deleted {deleted_match_results} match results")
        except Exception as e:
            print(f"  ⚠️  No match_results table or error: {e}")
        
        try:
            deleted_group_results = db.query(GroupStageResult).delete()
            print(f"  ✅ Deleted {deleted_group_results} group stage results")
        except Exception as e:
            print(f"  ⚠️  No group_stage_results table or error: {e}")
        
        try:
            deleted_third_place_results = db.query(ThirdPlaceResult).delete()
            print(f"  ✅ Deleted {deleted_third_place_results} third place results")
        except Exception as e:
            print(f"  ⚠️  No third_place_results table or error: {e}")
        
        try:
            deleted_knockout_results = db.query(KnockoutStageResult).delete()
            print(f"  ✅ Deleted {deleted_knockout_results} knockout stage results")
        except Exception as e:
            print(f"  ⚠️  No knockout_stage_results table or error: {e}")
        
        # Commit the changes
        db.commit()
        
        total_predictions = deleted_match + deleted_group + deleted_third_place + deleted_knockout + deleted_knockout_draft
        total_results = deleted_match_results + deleted_group_results + deleted_third_place_results + deleted_knockout_results
        
        print(f"\n🎉 Successfully deleted:")
        print(f"  - {total_predictions} predictions")
        print(f"  - {total_results} results")
        print(f"  - Total: {total_predictions + total_results} records")
        
    except Exception as e:
        print(f"❌ Error occurred: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    delete_all()

