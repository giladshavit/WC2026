#!/usr/bin/env python3
"""
Migration: Bonus schema cleanup (2026-03-19)

- DROP COLUMN t2_scoreless_draws from bonus_predictions (deprecated)
- ADD COLUMN g6_interim, t3_correct, t3_interim to bonus_results

Idempotent: uses IF EXISTS / IF NOT EXISTS where supported.
Each operation in its own try/except — one failure does not stop the rest.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "")
IS_POSTGRES = "postgresql" in DATABASE_URL


def _sqlite_column_exists(db, table: str, column: str) -> bool:
    """Check if column exists in SQLite table using pragma table_info."""
    result = db.execute(text(f"PRAGMA table_info({table})"))
    rows = result.fetchall()
    return any(row[1] == column for row in rows)


def _sqlite_table_columns(db, table: str) -> list:
    """Get list of column names for SQLite table."""
    result = db.execute(text(f"PRAGMA table_info({table})"))
    rows = result.fetchall()
    return [row[1] for row in rows]


def drop_t2_scoreless_draws(db):
    """Drop deprecated t2_scoreless_draws column from bonus_predictions."""
    try:
        if IS_POSTGRES:
            db.execute(text(
                "ALTER TABLE bonus_predictions DROP COLUMN IF EXISTS t2_scoreless_draws"
            ))
            print("[OK] bonus_predictions: DROP COLUMN t2_scoreless_draws (PostgreSQL)")
        else:
            if _sqlite_column_exists(db, "bonus_predictions", "t2_scoreless_draws"):
                db.execute(text(
                    "ALTER TABLE bonus_predictions DROP COLUMN t2_scoreless_draws"
                ))
                print("[OK] bonus_predictions: DROP COLUMN t2_scoreless_draws (SQLite)")
            else:
                print("[SKIP] bonus_predictions: t2_scoreless_draws does not exist")
    except Exception as e:
        print(f"[ERROR] bonus_predictions DROP COLUMN t2_scoreless_draws: {e}")


def add_bonus_results_g6_interim(db):
    """Add g6_interim column to bonus_results."""
    try:
        if IS_POSTGRES:
            db.execute(text(
                "ALTER TABLE bonus_results ADD COLUMN IF NOT EXISTS g6_interim TEXT"
            ))
            print("[OK] bonus_results: ADD COLUMN g6_interim (PostgreSQL)")
        else:
            if "g6_interim" not in _sqlite_table_columns(db, "bonus_results"):
                db.execute(text(
                    "ALTER TABLE bonus_results ADD COLUMN g6_interim TEXT"
                ))
                print("[OK] bonus_results: ADD COLUMN g6_interim (SQLite)")
            else:
                print("[SKIP] bonus_results: g6_interim already exists")
    except Exception as e:
        print(f"[ERROR] bonus_results ADD COLUMN g6_interim: {e}")


def add_bonus_results_t3_correct(db):
    """Add t3_correct column to bonus_results."""
    try:
        if IS_POSTGRES:
            db.execute(text(
                "ALTER TABLE bonus_results ADD COLUMN IF NOT EXISTS t3_correct TEXT"
            ))
            print("[OK] bonus_results: ADD COLUMN t3_correct (PostgreSQL)")
        else:
            if "t3_correct" not in _sqlite_table_columns(db, "bonus_results"):
                db.execute(text(
                    "ALTER TABLE bonus_results ADD COLUMN t3_correct TEXT"
                ))
                print("[OK] bonus_results: ADD COLUMN t3_correct (SQLite)")
            else:
                print("[SKIP] bonus_results: t3_correct already exists")
    except Exception as e:
        print(f"[ERROR] bonus_results ADD COLUMN t3_correct: {e}")


def add_bonus_results_t3_interim(db):
    """Add t3_interim column to bonus_results."""
    try:
        if IS_POSTGRES:
            db.execute(text(
                "ALTER TABLE bonus_results ADD COLUMN IF NOT EXISTS t3_interim TEXT"
            ))
            print("[OK] bonus_results: ADD COLUMN t3_interim (PostgreSQL)")
        else:
            if "t3_interim" not in _sqlite_table_columns(db, "bonus_results"):
                db.execute(text(
                    "ALTER TABLE bonus_results ADD COLUMN t3_interim TEXT"
                ))
                print("[OK] bonus_results: ADD COLUMN t3_interim (SQLite)")
            else:
                print("[SKIP] bonus_results: t3_interim already exists")
    except Exception as e:
        print(f"[ERROR] bonus_results ADD COLUMN t3_interim: {e}")


def run():
    db = SessionLocal()
    try:
        drop_t2_scoreless_draws(db)
        add_bonus_results_g6_interim(db)
        add_bonus_results_t3_correct(db)
        add_bonus_results_t3_interim(db)
        db.commit()
        print("[DONE] Migration 20260319_bonus_schema_cleanup completed")
    except Exception as e:
        db.rollback()
        print(f"[FATAL] Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
