"""
Reset is_eliminated for all teams to False.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from services.database import DBReader, DBWriter, DBUtils


def main() -> None:
    db = SessionLocal()
    try:
        teams = DBReader.get_all_teams(db)
        for team in teams:
            DBWriter.update_team_eliminated(db, team, False)
        DBUtils.commit(db)
        print(f"Reset is_eliminated for {len(teams)} teams.")
    except Exception as exc:
        DBUtils.rollback(db)
        print(f"Error resetting team elimination: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
