#!/usr/bin/env python3
"""Migration: Add bonus_results table (single-row, id=1) for storing correct answers."""
import os
import sys

_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

_db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_default_sqlite = f"sqlite:///{os.path.join(_db_dir, 'world_cup_predictions.db')}"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)

from sqlalchemy import create_engine, text


def run():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bonus_results (
                id INTEGER PRIMARY KEY,
                g1_correct TEXT,
                g2_correct TEXT,
                g3_correct TEXT,
                g4_correct TEXT,
                g5_correct TEXT,
                k1_correct TEXT,
                k2_correct TEXT,
                k3_correct TEXT,
                t1_correct TEXT,
                t2_correct TEXT
            )
        """))
        conn.execute(text(
            "INSERT OR IGNORE INTO bonus_results (id) VALUES (1)"
        ))
        conn.commit()
    print("Done: bonus_results table created")


if __name__ == "__main__":
    run()
