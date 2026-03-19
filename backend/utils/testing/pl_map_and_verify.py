#!/usr/bin/env python3
"""
PL Sync Integration Test – Map external API IDs to our test matches.
Simulates what map_external_fixtures.py does for WC, but for PL test data.

Usage (needs FOOTBALL_DATA_API_KEY in env):
  python backend/utils/testing/pl_map_and_verify.py
"""

import sys
import os
import json
import unicodedata

# Point to backend root: utils/testing -> backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models.matches import Match
from models.team import Team
from services.external.football_data_client import FootballDataClient

PL_TEST_IDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pl_test_ids.json")

# football-data.org PL team names → our DB names (add as needed after ❌ output)
NAME_OVERRIDES = {
    "Chelsea FC": "Chelsea",
    "Newcastle United FC": "Newcastle",
    "Arsenal FC": "Arsenal",
    "Everton FC": "Everton",
    "West Ham United FC": "West Ham",
    "Manchester City FC": "Manchester City",
    "Manchester United FC": "Manchester United",
    "Aston Villa FC": "Aston Villa",
    "Liverpool FC": "Liverpool",
    "Tottenham Hotspur FC": "Tottenham",
}


def normalize(name: str | None) -> str:
    """Lowercase + NFKD + ascii encode (strip accents)."""
    if name is None:
        return ""
    name = NAME_OVERRIDES.get(name, name)
    nfd = unicodedata.normalize("NFKD", name)
    ascii_str = nfd.encode("ascii", "ignore").decode("ascii")
    return ascii_str.lower().strip()


def main():
    if not os.path.exists(PL_TEST_IDS_PATH):
        print(f"❌ {PL_TEST_IDS_PATH} not found. Run pl_sync_test_setup.py first.")
        return

    with open(PL_TEST_IDS_PATH) as f:
        data = json.load(f)

    saturday_date = data.get("saturday_date", "")
    sunday_date = data.get("sunday_date", "")
    match_ids = set(data.get("match_ids", []))

    db = SessionLocal()
    try:
        # Build our match index (only for test match IDs)
        teams = {t.id: t.name for t in db.query(Team).all()}
        matches = db.query(Match).filter(Match.id.in_(match_ids)).all()
        index = {}
        for m in matches:
            home_name = teams.get(m.home_team_id, "")
            away_name = teams.get(m.away_team_id, "")
            date_str = m.date.strftime("%Y-%m-%d") if m.date else ""
            key = (date_str, normalize(home_name), normalize(away_name))
            index[key] = m

        client = FootballDataClient()

        # Fetch API matches for both dates
        sat_matches = client.get_matches_on_date(saturday_date, "PL") if saturday_date else []
        sun_matches = client.get_matches_on_date(sunday_date, "PL") if sunday_date else []
        all_api_matches = sat_matches + sun_matches

        mapped = 0
        not_found = []

        for ext in all_api_matches:
            ext_id = ext.get("id")
            utc_date = ext.get("utcDate", "")
            date_str = utc_date[:10] if utc_date else ""
            home_api = ext.get("homeTeam", {}).get("name", "")
            away_api = ext.get("awayTeam", {}).get("name", "")

            home_norm = normalize(home_api)
            away_norm = normalize(away_api)
            key = (date_str, home_norm, away_norm)
            match = index.get(key)

            if match:
                match.external_api_id = ext_id
                mapped += 1
                print(f"  ✅ {home_api} vs {away_api} → match_id={match.id}, ext_id={ext_id}")
            else:
                not_found.append((home_api, away_api, ext_id))
                print(f"  ❌ Not found: {home_api} vs {away_api} (ext_id={ext_id}) — add to NAME_OVERRIDES if needed")

        db.commit()
        print(f"\nMapped {mapped} / 5")
        print(f"Not found {len(not_found)} / 5")
    finally:
        db.close()


if __name__ == "__main__":
    main()
