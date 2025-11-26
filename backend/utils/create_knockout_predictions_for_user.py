#!/usr/bin/env python3
"""
Temporary script to create empty knockout predictions for a specific user.
Usage: python utils/create_knockout_predictions_for_user.py <user_id>
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult
from models.predictions import KnockoutStagePrediction
from models.user import User

def create_knockout_predictions_for_user(user_id: int):
    """Create empty knockout prediction records for a specific user."""
    
    db = SessionLocal()
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"❌ User {user_id} not found!")
            return
        
        print(f"Creating knockout predictions for user {user_id} ({user.name})...")
        
        # Delete all existing knockout predictions for this user
        existing_predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).all()
        
        deleted_count = len(existing_predictions)
        if deleted_count > 0:
            print(f"Deleting {deleted_count} existing knockout predictions...")
            for prediction in existing_predictions:
                db.delete(prediction)
            db.commit()
            print(f"✅ Deleted {deleted_count} existing predictions")
        
        # Get all knockout match templates
        knockout_templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])
        ).order_by(MatchTemplate.id).all()
        
        print(f"Found {len(knockout_templates)} knockout templates")
        
        created_count = 0
        skipped_count = 0
        
        for template in knockout_templates:
            
            # Find the corresponding KnockoutStageResult
            knockout_result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.match_id == template.id
            ).first()
            
            if not knockout_result:
                print(f"  ⚠️  KnockoutStageResult not found for match_id {template.id} ({template.stage})")
                skipped_count += 1
                continue
            
            # Create empty prediction (no teams, no winner)
            prediction = KnockoutStagePrediction(
                user_id=user_id,
                knockout_result_id=knockout_result.id,
                template_match_id=template.id,
                stage=template.stage,
                team1_id=None,
                team2_id=None,
                winner_team_id=None,
                status="gray",  # Default status
                is_editable=True
            )
            
            db.add(prediction)
            created_count += 1
            print(f"  ✅ Created prediction for match {template.id} ({template.stage})")
        
        db.commit()
        print(f"\n✅ Successfully created {created_count} empty knockout predictions for user {user_id}")
        if skipped_count > 0:
            print(f"   Skipped {skipped_count} (missing result)")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python utils/create_knockout_predictions_for_user.py <user_id>")
        sys.exit(1)
    
    user_id = int(sys.argv[1])
    create_knockout_predictions_for_user(user_id)

