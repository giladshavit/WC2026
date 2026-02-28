#!/usr/bin/env python3
"""
One-time migration: backfill MatchPrediction rows for existing users who are missing them.

Creates empty match predictions (home_score=None, away_score=None) for all group-stage
matches for each user who doesn't already have them. Idempotent.

Usage:
  python utils/backfill_missing_match_predictions.py

Or call backfill_missing_match_predictions(db) from admin endpoint or other code.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from services.database import DBReader, DBWriter, DBUtils


def backfill_missing_match_predictions(db: Session) -> dict:
    """
    Create missing MatchPrediction rows for all users.
    For each user, creates empty predictions for group-stage matches they don't have.
    Uses DBReader/DBWriter only to avoid circular imports when run as script.
    Returns stats: users_processed, total_created.
    """
    users = DBReader.get_all_users(db)
    group_matches = DBReader.get_matches_by_stage(db, "group")
    total_created = 0

    for user in users:
        match_ids_to_create = []
        for match in group_matches:
            existing = DBReader.get_match_prediction(db, user.id, match.id)
            if existing is None:
                match_ids_to_create.append(match.id)

        if match_ids_to_create:
            DBWriter.bulk_create_match_predictions(db, user.id, match_ids_to_create)
            total_created += len(match_ids_to_create)
            print(f"  User {user.username} (id={user.id}): created {len(match_ids_to_create)} match predictions")

    DBUtils.commit(db)
    return {
        "users_processed": len(users),
        "total_created": total_created,
    }


def main() -> None:
    from database import SessionLocal

    db = SessionLocal()
    try:
        print("Backfilling missing match predictions for existing users...")
        result = backfill_missing_match_predictions(db)
        print(f"✅ Done. Processed {result['users_processed']} users, created {result['total_created']} match predictions.")
    except Exception as e:
        DBUtils.rollback(db)
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
