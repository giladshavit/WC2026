#!/usr/bin/env python3
"""
One-time fix: Correct Curaçao encoding (CuraÃ§ao -> Curaçao) in teams table.
Run: python utils/fix_curacao_encoding.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine


def fix_curacao():
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE teams SET name = 'Curaçao' WHERE name LIKE 'Cura%ao'")
        )
        conn.commit()
        print(f"✅ Fixed {result.rowcount} team(s): Curaçao encoding corrected")


if __name__ == "__main__":
    fix_curacao()
