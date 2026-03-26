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
from collections import defaultdict

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


def build_our_match_index(session) -> tuple[dict, dict, dict]:
    """
    Build three lookup structures from our DB:
    - exact_index: (date_str, home_norm, away_norm) → Match (both teams set)
    - partial_index: (date_str, team_norm) → list[Match] (group stage, both teams set)
    - knockout_index: (date_str, time_hhmm) → Match (knockout placeholders, no home team yet)
    """
    matches = session.query(Match).filter(
        Match.home_team_id.isnot(None),
        Match.away_team_id.isnot(None)
    ).all()

    # Build team id → name map
    teams = session.query(Team).all()
    team_map = {t.id: t.name for t in teams}

    exact_index = {}
    for match in matches:
        home_name = normalize(team_map.get(match.home_team_id, ""))
        away_name = normalize(team_map.get(match.away_team_id, ""))
        if match.date:
            date_str = match.date.strftime("%Y-%m-%d")
            key = (date_str, home_name, away_name)
            exact_index[key] = match

    partial_index: dict = defaultdict(list)
    group_matches = session.query(Match).filter(
        Match.stage == "group",
        Match.home_team_id.isnot(None),
        Match.away_team_id.isnot(None),
    ).all()
    for match in group_matches:
        if not match.date:
            continue
        date_str = match.date.strftime("%Y-%m-%d")
        home_norm = normalize(team_map.get(match.home_team_id, ""))
        away_norm = normalize(team_map.get(match.away_team_id, ""))
        partial_index[(date_str, home_norm)].append(match)
        partial_index[(date_str, away_norm)].append(match)

    knockout_slot_lists: dict = defaultdict(list)
    knockout_candidates = session.query(Match).filter(Match.home_team_id.is_(None)).all()
    for match in knockout_candidates:
        if not match.date:
            continue
        date_str = match.date.strftime("%Y-%m-%d")
        time_hhmm = match.date.strftime("%H:%M")
        knockout_slot_lists[(date_str, time_hhmm)].append(match)

    knockout_index = {}
    for slot_key, slot_matches in knockout_slot_lists.items():
        if len(slot_matches) == 1:
            knockout_index[slot_key] = slot_matches[0]
        else:
            print(
                f"⚠️  Ambiguous knockout slot {slot_key[0]} {slot_key[1]}: "
                f"{len(slot_matches)} matches; skipping all from knockout index"
            )

    print(
        f"📦 Indexes built: exact={len(exact_index)}, "
        f"partial_teams={len(partial_index)}, knockout_slots={len(knockout_index)}"
    )
    return exact_index, partial_index, knockout_index


def map_and_save(
    session,
    external_matches: list[dict],
    exact_index: dict,
    partial_index: dict,
    knockout_index: dict,
):
    """Match external fixtures to our DB records and save external_api_id."""
    count_exact = 0
    count_partial = 0
    count_knockout = 0
    not_found = []

    for ext in external_matches:
        ext_id = ext.get("id")
        utc_date = ext.get("utcDate", "")  # "2026-06-14T16:00:00Z"
        date_str = utc_date[:10] if utc_date else ""

        home_name = normalize(ext.get("homeTeam", {}).get("name", ""))
        away_name = normalize(ext.get("awayTeam", {}).get("name", ""))

        match = None
        method = None

        # Strategy A — exact
        key_exact = (date_str, home_name, away_name)
        match = exact_index.get(key_exact)
        if match:
            method = "exact"

        # Strategy B — partial (group stage)
        if match is None:
            ext_home_raw = ext.get("homeTeam", {}).get("name") or ""
            ext_away_raw = ext.get("awayTeam", {}).get("name") or ""
            if ext_home_raw.strip() and ext_away_raw.strip():
                candidates_home = partial_index.get((date_str, home_name), [])
                candidates_away = partial_index.get((date_str, away_name), [])
                ids_home = {m.id for m in candidates_home}
                ids_away = {m.id for m in candidates_away}
                inter = ids_home & ids_away
                if len(inter) == 1:
                    mid = next(iter(inter))
                    match = next(m for m in candidates_home if m.id == mid)
                    method = "partial"

        # Strategy C — time-only knockout
        if match is None:
            time_hhmm = utc_date[11:16] if len(utc_date) >= 16 else ""
            key_ko = (date_str, time_hhmm)
            match = knockout_index.get(key_ko)
            if match:
                method = "knockout_time"

        if match:
            if match.external_api_id and match.external_api_id != ext_id:
                print(f"⚠️  Match {match.id} already has external_id={match.external_api_id}, overwriting with {ext_id}")
            match.external_api_id = ext_id
            if method == "exact":
                count_exact += 1
                print(
                    f"  ✅ exact: [{match.id}] {ext.get('homeTeam', {}).get('name')} vs "
                    f"{ext.get('awayTeam', {}).get('name')} → ext_id={ext_id}"
                )
            elif method == "partial":
                count_partial += 1
                print(
                    f"  🔶 partial: [{match.id}] {ext.get('homeTeam', {}).get('name')} vs "
                    f"{ext.get('awayTeam', {}).get('name')} → ext_id={ext_id}"
                )
            else:
                count_knockout += 1
                print(
                    f"  🕐 knockout_time: [{match.id}] {ext.get('homeTeam', {}).get('name')} vs "
                    f"{ext.get('awayTeam', {}).get('name')} → ext_id={ext_id}"
                )
        else:
            not_found.append({
                "date": date_str,
                "home": ext.get("homeTeam", {}).get("name"),
                "away": ext.get("awayTeam", {}).get("name"),
                "ext_id": ext_id
            })

    session.commit()

    print(f"\n{'='*50}")
    print(f"✅ Exact:         {count_exact}")
    print(f"🔶 Partial:       {count_partial}")
    print(f"🕐 Knockout time: {count_knockout}")
    print(f"❌ Not found:     {len(not_found)}")

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

        exact_index, partial_index, knockout_index = build_our_match_index(session)
        map_and_save(session, external_matches, exact_index, partial_index, knockout_index)
    finally:
        session.close()


if __name__ == "__main__":
    main()
