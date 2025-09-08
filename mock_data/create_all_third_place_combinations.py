#!/usr/bin/env python3
"""
Create all 495 third-place combinations for World Cup 2026
Based on FIFA regulations for 12 groups (A-L)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models.third_place_combinations import ThirdPlaceCombination
from itertools import combinations

def create_all_combinations():
    """יוצר את כל 495 הקומבינציות של מקום 3"""
    
    # 12 בתים: A, B, C, D, E, F, G, H, I, J, K, L
    groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    
    # צריך לבחור 8 בתים מתוך 12 (C(12,8) = 495)
    all_combinations = list(combinations(groups, 8))
    
    print(f"יוצר {len(all_combinations)} קומבינציות...")
    
    db = SessionLocal()
    try:
        # מנקה את הטבלה הקיימת
        db.query(ThirdPlaceCombination).delete()
        print("נוקתה הטבלה הקיימת")
        
        # יוצר כל קומבינציה
        for i, combo in enumerate(all_combinations, 1):
            # מיון אלפביתי
            sorted_combo = sorted(combo)
            
            # יוצר hash key
            hash_key = ''.join(sorted_combo)
            
            # יוצר את הרשומה
            combination = ThirdPlaceCombination(
                id=i,
                match_1A=f"3{sorted_combo[0]}",
                match_1B=f"3{sorted_combo[1]}",
                match_1D=f"3{sorted_combo[2]}",
                match_1E=f"3{sorted_combo[3]}",
                match_1G=f"3{sorted_combo[4]}",
                match_1I=f"3{sorted_combo[5]}",
                match_1K=f"3{sorted_combo[6]}",
                match_1L=f"3{sorted_combo[7]}",
                hash_key=hash_key
            )
            
            db.add(combination)
            
            if i % 50 == 0:
                print(f"נוצרו {i} קומבינציות...")
        
        db.commit()
        print(f"✅ נוצרו {len(all_combinations)} קומבינציות בהצלחה!")
        
        # מציג כמה דוגמאות
        print("\nדוגמאות לקומבינציות:")
        sample_combinations = db.query(ThirdPlaceCombination).limit(5).all()
        for combo in sample_combinations:
            print(f"ID {combo.id}: {combo.hash_key}")
            print(f"  match_1A: {combo.match_1A}, match_1B: {combo.match_1B}")
            print(f"  match_1D: {combo.match_1D}, match_1E: {combo.match_1E}")
            print(f"  match_1G: {combo.match_1G}, match_1I: {combo.match_1I}")
            print(f"  match_1K: {combo.match_1K}, match_1L: {combo.match_1L}")
            print()
        
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_all_combinations()
