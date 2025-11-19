#!/usr/bin/env python3
"""
Create KnockoutStageResult records for MatchTemplate records
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult

def create_knockout_results_for_templates():
    """Create KnockoutStageResult records for all MatchTemplate records"""
    
    db = SessionLocal()
    try:
        # Get all knockout templates
        templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])
        ).order_by(MatchTemplate.id).all()
        
        print(f"Found {len(templates)} knockout templates")
        
        # Create results
        results_created = 0
        for i, template in enumerate(templates, 1):
            # Check if result already exists
            existing = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.match_id == template.id
            ).first()
            
            if not existing:
                result = KnockoutStageResult(
                    id=i,
                    match_id=template.id,
                    team_1=None,
                    team_2=None,
                    winner_team_id=None
                )
                db.add(result)
                results_created += 1
                print(f"Created result ID {i} for template match_id {template.id} ({template.stage})")
            else:
                print(f"Result already exists for template match_id {template.id}")
        
        db.commit()
        print(f"\n✅ Created {results_created} new KnockoutStageResult records!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_knockout_results_for_templates()

