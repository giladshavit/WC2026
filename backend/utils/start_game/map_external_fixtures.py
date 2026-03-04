"""
One-time script: maps internal match IDs → football-data.org external IDs.
Saves the mapping by writing external_api_id to the matches table.
Run once before the tournament starts.

Run from project root:
  cd /path/to/WC-2026-clean
  FOOTBALL_DATA_API_KEY=your_key python backend/utils/start_game/map_external_fixtures.py

Or from backend directory:
  cd backend
  FOOTBALL_DATA_API_KEY=your_key python utils/start_game/map_external_fixtures.py

Note: The API may return ~42 teams (not 48) until all qualification spots
are filled. Matches involving TBD/unqualified teams will appear in "not found"
and can be re-mapped after running the script again once those teams are known.
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import requests
from sqlalchemy.orm import sessionmaker
from database import engine
from models.matches import Match
from models.team import Team

API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
BASE_URL = "https://api.football-data.org/v4"
COMPETITION_CODE = "WC"

# ─────────────────────────────────────────────
# Name normalization map
# football-data.org uses different spellings than our DB.
# Add entries here if matching fails for specific teams.
# Format: "football-data name" → "our DB name"
# ─────────────────────────────────────────────
NAME_OVERRIDES = {
    "USA": "United States",
    "IR Iran": "Iran",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Cape Verde Islands": "Cape Verde",
    # Add more as needed after running the script
}


def normalize(name: str | None) -> str:
    """Lowercase, strip, apply overrides."""
    if name is None:
        return ""
    name = NAME_OVERRIDES.get(name, name)
    return name.lower().strip()


def fetch_all_wc_matches() -> list[dict]:
    """Fetch all WC2026 matches from football-data.org."""
    headers = {"X-Auth-Token": API_KEY}
    try:
        response = requests.get(
            f"{BASE_URL}/competitions/{COMPETITION_CODE}/matches",
            headers=headers,
            timeout=15
        )
        response.raise_for_status()
        matches = response.json().get("matches", [])
        print(f"✅ Fetched {len(matches)} matches from API")
        return matches
    except Exception as e:
        print(f"❌ Error fetching matches: {e}")
        return []


def build_our_match_index(session) -> dict:
    """
    Build a lookup dict from our DB:
    key = (date_str YYYY-MM-DD, normalized_home_name, normalized_away_name)
    value = Match object
    """
    matches = session.query(Match).filter(
        Match.home_team_id.isnot(None),
        Match.away_team_id.isnot(None)
    ).all()

    # Build team id → name map
    teams = session.query(Team).all()
    team_map = {t.id: t.name for t in teams}

    index = {}
    for match in matches:
        home_name = normalize(team_map.get(match.home_team_id, ""))
        away_name = normalize(team_map.get(match.away_team_id, ""))
        if match.date:
            date_str = match.date.strftime("%Y-%m-%d")
            key = (date_str, home_name, away_name)
            index[key] = match

    print(f"📦 Built index for {len(index)} local matches")
    return index


def map_and_save(session, external_matches: list[dict], our_index: dict):
    """Match external fixtures to our DB records and save external_api_id."""
    mapped = 0
    skipped = 0
    not_found = []

    for ext in external_matches:
        ext_id = ext.get("id")
        utc_date = ext.get("utcDate", "")  # "2026-06-14T16:00:00Z"
        date_str = utc_date[:10] if utc_date else ""

        home_name = normalize(ext.get("homeTeam", {}).get("name", ""))
        away_name = normalize(ext.get("awayTeam", {}).get("name", ""))

        key = (date_str, home_name, away_name)
        match = our_index.get(key)

        if match:
            if match.external_api_id and match.external_api_id != ext_id:
                print(f"⚠️  Match {match.id} already has external_id={match.external_api_id}, overwriting with {ext_id}")
            match.external_api_id = ext_id
            mapped += 1
            print(f"  ✅ Mapped: [{match.id}] {ext.get('homeTeam',{}).get('name')} vs {ext.get('awayTeam',{}).get('name')} → ext_id={ext_id}")
        else:
            skipped += 1
            not_found.append({
                "date": date_str,
                "home": ext.get("homeTeam", {}).get("name"),
                "away": ext.get("awayTeam", {}).get("name"),
                "ext_id": ext_id
            })

    session.commit()

    print(f"\n{'='*50}")
    print(f"✅ Mapped:    {mapped}")
    print(f"❌ Not found: {skipped}")

    if not_found:
        print(f"\n⚠️  These API matches had no local match (check name mismatches):")
        for m in not_found:
            print(f"   {m['date']} | {m['home']} vs {m['away']} (ext_id={m['ext_id']})")
        print(f"\n💡 Add name overrides to NAME_OVERRIDES dict and re-run.")


def ensure_external_api_id_column() -> None:
    """Run migration if external_api_id column doesn't exist."""
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        columns = [col["name"] for col in inspector.get_columns("matches")]
        if "external_api_id" in columns:
            return
        print("Adding external_api_id column to matches table...")
        conn.execute(text("ALTER TABLE matches ADD COLUMN external_api_id INTEGER"))
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_matches_external_api_id ON matches (external_api_id)")
        )
        print("✅ Column added.")


def main():
    ensure_external_api_id_column()

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        external_matches = fetch_all_wc_matches()
        if not external_matches:
            print("No external matches fetched. Aborting.")
            return

        our_index = build_our_match_index(session)
        map_and_save(session, external_matches, our_index)
    finally:
        session.close()


if __name__ == "__main__":
    main()
