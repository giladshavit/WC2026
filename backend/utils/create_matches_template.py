#!/usr/bin/env python3
"""
סקריפט ליצירת טבלת matches_template עם כל המשחקים
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from models.matches_template import MatchTemplate
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

def create_matches_template():
    """יוצר את טבלת matches_template עם כל המשחקים"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # יוצר את הטבלה אם היא לא קיימת
        MatchTemplate.__table__.create(engine, checkfirst=True)
        
        # מוחק את כל המשחקים הקיימים
        session.query(MatchTemplate).delete()
        
        # תאריכים בסיסיים
        group_stage_start = datetime(2026, 6, 15)  # 15 ביוני 2026
        knockout_start = datetime(2026, 7, 1)      # 1 ביולי 2026
        
        matches = []
        
        # ========================================
        # יצירת משחקי הבתים (72 משחקים)
        # ========================================
        
        groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        
        # מחזור 1 (24 משחקים) - ID 1-24
        for i, group in enumerate(groups):
            # A1 vs A2
            matches.append(MatchTemplate(
                id=1 + i*2,
                stage="group",
                team_1=f"{group}1",
                team_2=f"{group}2",
                status="scheduled",
                date=group_stage_start,
                group=group
            ))
            # A3 vs A4
            matches.append(MatchTemplate(
                id=2 + i*2,
                stage="group",
                team_1=f"{group}3",
                team_2=f"{group}4",
                status="scheduled",
                date=group_stage_start,
                group=group
            ))
        
        # מחזור 2 (24 משחקים) - ID 25-48
        for i, group in enumerate(groups):
            # A1 vs A3
            matches.append(MatchTemplate(
                id=25 + i*2,
                stage="group",
                team_1=f"{group}1",
                team_2=f"{group}3",
                status="scheduled",
                date=group_stage_start + timedelta(days=3),
                group=group
            ))
            # A4 vs A2
            matches.append(MatchTemplate(
                id=26 + i*2,
                stage="group",
                team_1=f"{group}4",
                team_2=f"{group}2",
                status="scheduled",
                date=group_stage_start + timedelta(days=3),
                group=group
            ))
        
        # מחזור 3 (24 משחקים) - ID 49-72
        for i, group in enumerate(groups):
            # A4 vs A1
            matches.append(MatchTemplate(
                id=49 + i*2,
                stage="group",
                team_1=f"{group}4",
                team_2=f"{group}1",
                status="scheduled",
                date=group_stage_start + timedelta(days=6),
                group=group
            ))
            # A2 vs A3
            matches.append(MatchTemplate(
                id=50 + i*2,
                stage="group",
                team_1=f"{group}2",
                team_2=f"{group}3",
                status="scheduled",
                date=group_stage_start + timedelta(days=6),
                group=group
            ))
        
        # ========================================
        # יצירת משחקי הנוקאאוט (32 משחקים)
        # ========================================
        
        # שלב 32 הגדולות (16 משחקים) - ID 73-88
        # התבנית צריכה להיות פשוטה - כל קבוצה ראשונה משחקת נגד קבוצה ממקום 3
        # הסדר הנכון: 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L
        round32_matches = [
            {"id": 73, "team_1": "2A", "team_2": "2B", "winner_destination": "90_1"},
            {"id": 74, "team_1": "1A", "team_2": "3rd_team_1", "winner_destination": "89_1"},
            {"id": 75, "team_1": "1F", "team_2": "2C", "winner_destination": "90_2"},
            {"id": 76, "team_1": "1C", "team_2": "2F", "winner_destination": "91_1"},
            {"id": 77, "team_1": "1B", "team_2": "3rd_team_2", "winner_destination": "89_2"},
            {"id": 78, "team_1": "2E", "team_2": "2I", "winner_destination": "91_2"},
            {"id": 79, "team_1": "1D", "team_2": "3rd_team_3", "winner_destination": "92_1"},
            {"id": 80, "team_1": "1E", "team_2": "3rd_team_4", "winner_destination": "92_2"},
            {"id": 81, "team_1": "1G", "team_2": "3rd_team_5", "winner_destination": "94_1"},
            {"id": 82, "team_1": "1I", "team_2": "3rd_team_6", "winner_destination": "94_2"},
            {"id": 83, "team_1": "2K", "team_2": "2L", "winner_destination": "93_1"},
            {"id": 84, "team_1": "1H", "team_2": "2J", "winner_destination": "93_2"},
            {"id": 85, "team_1": "1K", "team_2": "3rd_team_7", "winner_destination": "96_1"},
            {"id": 86, "team_1": "1J", "team_2": "2H", "winner_destination": "95_1"},
            {"id": 87, "team_1": "1L", "team_2": "3rd_team_8", "winner_destination": "96_2"},
            {"id": 88, "team_1": "2D", "team_2": "2G", "winner_destination": "95_2"}
        ]
        
        for match_data in round32_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="round32",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=(match_data["id"] - 73) // 2),
                winner_destination=match_data["winner_destination"]
            ))
        
        # שלב 16 הגדולות (8 משחקים) - ID 89-96
        round16_matches = [
            {"id": 89, "team_1": "Winner_M74", "team_2": "Winner_M77", "winner_destination": "97_1"},
            {"id": 90, "team_1": "Winner_M73", "team_2": "Winner_M75", "winner_destination": "97_2"},
            {"id": 91, "team_1": "Winner_M76", "team_2": "Winner_M78", "winner_destination": "99_1"},
            {"id": 92, "team_1": "Winner_M79", "team_2": "Winner_M80", "winner_destination": "99_2"},
            {"id": 93, "team_1": "Winner_M83", "team_2": "Winner_M84", "winner_destination": "98_1"},
            {"id": 94, "team_1": "Winner_M81", "team_2": "Winner_M82", "winner_destination": "98_2"},
            {"id": 95, "team_1": "Winner_M86", "team_2": "Winner_M88", "winner_destination": "100_1"},
            {"id": 96, "team_1": "Winner_M85", "team_2": "Winner_M87", "winner_destination": "100_2"}
        ]
        
        for match_data in round16_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="round16",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=8 + (match_data["id"] - 89) // 2),
                winner_destination=match_data["winner_destination"]
            ))
        
        # רבעי גמר (4 משחקים) - ID 97-100
        quarter_matches = [
            {"id": 97, "team_1": "Winner_M89", "team_2": "Winner_M90", "winner_destination": "101_1"},
            {"id": 98, "team_1": "Winner_M93", "team_2": "Winner_M94", "winner_destination": "101_2"},
            {"id": 99, "team_1": "Winner_M91", "team_2": "Winner_M92", "winner_destination": "102_1"},
            {"id": 100, "team_1": "Winner_M95", "team_2": "Winner_M96", "winner_destination": "102_2"}
        ]
        
        for match_data in quarter_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="quarter",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=12 + (match_data["id"] - 97)),
                winner_destination=match_data["winner_destination"]
            ))
        
        # חצאי גמר (2 משחקים) - ID 101-102
        semi_matches = [
            {"id": 101, "team_1": "Winner_M97", "team_2": "Winner_M98", "winner_destination": "104_1"},
            {"id": 102, "team_1": "Winner_M99", "team_2": "Winner_M100", "winner_destination": "104_2"}
        ]
        
        for match_data in semi_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="semi",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=16 + (match_data["id"] - 101)),
                winner_destination=match_data["winner_destination"]
            ))
        
        # קרב על מקום 3 - ID 103
        matches.append(MatchTemplate(
            id=103,
            stage="third_place",
            team_1="Runner_up_M101",
            team_2="Runner_up_M102",
            status="scheduled",
            date=knockout_start + timedelta(days=18),
            winner_destination=None
        ))
        
        # גמר - ID 104
        matches.append(MatchTemplate(
            id=104,
            stage="final",
            team_1="Winner_M101",
            team_2="Winner_M102",
            status="scheduled",
            date=knockout_start + timedelta(days=19),
            winner_destination=None
        ))
        
        # מוסיף את כל המשחקים
        session.add_all(matches)
        session.commit()
        
        print(f"נוצרו {len(matches)} משחקים בהצלחה!")
        
        # מציג סיכום
        print("\nסיכום משחקים שנוצרו:")
        print("=" * 50)
        print(f"משחקי בתים: 72 משחקים (ID: 1-72)")
        print(f"שלב 32 הגדולות: 16 משחקים (ID: 73-88)")
        print(f"שלב 16 הגדולות: 8 משחקים (ID: 89-96)")
        print(f"רבעי גמר: 4 משחקים (ID: 97-100)")
        print(f"חצאי גמר: 2 משחקים (ID: 101-102)")
        print(f"קרב על מקום 3: 1 משחק (ID: 103)")
        print(f"גמר: 1 משחק (ID: 104)")
        print(f"סה\"כ: {len(matches)} משחקים")
        
        # מציג כמה דוגמאות
        print("\nדוגמאות למשחקי בתים:")
        group_matches = session.query(MatchTemplate).filter(MatchTemplate.stage == "group").limit(6).all()
        for match in group_matches:
            print(f"ID {match.id}: {match.team_1} vs {match.team_2} (בית {match.group})")
        
        print("\nדוגמאות למשחקי נוקאאוט:")
        knockout_matches = session.query(MatchTemplate).filter(MatchTemplate.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])).limit(5).all()
        for match in knockout_matches:
            print(f"ID {match.id}: {match.team_1} vs {match.team_2} ({match.stage}) → {match.winner_destination}")
        
    except Exception as e:
        session.rollback()
        print(f"שגיאה ביצירת המשחקים: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_matches_template()
