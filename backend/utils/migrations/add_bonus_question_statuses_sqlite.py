#!/usr/bin/env python3
"""
Migration: Add per-question status columns to bonus_predictions table.
SQLite only, no dependencies. Run: python3 utils/migrations/add_bonus_question_statuses_sqlite.py
"""
import os
import sqlite3

# DB path: same as database.py default
_db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_default_path = os.path.join(_db_dir, "world_cup_predictions.db")
DB_PATH = os.environ.get("DATABASE_URL", f"sqlite:///{_default_path}").replace("sqlite:///", "")

NEW_COLUMNS = [
    ("q_g1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g3_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g4_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_g5_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_k3_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_t1_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("q_t2_status", "TEXT NOT NULL DEFAULT 'pending'"),
    ("bonus_score", "INTEGER NOT NULL DEFAULT 0"),
]

if __name__ == "__main__":
    print(f"DB: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for col_name, col_def in NEW_COLUMNS:
        try:
            cur.execute(f"ALTER TABLE bonus_predictions ADD COLUMN {col_name} {col_def}")
            print(f"✓ Added: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"- Skipped {col_name}: already exists")
            else:
                raise
    conn.commit()
    conn.close()
    print("Done.")
