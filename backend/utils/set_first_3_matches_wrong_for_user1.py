#!/usr/bin/env python3
"""
One-time script: Set status=wrong for user 1's first 3 match predictions
where the user didn't predict (home_score=None) but there is a result.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import DBReader, DBWriter, DBUtils
from services.predictions.enums import MatchPredictionStatus


def run():
    from database import SessionLocal
    db = SessionLocal()
    try:
        user_id = 1

        # Get all group matches ordered by date
        group_matches = DBReader.get_matches_by_stage(db, "group")
        group_matches_sorted = sorted(group_matches, key=lambda m: (m.date, m.id))

        # Find first 3 matches that have results and user 1 has no prediction (home_score=None)
        updated = 0
        for match in group_matches_sorted:
            if updated >= 3:
                break
            result = DBReader.get_match_result(db, match.id)
            if not result:
                continue
            pred = DBReader.get_match_prediction(db, user_id, match.id)
            if not pred:
                continue
            if pred.home_score is not None or pred.away_score is not None:
                continue  # User did predict
            DBWriter.update_match_prediction_status(db, pred, MatchPredictionStatus.WRONG)
            updated += 1
            print(f"  Match {match.id} (date={match.date}): set status=wrong for user {user_id}")

        DBUtils.commit(db)
        print(f"✅ Updated {updated} predictions to status=wrong for user {user_id}")
    except Exception as e:
        DBUtils.rollback(db)
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
