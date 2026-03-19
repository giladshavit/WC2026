"""
Create TournamentConfig initial entry.
Run once after reset, before start_game.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
from database import SessionLocal
from models.tournament_config import TournamentConfig

def create_tournament_config():
    db = SessionLocal()
    try:
        existing = db.query(TournamentConfig).filter(
            TournamentConfig.key == "current_stage").first()
        if existing:
            print("[SKIP] TournamentConfig already exists")
            return
        db.add(TournamentConfig(
            key="current_stage",
            value="PRE_GROUP_STAGE"
        ))
        db.commit()
        print("✅ TournamentConfig created (current_stage=PRE_GROUP_STAGE)")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_tournament_config()
