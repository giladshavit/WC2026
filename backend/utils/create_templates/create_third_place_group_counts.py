"""
Create ThirdPlaceGroupCounts singleton row (id=1).
Run once after reset, before start_game.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
from database import SessionLocal
from models.statistics import ThirdPlaceGroupCounts

def create_third_place_group_counts():
    db = SessionLocal()
    try:
        existing = db.query(ThirdPlaceGroupCounts).filter(
            ThirdPlaceGroupCounts.id == 1).first()
        if existing:
            print("[SKIP] ThirdPlaceGroupCounts singleton already exists")
            return
        db.add(ThirdPlaceGroupCounts(
            id=1,
            group_a=0, group_b=0, group_c=0, group_d=0,
            group_e=0, group_f=0, group_g=0, group_h=0,
            group_i=0, group_j=0, group_k=0, group_l=0
        ))
        db.commit()
        print("✅ ThirdPlaceGroupCounts singleton created (all groups=0)")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_third_place_group_counts()
