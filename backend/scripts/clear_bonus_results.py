#!/usr/bin/env python3
"""
Script to clear all bonus results (correct answers) from the database.
Sets all _correct and _interim columns on bonus_results to None.
The table row (id=1) remains; only the result values are cleared.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.results import BonusResults
from services.database import DBUtils

# All result columns to clear (both _correct and _interim)
RESULT_COLUMNS = [
    "g1_correct", "g2_correct", "g3_correct", "g4_correct", "g5_correct",
    "k1_correct", "k2_correct", "k3_correct", "t1_correct", "t2_correct",
    "g1_interim", "g2_interim", "g3_interim", "g4_interim", "g5_interim",
    "k1_interim", "k2_interim", "k3_interim", "t1_interim", "t2_interim",
]


def main() -> None:
    db = SessionLocal()
    try:
        row = db.query(BonusResults).filter_by(id=1).first()
        if not row:
            print("No bonus_results row found (id=1). Nothing to clear.")
            return

        # Count non-null values before clearing
        before = sum(1 for col in RESULT_COLUMNS if getattr(row, col) is not None)

        for col in RESULT_COLUMNS:
            setattr(row, col, None)

        DBUtils.commit(db)
        print(f"Cleared {before} bonus result value(s). All bonus results are now empty.")
    except Exception as exc:
        DBUtils.rollback(db)
        print(f"Error clearing bonus results: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
