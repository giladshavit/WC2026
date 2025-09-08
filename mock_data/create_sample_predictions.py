#!/usr/bin/env python3
"""
Create sample predictions for testing the bracket building script
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models.predictions import GroupStagePrediction
from backend.models.groups import Group
from backend.models.team import Team

def create_sample_predictions():
    """יוצר ניחושים לדוגמה"""
    db = SessionLocal()
    try:
        # מקבל את הבתים
        groups = db.query(Group).all()
        print(f"נמצאו {len(groups)} בתים")
        
        for group in groups:
            print(f"בית {group.name}: {[team.name for team in group.teams]}")
            
            # יוצר ניחוש לדוגמה (סדר אקראי)
            teams = group.teams
            if len(teams) >= 4:
                prediction = GroupStagePrediction(
                    user_id=1,
                    group_id=group.id,
                    first_place=teams[0].id,
                    second_place=teams[1].id,
                    third_place=teams[2].id,
                    fourth_place=teams[3].id
                )
                
                # בודק אם כבר קיים
                existing = db.query(GroupStagePrediction).filter_by(
                    user_id=1,
                    group_id=group.id
                ).first()
                
                if not existing:
                    db.add(prediction)
                    print(f"נוצר ניחוש לבית {group.name}")
                else:
                    print(f"ניחוש לבית {group.name} כבר קיים")
        
        db.commit()
        print("ניחושים נוצרו בהצלחה!")
        
    except Exception as e:
        db.rollback()
        print(f"שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_predictions()
