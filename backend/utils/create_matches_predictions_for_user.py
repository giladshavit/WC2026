#!/usr/bin/env python3
"""
Create match predictions for a given user for all group-stage matches.

Usage:
  python utils/create_matches_predictions_for_user.py <user_id>

Behavior:
  - For every match in stage=="group", create or update a MatchPrediction for the user
  - Defaults to 0-0 with predicted_winner=None (draw)
  - Ensures is_editable=True so users can edit after initialization
  - Does not touch knockout predictions
"""

import sys
import os
from typing import Optional

# Ensure we can import backend modules when running from project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import sessionmaker

from database import engine
from models.matches import Match
from models.predictions import MatchPrediction


def create_group_matches_predictions(user_id: int) -> None:
    """Create or update match predictions for all group-stage matches for a user."""
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Ensure tables exist
        Match.__table__.create(engine, checkfirst=True)
        MatchPrediction.__table__.create(engine, checkfirst=True)

        group_matches = (
            session.query(Match)
            .filter(Match.stage == "group")
            .order_by(Match.id)
            .all()
        )

        if not group_matches:
            print("No group-stage matches found. Nothing to create.")
            return

        created_count = 0
        updated_count = 0

        for match in group_matches:
            # Upsert logic for user's prediction for this match
            existing: Optional[MatchPrediction] = (
                session.query(MatchPrediction)
                .filter(
                    MatchPrediction.user_id == user_id,
                    MatchPrediction.match_id == match.id,
                )
                .first()
            )

            if existing is None:
                # Create default 0-0 draw prediction, editable
                prediction = MatchPrediction(
                    user_id=user_id,
                    match_id=match.id,
                    home_score=0,
                    away_score=0,
                    predicted_winner=None,
                    is_editable=True,
                )
                session.add(prediction)
                created_count += 1
            else:
                # Ensure editable; do not overwrite scores if user already set them
                if existing.is_editable is False:
                    existing.is_editable = True
                    updated_count += 1

        session.commit()
        print(
            f"Done. Created {created_count} new group match predictions, updated {updated_count} to editable."
        )

    except Exception as e:
        session.rollback()
        print(f"Error creating group match predictions: {e}")
        raise
    finally:
        session.close()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python utils/create_matches_predictions_for_user.py <user_id>")
        sys.exit(1)

    try:
        user_id = int(sys.argv[1])
    except ValueError:
        print("<user_id> must be an integer")
        sys.exit(1)

    print(f"Creating group match predictions for user_id={user_id}...")
    create_group_matches_predictions(user_id)


if __name__ == "__main__":
    main()


