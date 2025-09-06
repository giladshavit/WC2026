import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import sessionmaker
# Change to the backend directory to fix imports
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database import engine
from models.team import Team
from models.matches import Match

def create_group_matches():
    """יוצר את כל המשחקים בשלב הבתים"""
    print("יוצר משחקי בתים...")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # מביא את כל הקבוצות מסודרות לפי בית ומיקום
        teams = db.query(Team).filter(Team.group_letter.isnot(None)).order_by(Team.group_letter, Team.group_position).all()
        
        if not teams:
            print("לא נמצאו קבוצות עם הקצאת בתים!")
            return
        
        # מקובץ לפי בתים
        groups = {}
        for team in teams:
            if team.group_letter not in groups:
                groups[team.group_letter] = []
            groups[team.group_letter].append(team)
        
        print(f"נמצאו {len(groups)} בתים:")
        for group_name, group_teams in groups.items():
            print(f"  בית {group_name}: {[team.name for team in group_teams]}")
        
        # יוצר משחקים
        matches = []
        base_date = datetime(2026, 6, 15, 20, 0)  # 15 ביוני 2026, 20:00
        
        for group_name, group_teams in groups.items():
            print(f"\nיוצר משחקים לבית {group_name}:")
            
            # עם 4 קבוצות, יש 6 משחקים ב-3 מחזורים
            # מחזור 1: משחקים 1-2
            # מחזור 2: משחקים 3-4  
            # מחזור 3: משחקים 5-6
            
            # מחזור 1: קבוצה 1 vs קבוצה 2, קבוצה 3 vs קבוצה 4
            match1 = Match(
                stage="group",
                home_team_id=group_teams[0].id,
                away_team_id=group_teams[1].id,
                group=group_name,
                date=base_date,
                status="scheduled"
            )
            matches.append(match1)
            print(f"  מחזור 1: {group_teams[0].name} vs {group_teams[1].name}")
            
            match2 = Match(
                stage="group",
                home_team_id=group_teams[2].id,
                away_team_id=group_teams[3].id,
                group=group_name,
                date=base_date + timedelta(days=1),
                status="scheduled"
            )
            matches.append(match2)
            print(f"  מחזור 1: {group_teams[2].name} vs {group_teams[3].name}")
            
            # מחזור 2: קבוצה 1 vs קבוצה 3, קבוצה 2 vs קבוצה 4
            match3 = Match(
                stage="group",
                home_team_id=group_teams[0].id,
                away_team_id=group_teams[2].id,
                group=group_name,
                date=base_date + timedelta(days=3),
                status="scheduled"
            )
            matches.append(match3)
            print(f"  מחזור 2: {group_teams[0].name} vs {group_teams[2].name}")
            
            match4 = Match(
                stage="group",
                home_team_id=group_teams[1].id,
                away_team_id=group_teams[3].id,
                group=group_name,
                date=base_date + timedelta(days=4),
                status="scheduled"
            )
            matches.append(match4)
            print(f"  מחזור 2: {group_teams[1].name} vs {group_teams[3].name}")
            
            # מחזור 3: קבוצה 1 vs קבוצה 4, קבוצה 2 vs קבוצה 3
            match5 = Match(
                stage="group",
                home_team_id=group_teams[0].id,
                away_team_id=group_teams[3].id,
                group=group_name,
                date=base_date + timedelta(days=6),
                status="scheduled"
            )
            matches.append(match5)
            print(f"  מחזור 3: {group_teams[0].name} vs {group_teams[3].name}")
            
            match6 = Match(
                stage="group",
                home_team_id=group_teams[1].id,
                away_team_id=group_teams[2].id,
                group=group_name,
                date=base_date + timedelta(days=7),
                status="scheduled"
            )
            matches.append(match6)
            print(f"  מחזור 3: {group_teams[1].name} vs {group_teams[2].name}")
            
            # מעביר לתאריך הבא לבית הבא
            base_date += timedelta(days=10)
        
        # מוסיף את כל המשחקים לבסיס הנתונים
        print(f"\nמוסיף {len(matches)} משחקים לבסיס הנתונים...")
        for match in matches:
            db.add(match)
        
        db.commit()
        print(f"נוצרו {len(matches)} משחקי בתים בהצלחה!")
        
        # בודק כמה משחקים נוצרו
        total_matches = db.query(Match).filter(Match.stage == "group").count()
        print(f"סה\"כ משחקי בתים בבסיס הנתונים: {total_matches}")
        
    except Exception as e:
        print(f"שגיאה: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_group_matches()