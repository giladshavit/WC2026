#!/usr/bin/env python3
"""
סקריפט ליצירת משחקי הבתים (matches) על בסיס matches_template
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from models.matches import Match
from models.matches_template import MatchTemplate
from models.team import Team
from sqlalchemy.orm import sessionmaker

def create_group_matches():
    """יוצר את משחקי הבתים על בסיס matches_template"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # יוצר את הטבלה אם היא לא קיימת
        Match.__table__.create(engine, checkfirst=True)
        
        # מוחק את כל המשחקים הקיימים
        session.query(Match).delete()
        
        # מביא את כל משחקי הבתים מ-matches_template
        group_templates = session.query(MatchTemplate).filter(MatchTemplate.stage == "group").all()
        
        print(f"נמצאו {len(group_templates)} משחקי בתים ב-template")
        
        # יוצר מיפוי של קבוצות לפי שם ומיקום
        teams_mapping = {}
        teams = session.query(Team).all()
        
        # יוצר מיפוי: "A1" -> team_id
        for team in teams:
            key = f"{team.group_letter}{team.group_position}"
            teams_mapping[key] = team.id
        
        print(f"נוצר מיפוי של {len(teams_mapping)} קבוצות")
        
        # יוצר את משחקי הבתים
        matches_created = 0
        for template in group_templates:
            # מוצא את ה-team_id עבור team_1 ו-team_2
            team_1_id = teams_mapping.get(template.team_1)
            team_2_id = teams_mapping.get(template.team_2)
            
            if team_1_id and team_2_id:
                match = Match(
                    id=template.id,  # שומר על אותו ID כמו ב-template
                    stage=template.stage,
                    home_team_id=team_1_id,
                    away_team_id=team_2_id,
                    status=template.status,
                    date=template.date,
                    group=template.group,
                    match_number=template.id  # משתמש ב-ID כמספר משחק
                )
                session.add(match)
                matches_created += 1
            else:
                print(f"שגיאה: לא נמצאו קבוצות עבור {template.team_1} או {template.team_2}")
        
        session.commit()
        print(f"נוצרו {matches_created} משחקי בתים בהצלחה!")
        
        # מציג סיכום
        print("\nסיכום משחקי בתים שנוצרו:")
        print("=" * 50)
        
        # מציג לפי בתים
        for group in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            group_matches = session.query(Match).filter(Match.group == group).order_by(Match.id).all()
            print(f"\nבית {group}:")
            for match in group_matches:
                home_team = session.query(Team).filter(Team.id == match.home_team_id).first()
                away_team = session.query(Team).filter(Team.id == match.away_team_id).first()
                print(f"  ID {match.id}: {home_team.name} vs {away_team.name}")
        
        # מציג כמה דוגמאות
        print("\nדוגמאות למשחקים:")
        sample_matches = session.query(Match).limit(6).all()
        for match in sample_matches:
            home_team = session.query(Team).filter(Team.id == match.home_team_id).first()
            away_team = session.query(Team).filter(Team.id == match.away_team_id).first()
            print(f"ID {match.id}: {home_team.name} vs {away_team.name} (בית {match.group})")
        
    except Exception as e:
        session.rollback()
        print(f"שגיאה ביצירת משחקי הבתים: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_group_matches()
