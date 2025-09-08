#!/usr/bin/env python3
"""
Database Status Checker
Shows the number of records in each table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from sqlalchemy import text

def check_database_status():
    """בודק את מצב בסיס הנתונים ומציג את מספר הרשומות בכל טבלה"""
    
    db = SessionLocal()
    try:
        # בודק אילו טבלאות קיימות
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result.fetchall()]
        
        print("=" * 60)
        print("מצב בסיס הנתונים - מספר רשומות בכל טבלה")
        print("=" * 60)
        
        total_records = 0
        
        for table in sorted(tables):
            try:
                result = db.execute(text(f'SELECT COUNT(*) FROM {table}'))
                count = result.fetchone()[0]
                total_records += count
                
                # צבעים לפי כמות הרשומות
                if count == 0:
                    status = "🔴 ריק"
                elif count < 10:
                    status = "🟡 מעט"
                elif count < 100:
                    status = "🟢 טוב"
                else:
                    status = "✅ מלא"
                
                print(f"{table:30} : {count:4} רשומות {status}")
                
            except Exception as e:
                print(f"{table:30} : שגיאה - {e}")
        
        print("=" * 60)
        print(f"סה\"כ רשומות: {total_records}")
        print("=" * 60)
        
        # המלצות
        print("\nהמלצות:")
        if total_records == 0:
            print("🔴 בסיס הנתונים ריק - צריך ליצור נתונים")
        elif total_records < 100:
            print("🟡 בסיס הנתונים חלקי - צריך להשלים נתונים")
        else:
            print("✅ בסיס הנתונים נראה טוב")
            
        # בדיקות ספציפיות
        empty_tables = []
        for table in sorted(tables):
            try:
                result = db.execute(text(f'SELECT COUNT(*) FROM {table}'))
                count = result.fetchone()[0]
                if count == 0:
                    empty_tables.append(table)
            except:
                pass
        
        if empty_tables:
            print(f"\nטבלאות ריקות שצריך למלא: {', '.join(empty_tables)}")
            
    except Exception as e:
        print(f"❌ שגיאה כללית: {e}")
    finally:
        db.close()

def show_table_details(table_name):
    """מציג פרטים על טבלה ספציפית"""
    
    db = SessionLocal()
    try:
        # בודק אם הטבלה קיימת
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"), {"table_name": table_name})
        if not result.fetchone():
            print(f"❌ הטבלה '{table_name}' לא קיימת")
            return
        
        # מציג את מספר הרשומות
        result = db.execute(text(f'SELECT COUNT(*) FROM {table_name}'))
        count = result.fetchone()[0]
        print(f"טבלה: {table_name}")
        print(f"מספר רשומות: {count}")
        
        if count > 0:
            # מציג כמה דוגמאות
            result = db.execute(text(f'SELECT * FROM {table_name} LIMIT 5'))
            rows = result.fetchall()
            
            print(f"\nדוגמאות (5 ראשונות):")
            for i, row in enumerate(rows, 1):
                print(f"  {i}. {row}")
                
    except Exception as e:
        print(f"❌ שגיאה: {e}")
    finally:
        db.close()

def main():
    """פונקציה ראשית"""
    if len(sys.argv) > 1:
        # אם ניתנה טבלה ספציפית
        table_name = sys.argv[1]
        show_table_details(table_name)
    else:
        # מציג את מצב כל הטבלאות
        check_database_status()

if __name__ == "__main__":
    main()
