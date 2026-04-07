#!/usr/bin/env python3
"""
Migration: Populate short_name for all teams (2026-03-20)

Populates the teams.short_name field with FIFA 3-letter codes.
The short_name column exists but is NULL for all teams, causing
team1_short_name/team2_short_name to be null in knockout predictions API.

Uses standard FIFA 3-letter codes (e.g. GER, USA, KOR).
Idempotent: only updates teams where short_name is NULL or empty.
"""

import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.team import Team


def normalize_team_name(name: str) -> str:
    """Normalize team name for lookup (matches update_team_flags.py)."""
    cleaned = name.strip().replace("Ã§", "c").replace("ç", "c")
    normalized = unicodedata.normalize("NFKD", cleaned)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_name.lower()


# FIFA 3-letter codes for WC 2026 teams (matches teams in update_team_flags.py)
SHORT_NAME_MAPPING = {
    # Group A
    "mexico": "MEX",
    "south africa": "RSA",
    "south korea": "KOR",
    "czechia": "CZE",
    # Group B
    "canada": "CAN",
    "bosnia-herzegovina": "BIH",
    "qatar": "QAT",
    "switzerland": "SUI",
    # Group C
    "brazil": "BRA",
    "morocco": "MAR",
    "haiti": "HAI",
    "scotland": "SCO",
    # Group D
    "united states": "USA",
    "paraguay": "PAR",
    "australia": "AUS",
    "turkey": "TUR",
    # Group E
    "germany": "GER",
    "curacao": "CUW",
    "ivory coast": "CIV",
    "ecuador": "ECU",
    # Group F
    "netherlands": "NED",
    "japan": "JPN",
    "sweden": "SWE",
    "tunisia": "TUN",
    # Group G
    "belgium": "BEL",
    "egypt": "EGY",
    "iran": "IRN",
    "new zealand": "NZL",
    # Group H
    "spain": "ESP",
    "cape verde": "CPV",
    "saudi arabia": "KSA",
    "uruguay": "URU",
    # Group I
    "france": "FRA",
    "senegal": "SEN",
    "iraq": "IRQ",
    "norway": "NOR",
    # Group J
    "argentina": "ARG",
    "algeria": "ALG",
    "austria": "AUT",
    "jordan": "JOR",
    # Group K
    "portugal": "POR",
    "congo dr": "COD",
    "uzbekistan": "UZB",
    "colombia": "COL",
    # Group L
    "england": "ENG",
    "croatia": "CRO",
    "ghana": "GHA",
    "panama": "PAN",
}


def run():
    db = SessionLocal()
    updated = 0
    skipped = 0
    no_mapping = []

    try:
        teams = db.query(Team).all()
        for team in teams:
            if team.short_name and team.short_name.strip():
                skipped += 1
                continue

            short_name = SHORT_NAME_MAPPING.get(normalize_team_name(team.name))
            if short_name:
                team.short_name = short_name
                updated += 1
                print(f"  ✅ {team.name} → {short_name}")
            else:
                no_mapping.append(team.name)
                print(f"  ⚠️ No short_name for: {team.name}")

        db.commit()
        print(f"\n[DONE] Updated {updated} teams with short_name")
        if skipped:
            print(f"  Skipped {skipped} (already had short_name)")
        if no_mapping:
            print(f"  ⚠️ {len(no_mapping)} teams without mapping: {no_mapping}")
    except Exception as e:
        db.rollback()
        print(f"[FATAL] Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
