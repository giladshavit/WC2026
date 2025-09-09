#!/usr/bin/env python3
"""
Create sample predictions for testing the knockout bracket builder
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.predictions import GroupStagePrediction, ThirdPlacePrediction
from models.team import Team
from models.groups import Group

def create_sample_predictions():
    """יוצר ניחושים לדוגמה"""
    
    db = SessionLocal()
    try:
        print("🎯 יוצר ניחושים לדוגמה...")
        
        # מנקה ניחושים קיימים
        db.query(GroupStagePrediction).delete()
        db.query(ThirdPlacePrediction).delete()
        print("נוקו ניחושים קיימים")
        
        # יוצר ניחושי בתים (מניח שיש user_id = 1)
        user_id = 1
        groups = db.query(Group).all()
        
        print(f"יוצר ניחושי בתים עבור {len(groups)} בתים...")
        
        for group in groups:
            # לוקח את הקבוצות בסדר הנוכחי (1,2,3,4)
            teams = [group.team_1, group.team_2, group.team_3, group.team_4]
            
            prediction = GroupStagePrediction(
                user_id=user_id,
                group_id=group.id,
                first_place=teams[0],   # מקום 1
                second_place=teams[1],  # מקום 2
                third_place=teams[2],   # מקום 3
                fourth_place=teams[3]   # מקום 4
            )
            
            db.add(prediction)
            print(f"  בית {group.name}: {teams[0]}, {teams[1]}, {teams[2]}, {teams[3]}")
        
        # יוצר ניחוש עולות ממקום 3
        print("\n🥉 יוצר ניחוש עולות ממקום 3...")
        
        # לוקח את 8 הבתים הראשונים (A-H) כעולות ממקום 3
        qualifying_groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        qualifying_teams = []
        
        for group_name in qualifying_groups:
            group = db.query(Group).filter(Group.name == group_name).first()
            if group:
                # לוקח את הקבוצה במקום 3
                qualifying_teams.append(group.team_3)
        
        if len(qualifying_teams) == 8:
            third_place_prediction = ThirdPlacePrediction(
                user_id=user_id,
                first_team_qualifying=qualifying_teams[0],
                second_team_qualifying=qualifying_teams[1],
                third_team_qualifying=qualifying_teams[2],
                fourth_team_qualifying=qualifying_teams[3],
                fifth_team_qualifying=qualifying_teams[4],
                sixth_team_qualifying=qualifying_teams[5],
                seventh_team_qualifying=qualifying_teams[6],
                eighth_team_qualifying=qualifying_teams[7]
            )
            
            db.add(third_place_prediction)
            print(f"עולות ממקום 3: {qualifying_groups}")
        
        db.commit()
        print("\n✅ נוצרו ניחושים לדוגמה בהצלחה!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_predictions()

