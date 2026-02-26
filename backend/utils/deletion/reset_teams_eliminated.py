#!/usr/bin/env python3
"""
Reset is_eliminated to False for all teams in the database.
Use this when you need to clear elimination status without running the full reset.
"""

import sys
import os

# Add the backend directory to the Python path (3 levels up from deletion folder)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.team import Team


def main():
    db = SessionLocal()
    try:
        eliminated_teams = db.query(Team).filter(Team.is_eliminated == True).all()
        count = len(eliminated_teams)
        for team in eliminated_teams:
            team.is_eliminated = False
        db.commit()
        print(f"✅ Reset is_eliminated for {count} teams.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
