#!/usr/bin/env python3
"""
Setup script for third-place team combinations table
Based on FIFA World Cup 2026 Competition Regulations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, SessionLocal
from backend.models.third_place_combinations import ThirdPlaceCombination

def create_hash_key(combination_parts):
    """Create a hash key by sorting the combination parts alphabetically"""
    # Sort the parts alphabetically and join them
    sorted_parts = sorted(combination_parts)
    return ' '.join(sorted_parts)

def parse_combination_line(line):
    """Parse a combination line from the data"""
    parts = line.strip().split()
    if len(parts) != 9:  # Should have 9 parts: number + 8 groups
        return None
    
    combination_number = int(parts[0])
    combination_parts = parts[1:]  # The 8 group parts
    
    # Create the hash key
    hash_key = create_hash_key(combination_parts)
    
    # Create the combination object
    return {
        'id': combination_number,
        'match_1A': combination_parts[0] if len(combination_parts) > 0 else None,
        'match_1B': combination_parts[1] if len(combination_parts) > 1 else None,
        'match_1D': combination_parts[2] if len(combination_parts) > 2 else None,
        'match_1E': combination_parts[3] if len(combination_parts) > 3 else None,
        'match_1G': combination_parts[4] if len(combination_parts) > 4 else None,
        'match_1I': combination_parts[5] if len(combination_parts) > 5 else None,
        'match_1K': combination_parts[6] if len(combination_parts) > 6 else None,
        'match_1L': combination_parts[7] if len(combination_parts) > 7 else None,
        'hash_key': hash_key
    }

def setup_third_place_combinations():
    """Setup the third-place combinations table with data"""
    
    # Create tables
    from backend.models.base import Base
    Base.metadata.create_all(engine)
    
    # Sample data from the Google Sheets (first 20 combinations)
    # In a real scenario, you would import this from a CSV or API
    sample_combinations = [
        "1 3E 3J 3I 3F 3H 3G 3L 3K",
        "2 3H 3G 3I 3D 3J 3F 3L 3K",
        "3 3E 3J 3I 3D 3H 3G 3L 3K",
        "4 3E 3J 3I 3D 3H 3F 3L 3K",
        "5 3E 3G 3I 3D 3J 3F 3L 3K",
        "6 3E 3G 3J 3D 3H 3F 3L 3K",
        "7 3E 3G 3I 3D 3H 3F 3L 3K",
        "8 3E 3G 3J 3D 3H 3F 3L 3I",
        "9 3E 3G 3J 3D 3H 3F 3I 3K",
        "10 3H 3G 3I 3C 3J 3F 3L 3K",
        "11 3E 3J 3I 3C 3H 3G 3L 3K",
        "12 3E 3J 3I 3C 3H 3F 3L 3K",
        "13 3E 3G 3I 3C 3J 3F 3L 3K",
        "14 3E 3G 3J 3C 3H 3F 3L 3K",
        "15 3E 3G 3I 3C 3H 3F 3L 3K",
        "16 3E 3G 3J 3C 3H 3F 3L 3I",
        "17 3E 3G 3J 3C 3H 3F 3I 3K",
        "18 3H 3G 3I 3C 3J 3D 3L 3K",
        "19 3C 3J 3I 3D 3H 3F 3L 3K",
        "20 3C 3G 3I 3D 3J 3F 3L 3K"
    ]
    
    # Parse and insert combinations
    db = SessionLocal()
    try:
        for line in sample_combinations:
            combination_data = parse_combination_line(line)
            if combination_data:
                # Check if combination already exists
                existing = db.query(ThirdPlaceCombination).filter_by(
                    hash_key=combination_data['hash_key']
                ).first()
                
                if not existing:
                    combination = ThirdPlaceCombination(**combination_data)
                    db.add(combination)
                    print(f"Added combination {combination_data['id']}: {combination_data['hash_key']}")
                else:
                    print(f"Combination {combination_data['id']} already exists")
        
        db.commit()
        print(f"Setup completed! Added {len(sample_combinations)} combinations to the database.")
    finally:
        db.close()

if __name__ == "__main__":
    setup_third_place_combinations()
