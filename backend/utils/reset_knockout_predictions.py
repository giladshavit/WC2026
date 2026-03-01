#!/usr/bin/env python3
"""
Reset knockout predictions - clear winners and optionally teams.

- Round of 32: Only clear winner_team_id (keep team1, team2 from bracket)
- All other stages (round16, quarter, semi, final, third_place): Clear winner + team1 + team2

Also resets points, penalty_points, changes_count, is_editable, status, validity.
Resets knockout_score in user_scores. Deletes drafts.

Usage: python utils/reset_knockout_predictions.py [--dry-run]
"""

import sys
import os
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.predictions import KnockoutStagePrediction, KnockoutStagePredictionDraft
from models.user_scores import UserScores
from services.database import DBReader, DBUtils


def reset_knockout_predictions(dry_run: bool = False) -> dict:
    db = SessionLocal()
    try:
        predictions = DBReader.get_all_knockout_predictions(db)
        count_round32 = 0
        count_other = 0

        for pred in predictions:
            if pred.stage == "round32":
                # Round of 32: only clear winner, keep team1 and team2
                pred.winner_team_id = None
                count_round32 += 1
            else:
                # All other stages: clear winner + team1 + team2
                pred.winner_team_id = None
                pred.team1_id = None
                pred.team2_id = None
                count_other += 1

            pred.points = 0
            pred.penalty_points = 0
            pred.changes_count = 0
            pred.is_editable = True
            pred.status = "invalid"
            pred.is_team1_valid = True
            pred.is_team2_valid = True

        if not dry_run:
            db.flush()

        # 2. Delete draft predictions (they reference the main predictions)
        draft_count = db.query(KnockoutStagePredictionDraft).count()
        if not dry_run and draft_count > 0:
            db.query(KnockoutStagePredictionDraft).delete()
            db.flush()

        # 3. Reset knockout_score for all users and recalculate total_points
        all_scores = DBReader.get_all_user_scores(db)
        for scores in all_scores:
            scores.knockout_score = 0
            # Recalculate total_points
            total = (
                (scores.matches_score or 0) +
                (scores.groups_score or 0) +
                (scores.third_place_score or 0) +
                (scores.knockout_score or 0) -
                (scores.penalty or 0)
            )
            scores.total_points = total

        if not dry_run:
            db.flush()
            DBUtils.commit(db)

        return {
            "round32_reset": count_round32,
            "other_stages_reset": count_other,
            "drafts_deleted": draft_count,
            "users_updated": len(all_scores),
        }
    except Exception as e:
        if not dry_run:
            DBUtils.rollback(db)
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Reset knockout predictions to initial state")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    args = parser.parse_args()

    print("🔄 Resetting knockout predictions to initial state...")
    if args.dry_run:
        print("   (DRY RUN - no changes will be made)")

    result = reset_knockout_predictions(dry_run=args.dry_run)

    print(f"\n✅ Done!")
    print(f"   Round of 32 (winner only): {result['round32_reset']}")
    print(f"   Other stages (winner + teams): {result['other_stages_reset']}")
    print(f"   Drafts deleted: {result['drafts_deleted']}")
    print(f"   Users updated: {result['users_updated']}")


if __name__ == "__main__":
    main()
