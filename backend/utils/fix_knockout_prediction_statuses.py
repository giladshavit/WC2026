#!/usr/bin/env python3
"""
Fix knockout prediction statuses that may be incorrect due to previous logic bugs.

Two phases:
1. INCORRECT predictions for matches with NO result -> recalculate to VALID/INVALID/UNREACHABLE
2. Re-process all matches with results to ensure correct statuses (CORRECT_FULL/PARTIAL/INCORRECT)

Run from backend directory: python -m utils.fix_knockout_prediction_statuses
Or: python utils/fix_knockout_prediction_statuses.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from services.database import DBReader, DBUtils
from services.predictions.knockout_service import KnockoutService
from services.predictions.enums import KnockoutPredictionStatus


def main():
    db = SessionLocal()
    try:
        fixed_incorrect_to_pre_result = 0
        reprocessed_matches = 0
        errors = []

        # Phase 1: INCORRECT with no result -> should be VALID/INVALID/UNREACHABLE
        print("Phase 1: Fixing INCORRECT predictions for matches with no result...")
        all_predictions = DBReader.get_all_knockout_predictions(db)
        for prediction in all_predictions:
            if prediction.status != KnockoutPredictionStatus.INCORRECT.value:
                continue
            knockout_result = DBReader.get_knockout_result(db, prediction.template_match_id)
            if knockout_result and knockout_result.winner_team_id:
                continue  # Match has result, Phase 2 will handle
            try:
                check_reachable = KnockoutService._should_check_reachable(db, is_draft=False)
                KnockoutService._compute_status_pre_result(db, prediction, check_reachable)
                fixed_incorrect_to_pre_result += 1
            except Exception as e:
                errors.append(f"Prediction {prediction.id} (match {prediction.template_match_id}): {e}")

        DBUtils.flush(db)
        print(f"  Fixed {fixed_incorrect_to_pre_result} predictions")

        # Phase 2: Re-process all matches with results
        print("Phase 2: Re-processing matches with results...")
        knockout_results = DBReader.get_all_knockout_results(db)
        for result in knockout_results:
            if not result.team_1 or not result.team_2 or not result.winner_team_id:
                continue
            winner_team_id = result.winner_team_id
            loser_team_id = result.team_2 if winner_team_id == result.team_1 else result.team_1
            try:
                KnockoutService.process_knockout_match_result(
                    db, result.match_id, winner_team_id, loser_team_id
                )
                reprocessed_matches += 1
            except Exception as e:
                errors.append(f"Match {result.match_id}: {e}")

        DBUtils.flush(db)
        print(f"  Reprocessed {reprocessed_matches} matches")

        db.commit()

        print()
        print("✅ Fix completed:")
        print(f"  - fixed_incorrect_to_pre_result: {fixed_incorrect_to_pre_result}")
        print(f"  - reprocessed_matches: {reprocessed_matches}")
        if errors:
            print(f"  - errors: {errors}")
        else:
            print("  - No errors")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
