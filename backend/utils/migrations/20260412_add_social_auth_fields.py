#!/usr/bin/env python3
"""
Migration: Social auth identifiers on users (2026-04-12)

- ADD COLUMN google_id VARCHAR(255) NULL UNIQUE (via unique index)
- ADD COLUMN apple_id VARCHAR(255) NULL UNIQUE (via unique index)
- Unique indexes support fast lookup and enforce uniqueness on non-null values

Idempotent: skips steps when the column or index already exists.
Uses psycopg2 only (no SQLAlchemy / Alembic).
"""

from __future__ import annotations

import os
import sys

import psycopg2

INDEX_GOOGLE = "idx_users_google_id"
INDEX_APPLE = "idx_users_apple_id"


def _require_database_url() -> str:
    url = (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        print("[ERROR] DATABASE_URL is not set or empty", file=sys.stderr)
        sys.exit(1)
    if "postgresql" not in url and "postgres" not in url:
        print(
            "[ERROR] This migration expects a PostgreSQL DATABASE_URL",
            file=sys.stderr,
        )
        sys.exit(1)
    return url


def _column_exists(cur, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name = %s
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def _index_exists(cur, index_name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = %s",
        (index_name,),
    )
    return cur.fetchone() is not None


def _add_column(
    cur,
    table: str,
    column: str,
    ddl: str,
) -> None:
    if _column_exists(cur, table, column):
        print(f"[SKIP] {table}: column {column} already exists")
        return
    cur.execute(ddl)
    print(f"[OK] {table}: added column {column}")


def _add_unique_index(cur, index_name: str, table: str, column: str) -> None:
    if _index_exists(cur, index_name):
        print(f"[SKIP] {table}: unique index {index_name} already exists")
        return
    cur.execute(
        f'CREATE UNIQUE INDEX "{index_name}" ON "{table}" ("{column}")'
    )
    print(f"[OK] {table}: created unique index {index_name} on {column}")


def run() -> None:
    database_url = _require_database_url()
    conn = psycopg2.connect(database_url)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            _add_column(
                cur,
                "users",
                "google_id",
                "ALTER TABLE users ADD COLUMN google_id VARCHAR(255)",
            )
            _add_unique_index(cur, INDEX_GOOGLE, "users", "google_id")

            _add_column(
                cur,
                "users",
                "apple_id",
                "ALTER TABLE users ADD COLUMN apple_id VARCHAR(255)",
            )
            _add_unique_index(cur, INDEX_APPLE, "users", "apple_id")

        print("[DONE] Migration 20260412_add_social_auth_fields completed")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
