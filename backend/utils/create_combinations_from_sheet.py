#!/usr/bin/env python3
"""
Create all 495 third-place combinations from Google Sheets
This script creates the combinations once and for all based on the official FIFA sheet
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.third_place_combinations import ThirdPlaceCombination
from itertools import combinations

def create_all_combinations_from_sheet():
    """Create all 495 combinations from the spreadsheet"""
    
    db = SessionLocal()
    try:
        # Delete all existing records
        db.query(ThirdPlaceCombination).delete()
        print("Existing table cleaned")
        
        # Create all combinations
        groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        all_combinations = list(combinations(groups, 8))
        
        print(f"Creating {len(all_combinations)} combinations...")
        
        # Combinations from the official sheet
        # To be copied manually from the sheet
        sheet_combinations = [
            # Row 2 (Option 1): 3E 3J 3I 3F 3H 3G 3L 3K
            {'hash_key': 'ABCDEFGH', 'match_1A': '3E', 'match_1B': '3J', 'match_1D': '3I', 'match_1E': '3F', 'match_1G': '3H', 'match_1I': '3G', 'match_1K': '3L', 'match_1L': '3K'},
            # Row 3 (Option 2): 3H 3G 3I 3D 3J 3F 3L 3K
            {'hash_key': 'ABCDEFGI', 'match_1A': '3H', 'match_1B': '3G', 'match_1D': '3I', 'match_1E': '3D', 'match_1G': '3J', 'match_1I': '3F', 'match_1K': '3L', 'match_1L': '3K'},
            # ... need to copy all 495 combinations
        ]
        
        # For now, create only the current combination
        current_combination = {
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
        
        # Create the current combination
        combination = ThirdPlaceCombination(
            id=1,
            match_1A=current_combination['match_1A'],
            match_1B=current_combination['match_1B'],
            match_1D=current_combination['match_1D'],
            match_1E=current_combination['match_1E'],
            match_1G=current_combination['match_1G'],
            match_1I=current_combination['match_1I'],
            match_1K=current_combination['match_1K'],
            match_1L=current_combination['match_1L'],
            hash_key=current_combination['hash_key']
        )
        
        db.add(combination)
        db.commit()
        
        print("✅ Created one combination (current)")
        print("⚠️ Need to copy all 495 combinations from the sheet")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_all_combinations_from_sheet()

