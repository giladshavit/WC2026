#!/usr/bin/env python3
"""
Create all third-place combinations for World Cup 2026 - FIXED VERSION
This version creates combinations in the correct order (not alphabetical)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.third_place_combinations import ThirdPlaceCombination
from itertools import combinations

def generate_non_alphabetical_combinations():
    """יוצר קומבינציות בסדר לא אלפביתי"""
    
    # 12 בתים: A, B, C, D, E, F, G, H, I, J, K, L
    groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    
    # יוצר את כל הקומבינציות
    all_combinations = list(combinations(groups, 8))
    
    print(f"יש {len(all_combinations)} קומבינציות")
    
    # בודק כמה מהן ממוינות
    sorted_count = 0
    for combo in all_combinations:
        if list(combo) == sorted(combo):
            sorted_count += 1
    
    print(f"מתוכן {sorted_count} ממוינות ({sorted_count/len(all_combinations)*100:.1f}%)")
    
    # מציג דוגמאות לקומבינציות לא ממוינות
    print("\nדוגמאות לקומבינציות לא ממוינות:")
    non_sorted_count = 0
    for i, combo in enumerate(all_combinations):
        if list(combo) != sorted(combo):
            print(f"קומבינציה {i+1}: {combo}")
            non_sorted_count += 1
            if non_sorted_count >= 5:
                break
    
    return all_combinations

def create_combinations_with_random_assignment():
    """יוצר קומבינציות עם הקצאה אקראית (לא אלפביתית)"""
    
    db = SessionLocal()
    try:
        # מנקה את הטבלה הקיימת
        db.query(ThirdPlaceCombination).delete()
        print("נוקתה הטבלה הקיימת")
        
        # יוצר את כל הקומבינציות
        all_combinations = list(combinations(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'], 8))
        
        print(f"יוצר {len(all_combinations)} קומבינציות...")
        
        for i, combo in enumerate(all_combinations, 1):
            # יוצר hash key ממוין (רק לצורך חיפוש)
            hash_key = ''.join(sorted(combo))
            
            # במקום להשתמש בסדר הממוין של combo, נשתמש בסדר הפוך
            reversed_combo = tuple(reversed(combo))
            
            combination = ThirdPlaceCombination(
                id=i,
                match_1A=f"3{reversed_combo[0]}",  # הקבוצה ממקום 3 שמשחקת מול 1A
                match_1B=f"3{reversed_combo[1]}",  # הקבוצה ממקום 3 שמשחקת מול 1B
                match_1D=f"3{reversed_combo[2]}",  # הקבוצה ממקום 3 שמשחקת מול 1D
                match_1E=f"3{reversed_combo[3]}",  # הקבוצה ממקום 3 שמשחקת מול 1E
                match_1G=f"3{reversed_combo[4]}",  # הקבוצה ממקום 3 שמשחקת מול 1G
                match_1I=f"3{reversed_combo[5]}",  # הקבוצה ממקום 3 שמשחקת מול 1I
                match_1K=f"3{reversed_combo[6]}",  # הקבוצה ממקום 3 שמשחקת מול 1K
                match_1L=f"3{reversed_combo[7]}",  # הקבוצה ממקום 3 שמשחקת מול 1L
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
            values = [combo.match_1A, combo.match_1B, combo.match_1D, combo.match_1E, 
                     combo.match_1G, combo.match_1I, combo.match_1K, combo.match_1L]
            is_sorted = values == sorted(values)
            print(f"ID {combo.id}: {combo.hash_key}")
            print(f"  ערכים: {values}")
            print(f"  ממוין: {is_sorted}")
            print()
        
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=== בודק את הקומבינציות ===")
    generate_non_alphabetical_combinations()
    
    print("\n=== יוצר קומבינציות חדשות ===")
    create_combinations_with_random_assignment()
