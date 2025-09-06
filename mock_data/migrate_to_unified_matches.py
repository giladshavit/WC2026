import sys
import os
import sqlite3
from datetime import datetime

# Add the backend directory to the path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

def migrate_group_stage_matches():
    """מעביר משחקי שלב בתים מהטבלה הישנה לחדשה"""
    print("מעביר משחקי שלב בתים...")
    
    # חיבור ישיר לבסיס הנתונים
    conn = sqlite3.connect(os.path.join(backend_path, 'world_cup_predictions.db'))
    cursor = conn.cursor()
    
    # מביא את כל משחקי הבתים הישנים
    cursor.execute("""
        SELECT id, home_team_id, away_team_id, "group", status, date
        FROM group_stage_matches
    """)
    
    old_matches = cursor.fetchall()
    print(f"נמצאו {len(old_matches)} משחקי בתים ישנים")
    
    try:
        migrated_count = 0
        for match_data in old_matches:
            old_id, home_team_id, away_team_id, group, status, date = match_data
            
            # יוצר משחק חדש בטבלת matches
            cursor.execute("""
                INSERT INTO matches (stage, home_team_id, away_team_id, "group", status, date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ("group", home_team_id, away_team_id, group, status, date))
            
            migrated_count += 1
            
            if migrated_count % 10 == 0:
                print(f"הועברו {migrated_count} משחקים...")
        
        conn.commit()
        print(f"הועברו {migrated_count} משחקי בתים בהצלחה!")
        
        # בודק כמה משחקים יש עכשיו
        cursor.execute("SELECT COUNT(*) FROM matches")
        total_matches = cursor.fetchone()[0]
        print(f"סה\"כ משחקים בטבלה החדשה: {total_matches}")
        
    except Exception as e:
        print(f"שגיאה בהעברה: {e}")
        conn.rollback()
    finally:
        conn.close()

def migrate_knockout_matches():
    """מעביר משחקי נוקאאוט מהטבלה הישנה לחדשה"""
    print("מעביר משחקי נוקאאוט...")
    
    # חיבור ישיר לבסיס הנתונים
    conn = sqlite3.connect(os.path.join(backend_path, 'world_cup_predictions.db'))
    cursor = conn.cursor()
    
    # מביא את כל משחקי הנוקאאוט הישנים
    cursor.execute("""
        SELECT id, stage, match_number, home_team_source, away_team_source, 
               affects_matches, status, date, home_team_id, away_team_id
        FROM knockout_matches
    """)
    
    old_matches = cursor.fetchall()
    print(f"נמצאו {len(old_matches)} משחקי נוקאאוט ישנים")
    
    try:
        migrated_count = 0
        for match_data in old_matches:
            old_id, stage, match_number, home_team_source, away_team_source, \
            affects_matches, status, date, home_team_id, away_team_id = match_data
            
            # יוצר משחק חדש בטבלת matches
            cursor.execute("""
                INSERT INTO matches (stage, home_team_id, away_team_id, match_number, 
                                   home_team_source, away_team_source, affects_matches, status, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (stage, home_team_id, away_team_id, match_number, 
                  home_team_source, away_team_source, affects_matches, status, date))
            
            migrated_count += 1
            
            if migrated_count % 10 == 0:
                print(f"הועברו {migrated_count} משחקים...")
        
        conn.commit()
        print(f"הועברו {migrated_count} משחקי נוקאאוט בהצלחה!")
        
        # בודק כמה משחקים יש עכשיו
        cursor.execute("SELECT COUNT(*) FROM matches")
        total_matches = cursor.fetchone()[0]
        print(f"סה\"כ משחקים בטבלה החדשה: {total_matches}")
        
    except Exception as e:
        print(f"שגיאה בהעברה: {e}")
        conn.rollback()
    finally:
        conn.close()

def main():
    """הפונקציה הראשית"""
    print("=== העברת משחקים לטבלה מאוחדת ===")
    
    # 1. מעביר משחקי בתים
    migrate_group_stage_matches()
    
    # 2. מעביר משחקי נוקאאוט
    migrate_knockout_matches()
    
    print("\n=== סיום העברה ===")

if __name__ == "__main__":
    main()