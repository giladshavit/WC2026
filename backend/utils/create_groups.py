#!/usr/bin/env python3
"""
סקריפט ליצירת הבתים (groups)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from models.groups import Group
from models.team import Team
from sqlalchemy.orm import sessionmaker

def create_groups():
    """יוצר את כל הבתים"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # יוצר את הטבלה אם היא לא קיימת
        Group.__table__.create(engine, checkfirst=True)
        
        # מוחק את כל הבתים הקיימים
        session.query(Group).delete()
        
        # מביא את כל הקבוצות
        teams = session.query(Team).all()
        print(f"נמצאו {len(teams)} קבוצות")
        
        # יוצר את הבתים עם הקבוצות
        for group_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            # מביא את 4 הקבוצות של הבית הזה
            group_teams = [team for team in teams if team.group_letter == group_letter]
            group_teams.sort(key=lambda x: x.group_position)  # ממיין לפי מיקום
            
            if len(group_teams) == 4:
                group = Group(
                    id=ord(group_letter) - ord('A') + 1,  # A=1, B=2, etc.
                    name=group_letter,
                    team_1=group_teams[0].id,
                    team_2=group_teams[1].id,
                    team_3=group_teams[2].id,
                    team_4=group_teams[3].id
                )
                session.add(group)
                print(f"בית {group_letter}: {group_teams[0].name}, {group_teams[1].name}, {group_teams[2].name}, {group_teams[3].name}")
            else:
                print(f"שגיאה: בית {group_letter} מכיל {len(group_teams)} קבוצות במקום 4")
        
        session.commit()
        print(f"נוצרו 12 בתים בהצלחה!")
        
        # מציג סיכום
        print("\nסיכום בתים שנוצרו:")
        print("=" * 30)
        for group_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            group_id = ord(group_letter) - ord('A') + 1
            print(f"בית {group_letter} (ID: {group_id})")
        
    except Exception as e:
        session.rollback()
        print(f"שגיאה ביצירת הבתים: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_groups()
