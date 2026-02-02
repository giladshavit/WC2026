"""
Create empty knockout predictions for a specific user.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from services.database import DBUtils
from services.predictions.knockout_service import KnockoutService


def main() -> None:
    user_id = 1
    db = SessionLocal()
    try:
        created = KnockoutService.create_user_knockout_predictions(db, user_id)
        DBUtils.commit(db)
        print(f"Created {len(created)} knockout predictions for user {user_id}.")
    except Exception as exc:
        DBUtils.rollback(db)
        print(f"Error creating knockout predictions for user {user_id}: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
