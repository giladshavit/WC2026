"""
One-time migration: normalize bonus question status values.
Changes all "incorrect" → "wrong" in q_*_status columns of bonus_predictions table.

Run once:
  cd backend && python -m utils.migrations.fix_bonus_wrong_status
  # or from project root:
  python -m backend.utils.migrations.fix_bonus_wrong_status
"""
import sys
import os

# Allow running from project root or backend dir
_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from database import SessionLocal
from models.predictions import BonusPrediction

STATUS_FIELDS = [
    "q_g1_status", "q_g2_status", "q_g3_status", "q_g4_status", "q_g5_status",
    "q_k1_status", "q_k2_status", "q_k3_status", "q_t1_status", "q_t2_status",
]


def run():
    db = SessionLocal()
    try:
        preds = db.query(BonusPrediction).all()
        updated = 0
        for pred in preds:
            changed = False
            for field in STATUS_FIELDS:
                if getattr(pred, field, None) == "incorrect":
                    setattr(pred, field, "wrong")
                    changed = True
            if changed:
                updated += 1
        db.commit()
        print(f"✅ Migration complete. Updated {updated} predictions.")
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
