#!/usr/bin/env python3
"""
Script to create GroupTemplate with group to round32 matches mapping
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))

from database import SessionLocal
from models.group_template import GroupTemplate

def create_group_template():
    """
    Creates GroupTemplate table with group to round32 matches mapping
    """
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing_count = db.query(GroupTemplate).count()
        if existing_count > 0:
            print(f"⚠️  GroupTemplate already has {existing_count} records. Skipping creation.")
            return
        
        # Delete existing data (just in case)
        db.query(GroupTemplate).delete()
        
        # (group_name, first_place_match_id, second_place_match_id, first_place_team_slot, second_place_team_slot)
        # Slots derived from match_templates: if group's team is team_1 in the match → slot=1, team_2 → slot=2
        group_mappings = [
            ("A", 79, 73, 1, 1),
            ("B", 85, 73, 1, 2),
            ("C", 76, 75, 1, 2),
            ("D", 81, 88, 1, 1),
            ("E", 74, 78, 1, 1),
            ("F", 75, 76, 1, 2),
            ("G", 82, 88, 1, 2),
            ("H", 84, 86, 1, 2),
            ("I", 77, 78, 1, 2),
            ("J", 86, 84, 1, 2),
            ("K", 87, 83, 1, 1),
            ("L", 80, 83, 1, 2),
        ]
        
        print("🔧 Creating GroupTemplate with group to round32 matches mapping...")
        
        for group_name, first_place_match_id, second_place_match_id, first_slot, second_slot in group_mappings:
            group_template = GroupTemplate(
                group_name=group_name,
                first_place_match_id=first_place_match_id,
                second_place_match_id=second_place_match_id,
                first_place_team_slot=first_slot,
                second_place_team_slot=second_slot
            )
            db.add(group_template)
            print(f"  Created template for group {group_name}: first_place -> {first_place_match_id}, second_place -> {second_place_match_id}")
        
        db.commit()
        print(f"✅ Successfully created {len(group_mappings)} GroupTemplate records!")
        
    except Exception as e:
        print(f"❌ Error creating GroupTemplate: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_group_template()
