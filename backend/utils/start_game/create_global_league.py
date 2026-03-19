"""
Create the global league - open to all users, created once on game setup.
This league always exists and is never deleted.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))

from database import SessionLocal
from models.league import League, LeagueScoreMode

GLOBAL_LEAGUE_INVITE_CODE = "GLOBAL00"
GLOBAL_LEAGUE_NAME = "Global League"
GLOBAL_LEAGUE_DESCRIPTION = "Open to all players. Join the global competition!"

def create_global_league():
    db = SessionLocal()
    try:
        existing = db.query(League).filter(
            League.invite_code == GLOBAL_LEAGUE_INVITE_CODE
        ).first()
        if existing:
            print(f"[SKIP] Global league already exists (id={existing.id})")
            return

        global_league = League(
            name=GLOBAL_LEAGUE_NAME,
            description=GLOBAL_LEAGUE_DESCRIPTION,
            invite_code=GLOBAL_LEAGUE_INVITE_CODE,
            created_by=1,
            is_active=True,
            score_mode=LeagueScoreMode.MULTI,
        )
        db.add(global_league)
        db.commit()
        db.refresh(global_league)
        print(f"✅ Global league created (id={global_league.id}, "
              f"invite_code={GLOBAL_LEAGUE_INVITE_CODE})")
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating global league: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_global_league()
