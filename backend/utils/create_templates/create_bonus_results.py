"""
Create BonusResults singleton row (id=1).
Run once after reset, before start_game.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
from database import SessionLocal
from models.results import BonusResults

def create_bonus_results():
    db = SessionLocal()
    try:
        existing = db.query(BonusResults).filter(BonusResults.id == 1).first()
        if existing:
            print("[SKIP] BonusResults singleton already exists")
            return
        db.add(BonusResults(id=1))
        db.commit()
        print("✅ BonusResults singleton created (id=1, all fields=None)")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_bonus_results()
