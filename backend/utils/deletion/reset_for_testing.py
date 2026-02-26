#!/usr/bin/env python3
"""
Script to completely reset the database for fresh testing.
Deletes all user data (predictions, scores, users) while keeping tournament structure intact.

Tables deleted (in order):
1. knockout_stage_predictions (draft first, then main)
2. match_predictions
3. group_stage_predictions
4. third_place_predictions
5. user_scores
6. penalty_logs (if exists)
7. user_score_snapshots (if exists)
8. league_memberships
9. users (non-admin only by default)

Preserves: teams, matches, groups, match_templates, leagues
"""

import sys
import os
from sqlalchemy import text

# Add the backend directory to the Python path (3 levels up from deletion folder)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.predictions import (
    MatchPrediction,
    GroupStagePrediction,
    ThirdPlacePrediction,
    KnockoutStagePrediction,
    KnockoutStagePredictionDraft,
)
from models.user_scores import UserScores
from models.user import User
from models.league import LeagueMembership
from models.team import Team

# Set to True to also delete admin users; False to keep admins
DELETE_ADMINS = False


def safe_delete_table(db, table_name: str) -> tuple[int, int]:
    """
    Delete all records from a table using raw SQL. Returns (count_before, count_deleted).
    Handles missing tables gracefully.
    """
    try:
        count_before = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        db.execute(text(f"DELETE FROM {table_name}"))
        db.commit()
        count_after = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        deleted = count_before - count_after
        print(f"  Before: {count_before} | After: {count_after} | Deleted: {deleted}")
        return count_before, deleted
    except Exception as e:
        db.rollback()
        print(f"  ⚠️  Table {table_name} does not exist or error: {e}")
        return 0, 0


def delete_orm(db, model) -> tuple[int, int]:
    """Delete using ORM, return (count_before, count_deleted)."""
    count_before = db.query(model).count()
    deleted = db.query(model).delete()
    db.commit()
    count_after = db.query(model).count()
    print(f"  Before: {count_before} | After: {count_after} | Deleted: {deleted}")
    return count_before, deleted


def reset_for_testing():
    """Reset the database for fresh testing."""
    print("=" * 60)
    print("⚠️  DATABASE RESET FOR TESTING")
    print("=" * 60)
    print()
    print("This will DELETE the following data:")
    print("  1. knockout_stage_predictions (draft + main)")
    print("  2. match_predictions")
    print("  3. group_stage_predictions")
    print("  4. third_place_predictions")
    print("  5. user_scores")
    print("  6. penalty_logs (if exists)")
    print("  7. user_score_snapshots (if exists)")
    print("  8. league_memberships")
    print("  9. users" + (" (including admins)" if DELETE_ADMINS else " (non-admin only)"))
    print("  10. Reset teams.is_eliminated to False for all teams")
    print()
    print("Preserved: teams, matches, groups, match_templates, leagues")
    print()
    print("This action CANNOT be undone!")
    print()
    confirm = input('Type "YES" to proceed: ').strip()
    if confirm != "YES":
        print("Aborted.")
        return

    db = SessionLocal()
    summary = []

    try:
        print("\n" + "=" * 60)
        print("Starting deletion...")
        print("=" * 60)

        # 1. knockout_stage_predictions (draft first, then main)
        print("\n1. knockout_stage_predictions_draft")
        before, deleted = delete_orm(db, KnockoutStagePredictionDraft)
        summary.append(("knockout_stage_predictions_draft", before, deleted))

        print("\n2. knockout_stage_predictions")
        before, deleted = delete_orm(db, KnockoutStagePrediction)
        summary.append(("knockout_stage_predictions", before, deleted))

        # 3. match_predictions
        print("\n3. match_predictions")
        before, deleted = delete_orm(db, MatchPrediction)
        summary.append(("match_predictions", before, deleted))

        # 4. group_stage_predictions
        print("\n4. group_stage_predictions")
        before, deleted = delete_orm(db, GroupStagePrediction)
        summary.append(("group_stage_predictions", before, deleted))

        # 5. third_place_predictions
        print("\n5. third_place_predictions")
        before, deleted = delete_orm(db, ThirdPlacePrediction)
        summary.append(("third_place_predictions", before, deleted))

        # 6. user_scores
        print("\n6. user_scores")
        before, deleted = delete_orm(db, UserScores)
        summary.append(("user_scores", before, deleted))

        # 7. penalty_logs (if exists)
        print("\n7. penalty_logs")
        before, deleted = safe_delete_table(db, "penalty_logs")
        summary.append(("penalty_logs", before, deleted))

        # 8. user_score_snapshots (if exists)
        print("\n8. user_score_snapshots")
        before, deleted = safe_delete_table(db, "user_score_snapshots")
        summary.append(("user_score_snapshots", before, deleted))

        # 9. league_memberships
        print("\n9. league_memberships")
        before, deleted = delete_orm(db, LeagueMembership)
        summary.append(("league_memberships", before, deleted))

        # 10. users
        print("\n10. users")
        if hasattr(User, "is_admin"):
            if DELETE_ADMINS:
                before = db.query(User).count()
                deleted = db.query(User).delete()
            else:
                before = db.query(User).count()
                deleted = db.query(User).filter(User.is_admin == False).delete()
        else:
            # User model has no is_admin - delete all users for full reset
            print("  (User model has no is_admin; deleting all users)")
            before = db.query(User).count()
            deleted = db.query(User).delete()
        db.commit()
        count_after = db.query(User).count()
        print(f"  Before: {before} | After: {count_after} | Deleted: {deleted}")
        summary.append(("users", before, deleted))

        # 11. Reset teams.is_eliminated to False
        print("\n11. teams (reset is_eliminated)")
        eliminated_teams = db.query(Team).filter(Team.is_eliminated == True).all()
        eliminated_before = len(eliminated_teams)
        for team in eliminated_teams:
            team.is_eliminated = False
        db.commit()
        eliminated_after = db.query(Team).filter(Team.is_eliminated == True).count()
        reset_count = eliminated_before - eliminated_after
        print(f"  Teams with is_eliminated=True before: {eliminated_before} | After: {eliminated_after} | Reset: {reset_count}")
        summary.append(("teams.is_eliminated reset", eliminated_before, reset_count))

        # Summary table
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"{'Table':<35} {'Before':>8} {'Deleted':>8}")
        print("-" * 55)
        for table, b, d in summary:
            print(f"{table:<35} {b:>8} {d:>8}")
        print("-" * 55)
        total_deleted = sum(s[2] for s in summary)
        print(f"{'TOTAL':<35} {'':>8} {total_deleted:>8}")
        print()
        print("Verification:")
        verify_count = (
            db.query(KnockoutStagePredictionDraft).count()
            + db.query(KnockoutStagePrediction).count()
            + db.query(MatchPrediction).count()
            + db.query(GroupStagePrediction).count()
            + db.query(ThirdPlacePrediction).count()
            + db.query(UserScores).count()
            + db.query(LeagueMembership).count()
        )
        if verify_count == 0:
            print("  ✅ All target tables verified empty.")
        else:
            print(f"  ⚠️  {verify_count} records still remain in target tables.")

        print()
        print("✅ Database reset complete.")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    reset_for_testing()
