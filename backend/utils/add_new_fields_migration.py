#!/usr/bin/env python3
"""
מיגרציה להוספת השדות החדשים:
- first_place_match_id ו-second_place_match_id לטבלת groups
- status לטבלת knockout_stage_predictions
"""

import sqlite3
import os
from pathlib import Path

def add_new_fields():
    """מוסיף את השדות החדשים לטבלאות"""
    
    # נתיב למסד הנתונים
    db_path = Path(__file__).parent.parent / "world_cup_predictions.db"
    
    if not db_path.exists():
        print(f"❌ מסד הנתונים לא נמצא: {db_path}")
        return False
    
    try:
        # התחברות למסד הנתונים
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        print("🔄 מתחיל מיגרציה...")
        
        # בדיקה אם השדות כבר קיימים
        cursor.execute("PRAGMA table_info(groups)")
        groups_columns = [column[1] for column in cursor.fetchall()]
        
        cursor.execute("PRAGMA table_info(knockout_stage_predictions)")
        predictions_columns = [column[1] for column in cursor.fetchall()]
        
        # הוספת שדות לטבלת groups
        if 'first_place_match_id' not in groups_columns:
            cursor.execute("ALTER TABLE groups ADD COLUMN first_place_match_id INTEGER")
            print("✅ נוסף שדה first_place_match_id לטבלת groups")
        else:
            print("ℹ️ שדה first_place_match_id כבר קיים בטבלת groups")
            
        if 'second_place_match_id' not in groups_columns:
            cursor.execute("ALTER TABLE groups ADD COLUMN second_place_match_id INTEGER")
            print("✅ נוסף שדה second_place_match_id לטבלת groups")
        else:
            print("ℹ️ שדה second_place_match_id כבר קיים בטבלת groups")
        
        # הוספת שדה לטבלת knockout_stage_predictions
        if 'status' not in predictions_columns:
            cursor.execute("ALTER TABLE knockout_stage_predictions ADD COLUMN status VARCHAR(20) DEFAULT 'gray'")
            print("✅ נוסף שדה status לטבלת knockout_stage_predictions")
        else:
            print("ℹ️ שדה status כבר קיים בטבלת knockout_stage_predictions")
        
        # שמירת השינויים
        conn.commit()
        print("💾 השינויים נשמרו בהצלחה!")
        
        # הצגת מידע על הטבלאות
        print("\n📊 מידע על הטבלאות:")
        
        cursor.execute("PRAGMA table_info(groups)")
        groups_info = cursor.fetchall()
        print("טבלת groups:")
        for column in groups_info:
            print(f"  - {column[1]} ({column[2]})")
        
        cursor.execute("PRAGMA table_info(knockout_stage_predictions)")
        predictions_info = cursor.fetchall()
        print("\nטבלת knockout_stage_predictions:")
        for column in predictions_info:
            print(f"  - {column[1]} ({column[2]})")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ שגיאה במיגרציה: {e}")
        if 'conn' in locals():
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 מתחיל מיגרציה להוספת שדות חדשים...")
    success = add_new_fields()
    
    if success:
        print("\n✅ המיגרציה הושלמה בהצלחה!")
        print("\nהשדות שנוספו:")
        print("📋 טבלת groups:")
        print("  - first_place_match_id: לאיזה משחק מקום ראשון מיועד")
        print("  - second_place_match_id: לאיזה משחק מקום שני מיועד")
        print("📋 טבלת knockout_stage_predictions:")
        print("  - status: סטטוס הניחוש (green/yellow/red/gray)")
    else:
        print("\n❌ המיגרציה נכשלה!")
