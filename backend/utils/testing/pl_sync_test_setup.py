#!/usr/bin/env python3
"""
PL Sync Integration Test – Setup & Teardown.
Inserts 10 PL teams + 5 matches for testing, or removes them.

Usage:
  python backend/utils/testing/pl_sync_test_setup.py          # setup
  python backend/utils/testing/pl_sync_test_setup.py --teardown   # teardown
"""

import sys
import os
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from sqlalchemy.sql import bindparam

# Point to backend root: utils/testing -> backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.team import Team
from models.matches import Match

PL_TEST_IDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pl_test_ids.json")

PL_TEAMS = [
    ("Chelsea", "CHE"),
    ("Newcastle", "NEW"),
    ("Arsenal", "ARS"),
    ("Everton", "EVE"),
    ("West Ham", "WHU"),
    ("Manchester City", "MCI"),
    ("Manchester United", "MUN"),
    ("Aston Villa", "AVL"),
    ("Liverpool", "LIV"),
    ("Tottenham", "TOT"),
]

SATURDAY_MATCHES = [
    ("Chelsea", "Newcastle"),
    ("Arsenal", "Everton"),
    ("West Ham", "Manchester City"),
]
SUNDAY_MATCHES = [
    ("Manchester United", "Aston Villa"),
    ("Liverpool", "Tottenham"),
]


def _next_saturday() -> datetime.date:
    today = datetime.now(timezone.utc).date()
    days_until_saturday = (5 - today.weekday()) % 7
    if days_until_saturday == 0:
        return today
    return today + timedelta(days=days_until_saturday)


def setup():
    db = SessionLocal()
    try:
        saturday = _next_saturday()
        sunday = saturday + timedelta(days=1)

        team_ids = []
        name_to_id = {}

        for name, short_name in PL_TEAMS:
            team = Team(
                name=name,
                short_name=short_name,
                group_letter=None,
                group_position=None,
                is_eliminated=False,
                flag_url=None,
            )
            db.add(team)
            db.flush()
            team_ids.append(team.id)
            name_to_id[name] = team.id
            print(f"  Team: {name} ({short_name}) → id={team.id}")

        match_ids = []
        sat_15 = datetime(saturday.year, saturday.month, saturday.day, 15, 0, 0, tzinfo=timezone.utc)
        sun_15 = datetime(sunday.year, sunday.month, sunday.day, 15, 0, 0, tzinfo=timezone.utc)

        for home, away in SATURDAY_MATCHES:
            m = Match(
                stage="group",
                status="scheduled",
                group=None,
                external_api_id=None,
                match_number=None,
                home_team_id=name_to_id[home],
                away_team_id=name_to_id[away],
                date=sat_15,
            )
            db.add(m)
            db.flush()
            match_ids.append(m.id)
            print(f"  Match: {home} vs {away} (Sat {saturday}) → id={m.id}")

        for home, away in SUNDAY_MATCHES:
            m = Match(
                stage="group",
                status="scheduled",
                group=None,
                external_api_id=None,
                match_number=None,
                home_team_id=name_to_id[home],
                away_team_id=name_to_id[away],
                date=sun_15,
            )
            db.add(m)
            db.flush()
            match_ids.append(m.id)
            print(f"  Match: {home} vs {away} (Sun {sunday}) → id={m.id}")

        db.commit()

        data = {
            "team_ids": team_ids,
            "match_ids": match_ids,
            "saturday_date": saturday.strftime("%Y-%m-%d"),
            "sunday_date": sunday.strftime("%Y-%m-%d"),
        }
        with open(PL_TEST_IDS_PATH, "w") as f:
            json.dump(data, f, indent=2)
        print(f"\n✅ Saved {PL_TEST_IDS_PATH}")
        print(f"   Saturday: {data['saturday_date']}, Sunday: {data['sunday_date']}")
    finally:
        db.close()


def teardown():
    if not os.path.exists(PL_TEST_IDS_PATH):
        print("⚠️ pl_test_ids.json not found — nothing to teardown. Exiting.")
        return

    with open(PL_TEST_IDS_PATH) as f:
        data = json.load(f)

    team_ids = data.get("team_ids", [])
    match_ids = data.get("match_ids", [])

    db = SessionLocal()
    try:
        # 1. Delete matches first (avoid FK issues)
        if match_ids:
            try:
                before_m = db.execute(text("SELECT COUNT(*) FROM matches WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": match_ids}).scalar()
                db.execute(text("DELETE FROM matches WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": match_ids})
                db.commit()
                after_m = db.execute(text("SELECT COUNT(*) FROM matches WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": match_ids}).scalar() if match_ids else 0
                print(f"  ✅ Matches: before={before_m} → after={after_m} (deleted {len(match_ids)})")
            except Exception as e:
                db.rollback()
                print(f"  ❌ Failed to delete matches: {e}")
        else:
            print("  (no match_ids to delete)")

        # 2. Delete teams
        if team_ids:
            try:
                before_t = db.execute(text("SELECT COUNT(*) FROM teams WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": team_ids}).scalar()
                db.execute(text("DELETE FROM teams WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)), {"ids": team_ids})
                db.commit()
                print(f"  ✅ Deleted {len(team_ids)} teams from teams table")
            except Exception as e:
                db.rollback()
                print(f"  ❌ Failed to delete teams: {e}")
        else:
            print("  (no team_ids to delete)")

        # 3. Delete pl_test_ids.json
        try:
            os.remove(PL_TEST_IDS_PATH)
            print(f"  ✅ Removed {PL_TEST_IDS_PATH}")
        except Exception as e:
            print(f"  ❌ Failed to remove JSON: {e}")

    finally:
        db.close()


if __name__ == "__main__":
    if "--teardown" in sys.argv:
        teardown()
    else:
        setup()
