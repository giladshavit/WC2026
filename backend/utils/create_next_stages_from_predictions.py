#!/usr/bin/env python3
"""
Create next stage predictions (round16, quarter, etc.) from existing predictions with winners
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.predictions import KnockoutStagePrediction
from models.matches_template import MatchTemplate
from services.predictions.knockout_prediction_service import KnockoutPredictionService
from services.database import DBReader, DBUtils

user_id = 1
if len(sys.argv) >= 2 and sys.argv[1].isdigit():
    user_id = int(sys.argv[1])

def create_next_stages_from_predictions():
    """Create next stage predictions from existing predictions with winners"""
    
    db = SessionLocal()
    try:
        print(f"🏆 Creating next stage predictions for user_id={user_id}...")
        
        # Get all predictions with winners, ordered by stage
        predictions = DBReader.get_knockout_predictions_by_user(db, user_id)
        predictions = [p for p in predictions if p.winner_team_id is not None]
        predictions.sort(key=lambda p: p.template_match_id)
        
        print(f"Found {len(predictions)} predictions with winners")
        
        created_count = 0
        
        for prediction in predictions:
            # Get the template for this prediction
            template = DBReader.get_match_template(db, prediction.template_match_id)
            
            if not template:
                print(f"  ⚠️  Template not found for match_id {prediction.template_match_id}")
                continue
            
            # Check if this prediction has a next stage
            if not template.winner_next_knockout_match:
                continue
            
            # Try to create next stage prediction
            next_prediction = KnockoutPredictionService._create_next_stage_if_needed(
                db, prediction, template, is_draft=False
            )
            
            if next_prediction:
                created_count += 1
                next_template = DBReader.get_match_template(db, next_prediction.template_match_id)
                print(f"  ✅ Created {next_template.stage} prediction (match_id {next_prediction.template_match_id})")
        
        DBUtils.commit(db)
        print(f"\n✅ Created {created_count} next stage predictions!")
        
    except Exception as e:
        DBUtils.rollback(db)
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_next_stages_from_predictions()

