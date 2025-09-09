#!/usr/bin/env python3
"""
Load third place combinations from Google Sheets
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.third_place_combinations import ThirdPlaceCombination
from itertools import combinations

def load_combinations_from_sheet():
    """טוען את הקומבינציות מהגיליון האלקטרוני"""
    
    # הקומבינציות מהגיליון - אני אעתיק אותן ידנית
    # זה הקומבינציה DEFGHIKL (שורה 490 בגיליון)
    target_combination = {
        'hash_key': 'DEFGHIKL',
        'match_1A': '3H',
        'match_1B': '3J', 
        'match_1D': '3B',
        'match_1E': '3C',
        'match_1G': '3A',
        'match_1I': '3F',
        'match_1K': '3D',
        'match_1L': '3E'
    }
    
    db = SessionLocal()
    try:
        # מוצא את הקומבינציה הנוכחית
        combination = db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == target_combination['hash_key']
        ).first()
        
        if combination:
            print(f"מעדכן קומבינציה ID {combination.id}")
            
            # מעדכן את הערכים
            combination.match_1A = target_combination['match_1A']
            combination.match_1B = target_combination['match_1B']
            combination.match_1D = target_combination['match_1D']
            combination.match_1E = target_combination['match_1E']
            combination.match_1G = target_combination['match_1G']
            combination.match_1I = target_combination['match_1I']
            combination.match_1K = target_combination['match_1K']
            combination.match_1L = target_combination['match_1L']
            
            db.commit()
            print("✅ הקומבינציה עודכנה בהצלחה!")
            
            # מציג את התוצאה
            print(f"\nהקומבינציה המעודכנת:")
            print(f"1A vs {combination.match_1A}")
            print(f"1B vs {combination.match_1B}")
            print(f"1D vs {combination.match_1D}")
            print(f"1E vs {combination.match_1E}")
            print(f"1G vs {combination.match_1G}")
            print(f"1I vs {combination.match_1I}")
            print(f"1K vs {combination.match_1K}")
            print(f"1L vs {combination.match_1L}")
            
        else:
            print(f"❌ לא נמצאה קומבינציה עם hash_key {target_combination['hash_key']}")
            
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    load_combinations_from_sheet()
