"""
One-time migration: clear all bonus prediction field values.
Run this when users had predictions with old/invalid option values (e.g. old g1 ranges).
This resets all 10 question fields to None but keeps the BonusPrediction row intact.

Run with (from backend/):
  source venv/bin/activate
  python utils/migrations/reset_bonus_predictions.py

Or: ./venv/bin/python utils/migrations/reset_bonus_predictions.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from database import SessionLocal
    from models.predictions import BonusPrediction
except ModuleNotFoundError as e:
    mod = getattr(e, 'name', '') or ''
    if 'sqlalchemy' in mod or 'sqlalchemy' in str(e).lower():
        print("❌ sqlalchemy not found. Activate the project venv first:")
        print("   cd backend && source venv/bin/activate")
        print("   python utils/migrations/reset_bonus_predictions.py")
        sys.exit(1)
    raise

BONUS_FIELDS = [
    "g1_total_goals_group",
    "g2_top_group_id",
    "g3_top_team_id",
    "g4_perfect_teams",
    "g5_clean_sheet_teams",
    "k1_total_goals_knockout",
    "k2_penalty_shootouts",
    "k3_third_place_quarters",
    "t1_total_goals_tournament",
    "t2_scoreless_draws",
    # Also reset status columns so they're re-gradeable
    "q_g1_status", "q_g2_status", "q_g3_status", "q_g4_status", "q_g5_status",
    "q_k1_status", "q_k2_status", "q_k3_status", "q_t1_status", "q_t2_status",
    "bonus_score",
]


def run():
    db = SessionLocal()
    try:
        preds = db.query(BonusPrediction).all()
        print(f"Found {len(preds)} BonusPrediction rows")

        for pred in preds:
            for field in BONUS_FIELDS:
                if hasattr(pred, field):
                    if field == "bonus_score":
                        setattr(pred, field, 0)
                    elif field.startswith("q_") and field.endswith("_status"):
                        setattr(pred, field, "pending")
                    else:
                        setattr(pred, field, None)

        db.commit()
        print("✅ All bonus prediction fields reset to None (status → pending, bonus_score → 0)")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
