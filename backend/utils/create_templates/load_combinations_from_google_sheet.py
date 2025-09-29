#!/usr/bin/env python3
"""
Load all 495 third-place combinations from Google Sheets
This script reads the Google Sheet and creates all combinations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from models.third_place_combinations import ThirdPlaceCombination
import requests
import csv
from io import StringIO

def load_combinations_from_google_sheet():
    """Load all combinations from the Google Sheet"""
    
    # Google Sheet URL (CSV format)
    sheet_url = "https://docs.google.com/spreadsheets/d/1D9zV9rivLeDUql_6bMvFEdZ3gOpMnG015WNL9iGfX4g/export?format=csv&gid=0"
    
    try:
        # Create table if it doesn't exist
        print("🔧 Creating table if needed...")
        ThirdPlaceCombination.__table__.create(engine, checkfirst=True)
        
        print("📥 Downloading the spreadsheet...")
        response = requests.get(sheet_url)
        response.raise_for_status()
        
        # Read CSV
        csv_data = StringIO(response.text)
        reader = csv.reader(csv_data)
        
        # Read header row
        headers = next(reader)
        print(f"Headers: {headers}")
        
        # Delete all existing records
        db = SessionLocal()
        db.query(ThirdPlaceCombination).delete()
        print("Existing table cleaned")
        
        row_count = 0
        
        # Iterate over all rows
        for row_num, row in enumerate(reader, start=2):
            if len(row) < 9:  # need at least 9 columns
                continue
                
            # Row format: Option, 1A, 1B, ...
            option = row[0] if row[0] else f"Row_{row_num}"
            
            # Create combination
            combination = ThirdPlaceCombination(
                id=row_num - 1,  # IDs start at 1
                match_1A=row[1] if len(row) > 1 else None,  # column B (1A)
                match_1B=row[2] if len(row) > 2 else None,  # column C (1B)
                match_1D=row[3] if len(row) > 3 else None,  # column D (1D)
                match_1E=row[4] if len(row) > 4 else None,  # column E (1E)
                match_1G=row[5] if len(row) > 5 else None,  # column F (1G)
                match_1I=row[6] if len(row) > 6 else None,  # column G (1I)
                match_1K=row[7] if len(row) > 7 else None,  # column H (1K)
                match_1L=row[8] if len(row) > 8 else None,  # column I (1L)
                hash_key=""  # will be filled later
            )
            
            # Create hash key from values
            values = [row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]]
            # Extract the letters from values (3A -> A, 3B -> B, etc.)
            letters = []
            for value in values:
                if value and len(value) >= 2 and value[0] == '3':
                    letters.append(value[1])
            
            if len(letters) == 8:
                combination.hash_key = ''.join(sorted(letters))
                db.add(combination)
                row_count += 1
                
                if row_count % 50 == 0:
                    print(f"Created {row_count} combinations...")
        
        db.commit()
        print(f"✅ Created {row_count} combinations successfully!")
        
        # Show examples
        print("\nExamples of combinations:")
        sample_combinations = db.query(ThirdPlaceCombination).limit(5).all()
        for combo in sample_combinations:
            print(f"ID {combo.id}: {combo.hash_key}")
            print(f"  1A vs {combo.match_1A}, 1B vs {combo.match_1B}")
            print(f"  1D vs {combo.match_1D}, 1E vs {combo.match_1E}")
            print(f"  1G vs {combo.match_1G}, 1I vs {combo.match_1I}")
            print(f"  1K vs {combo.match_1K}, 1L vs {combo.match_1L}")
            print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    load_combinations_from_google_sheet()

