"""
Fill knockout_result_id for existing MatchTemplate records.
"""
import os
import sys
from typing import List
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from services.database import DBReader, DBUtils


def fill_knockout_result_ids(db: Session) -> int:
    """
    Fill knockout_result_id for existing MatchTemplate records.
    Returns count of updated records.
    """
    templates = DBReader.get_all_knockout_templates(db)
    updated = 0

    for template in templates:
        if template.knockout_result_id:
            continue

        result = DBReader.get_knockout_result(db, template.id)
        if result:
            template.knockout_result_id = result.id
            updated += 1

    DBUtils.commit(db)
    return updated


def main() -> None:
    db = SessionLocal()
    try:
        updated = fill_knockout_result_ids(db)
        print(f"Updated {updated} match templates with knockout_result_id.")
    except Exception as exc:
        DBUtils.rollback(db)
        print(f"Error filling knockout_result_id: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
