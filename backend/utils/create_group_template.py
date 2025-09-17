#!/usr/bin/env python3
"""
Script to create GroupTemplate with group to round32 matches mapping
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.group_template import GroupTemplate

def create_group_template():
    """
    Creates GroupTemplate table with group to round32 matches mapping
    """
    db = SessionLocal()
    
    try:
        # Delete existing data
        db.query(GroupTemplate).delete()
        
        # Mapping based on the provided table
        group_mappings = [
            ("A", 79, 73),  # A: first_place -> 79, second_place -> 73
            ("B", 85, 73),  # B: first_place -> 85, second_place -> 73
            ("C", 76, 75),  # C: first_place -> 76, second_place -> 75
            ("D", 81, 88),  # D: first_place -> 81, second_place -> 88
            ("E", 74, 78),  # E: first_place -> 74, second_place -> 78
            ("F", 75, 76),  # F: first_place -> 75, second_place -> 76
            ("G", 82, 88),  # G: first_place -> 82, second_place -> 88
            ("H", 84, 86),  # H: first_place -> 84, second_place -> 86
            ("I", 77, 78),  # I: first_place -> 77, second_place -> 78
            ("J", 86, 84),  # J: first_place -> 86, second_place -> 84
            ("K", 87, 83),  # K: first_place -> 87, second_place -> 83
            ("L", 80, 83),  # L: first_place -> 80, second_place -> 83
        ]
        
        print("🔧 Creating GroupTemplate with group to round32 matches mapping...")
        
        for group_name, first_place_match_id, second_place_match_id in group_mappings:
            group_template = GroupTemplate(
                group_name=group_name,
                first_place_match_id=first_place_match_id,
                second_place_match_id=second_place_match_id
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
