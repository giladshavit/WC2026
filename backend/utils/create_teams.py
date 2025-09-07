#!/usr/bin/env python3
"""
סקריפט ליצירת הקבוצות (teams) מהטבלה של גוגל שיטס
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import pandas as pd
from io import StringIO
from database import engine
from models.team import Team
from sqlalchemy.orm import sessionmaker

def create_teams():
    """יוצר את כל הקבוצות מהטבלה של גוגל שיטס"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # יוצר את הטבלה אם היא לא קיימת
        Team.__table__.create(engine, checkfirst=True)
        
        # מוחק את כל הקבוצות הקיימות
        session.query(Team).delete()
        
        # קורא את הנתונים מהגוגל שיטס
        print("קורא נתונים מהגוגל שיטס...")
        google_sheet_url = "https://docs.google.com/spreadsheets/d/1D9zV9rivLeDUql_6bMvFEdZ3gOpMnG015WNL9iGfX4g/export?format=csv&gid=255491779&range=A2:L5"
        
        try:
            response = requests.get(google_sheet_url)
            response.raise_for_status()
            
            # קורא את ה-CSV
            df = pd.read_csv(StringIO(response.text))
            print(f"נקראו {len(df)} שורות מהגוגל שיטס")
            print(f"עמודות: {list(df.columns)}")
            
            print("כל השורות:")
            for i, row in df.iterrows():
                print(f"שורה {i}: {list(row)}")
            
            # יוצר את רשימת הקבוצות בצורה גנרית
            teams_data = []
            team_id = 1
            
            # לולאה על הבתים (עמודות) - A עד L
            for group_index, group_letter in enumerate(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']):
                # מיקומים 2-4 - מהשורות
                for position in range(4):  # 0-2 (שורות 2-4)
                    if group_index < len(df.columns) and position < len(df):
                        team_name = df.iloc[position-1, group_index]
                        if pd.notna(team_name) and str(team_name).strip():
                            teams_data.append({
                                "id": team_id,
                                "name": str(team_name).strip(),
                                "group": group_letter,
                                "position": position + 2  # המיקום הוא 2-4
                            })
                            team_id += 1
            
            print(f"עובדו {len(teams_data)} קבוצות מהנתונים")
            
        except Exception as e:
            print(f"שגיאה בקריאת הגוגל שיטס: {e}")
            return
        
        # יוצר את הקבוצות
        for team_data in teams_data:
            team = Team(
                id=team_data["id"],
                name=team_data["name"],
                group_letter=team_data["group"],
                group_position=team_data["position"]
            )
            session.add(team)
        
        session.commit()
        print(f"נוצרו {len(teams_data)} קבוצות בהצלחה!")
        
        # מציג סיכום
        print("\nסיכום קבוצות שנוצרו:")
        print("=" * 50)
        for group in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            group_teams = [t for t in teams_data if t["group"] == group]
            print(f"בית {group}: {', '.join([t['name'] for t in group_teams])}")
        
        # מציג כמה דוגמאות
        print("\nדוגמאות לקבוצות:")
        sample_teams = session.query(Team).limit(8).all()
        for team in sample_teams:
            print(f"ID {team.id}: {team.name} (בית {team.group_letter}, מיקום {team.group_position})")
        
    except Exception as e:
        session.rollback()
        print(f"שגיאה ביצירת הקבוצות: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_teams()
