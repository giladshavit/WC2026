#!/usr/bin/env python3
"""
Create column mapping table: match_1A -> 1A
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.column_mapping import ColumnMapping

def create_column_mapping():
    """יוצר את טבלת המיפוי"""
    
    db = SessionLocal()
    try:
        # מנקה את הטבלה הקיימת
        db.query(ColumnMapping).delete()
        print("נוקתה טבלת המיפוי הקיימת")
        
        # יוצר את המיפויים
        mappings = [
            ("match_1A", "1A"),
            ("match_1B", "1B"),
            ("match_1D", "1D"),
            ("match_1E", "1E"),
            ("match_1G", "1G"),
            ("match_1I", "1I"),
            ("match_1K", "1K"),
            ("match_1L", "1L")
        ]
        
        for match_col, display_name in mappings:
            mapping = ColumnMapping(
                match_column=match_col,
                display_name=display_name
            )
            db.add(mapping)
            print(f"נוצר מיפוי: {match_col} -> {display_name}")
        
        db.commit()
        print("✅ טבלת המיפוי נוצרה בהצלחה!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_column_mapping()

