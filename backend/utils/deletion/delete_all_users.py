#!/usr/bin/env python3
"""
Script to delete all users from the database.
Deletes from all tables that reference users: league_memberships, leagues,
predictions (match, group, third_place, knockout, knockout_draft, bonus), user_scores.
"""

import sys
import os

# Add the backend directory to the Python path (deletion -> utils -> backend)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import SQLALCHEMY_DATABASE_URL
from models.user import User
from models.user_scores import UserScores
from models.league import League, LeagueMembership
from models.predictions import (
    BonusPrediction,
    MatchPrediction,
    GroupStagePrediction,
    ThirdPlacePrediction,
    KnockoutStagePrediction,
    KnockoutStagePredictionDraft,
)


def delete_all_users():
    """Delete all users and all related data."""
    connect_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        print("Starting deletion of all users and related data...")

        # Count before
        user_count = db.query(User).count()
        league_count = db.query(League).count()
        print(f"\nUsers to delete: {user_count}")
        print(f"Leagues to delete: {league_count}")

        if user_count == 0 and league_count == 0:
            print("No users or leagues found.")
            return

        # Delete in order (respecting foreign keys)
        print("\nDeleting related data...")

        deleted_leagues = db.query(League).delete()
        print(f"  - Leagues: {deleted_leagues}")

        deleted_memberships = db.query(LeagueMembership).delete()
        print(f"  - League memberships: {deleted_memberships}")

        deleted_draft = db.query(KnockoutStagePredictionDraft).delete()
        print(f"  - Knockout draft predictions: {deleted_draft}")

        deleted_match = db.query(MatchPrediction).delete()
        print(f"  - Match predictions: {deleted_match}")

        deleted_group = db.query(GroupStagePrediction).delete()
        print(f"  - Group stage predictions: {deleted_group}")

        deleted_third = db.query(ThirdPlacePrediction).delete()
        print(f"  - Third place predictions: {deleted_third}")

        deleted_knockout = db.query(KnockoutStagePrediction).delete()
        print(f"  - Knockout stage predictions: {deleted_knockout}")

        deleted_bonus = db.query(BonusPrediction).delete()
        print(f"  - Bonus predictions: {deleted_bonus}")

        deleted_scores = db.query(UserScores).delete()
        print(f"  - User scores: {deleted_scores}")

        deleted_users = db.query(User).delete()
        print(f"  - Users: {deleted_users}")

        db.commit()

        total = (
            deleted_memberships
            + deleted_leagues
            + deleted_draft
            + deleted_match
            + deleted_group
            + deleted_third
            + deleted_knockout
            + deleted_bonus
            + deleted_scores
            + deleted_users
        )
        print(f"\n✅ Successfully deleted {total} records ({deleted_users} users)")

        # Verify
        remaining = db.query(User).count()
        if remaining == 0:
            print("✅ All users have been successfully deleted!")
        else:
            print(f"⚠️  {remaining} users still remain.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    delete_all_users()
