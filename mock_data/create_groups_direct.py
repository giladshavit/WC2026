#!/usr/bin/env python3
"""
Create groups directly in database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models.groups import Group
from backend.models.team import Team

def create_groups_direct():
    """יוצר בתים ישירות בבסיס הנתונים"""
    db = SessionLocal()
    try:
        # יוצר בתים A-L
        group_names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        
        # מקבל קבוצות
        teams = db.query(Team).all()
        print(f"נמצאו {len(teams)} קבוצות")
        
        # יוצר בתים עם 4 קבוצות כל אחד
        for i, group_name in enumerate(group_names):
            # בודק אם הבית כבר קיים
            existing = db.query(Group).filter_by(name=group_name).first()
            if not existing:
                # לוקח 4 קבוצות לבית
                start_idx = i * 4
                end_idx = start_idx + 4
                group_teams = teams[start_idx:end_idx]
                
                if len(group_teams) == 4:
                    group = Group(
                        name=group_name,
                        team_1=group_teams[0].id,
                        team_2=group_teams[1].id,
                        team_3=group_teams[2].id,
                        team_4=group_teams[3].id
                    )
                    db.add(group)
                    print(f"נוצר בית {group_name}: {[t.name for t in group_teams]}")
                else:
                    print(f"לא מספיק קבוצות לבית {group_name}")
            else:
                print(f"בית {group_name} כבר קיים")
        
        db.commit()
        print("בתים נוצרו בהצלחה!")
        
    except Exception as e:
        db.rollback()
        print(f"שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_groups_direct()
