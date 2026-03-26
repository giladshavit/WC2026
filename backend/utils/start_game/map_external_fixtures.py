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
    - exact_index: (date_str, home_norm, away_norm) → Match (group stage, both teams set)
    - partial_index: (date_str, team_norm) → list[Match] (group stage, both teams set)
    - knockout_index: (date_str, time_hhmm) → Match (non-group stages, regardless of teams)
    """
    matches = session.query(Match).all()

    # Build team id → name map
    teams = session.query(Team).all()
    team_map = {t.id: t.name for t in teams}

    exact_index = {}
    partial_index: dict = defaultdict(list)
    knockout_slot_lists: dict = defaultdict(list)

    for match in matches:
        if not match.date:
            continue
        date_str = match.date.strftime("%Y-%m-%d")

        if (
            match.stage == "group"
            and match.home_team_id is not None
            and match.away_team_id is not None
        ):
            home_norm = normalize(team_map.get(match.home_team_id, ""))
            away_norm = normalize(team_map.get(match.away_team_id, ""))
            exact_index[(date_str, home_norm, away_norm)] = match
            partial_index[(date_str, home_norm)].append(match)
            partial_index[(date_str, away_norm)].append(match)
        elif match.stage != "group":
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

        ext_home_raw = ext.get("homeTeam", {}).get("name") or ""
        ext_away_raw = ext.get("awayTeam", {}).get("name") or ""

        home_name = normalize(ext_home_raw)
        away_name = normalize(ext_away_raw)

        match = None
        method = None

        # Strategy A — exact
        key_exact = (date_str, home_name, away_name)
        match = exact_index.get(key_exact)
        if match:
            method = "exact"

        # Strategy B — partial match (one team known, group stage)
        if match is None:
            has_home = bool(ext_home_raw.strip())
            has_away = bool(ext_away_raw.strip())

            if has_home and has_away:
                # Both teams known: require intersection of both
                candidates_home = partial_index.get((date_str, home_name), [])
                candidates_away = partial_index.get((date_str, away_name), [])
                ids_home = {m.id for m in candidates_home}
                ids_away = {m.id for m in candidates_away}
                inter = ids_home & ids_away
                if len(inter) == 1:
                    mid = next(iter(inter))
                    match = next(m for m in candidates_home if m.id == mid)
                    method = "partial"
            elif has_home and not has_away:
                # Only home team known: match by (date, home_team)
                candidates = partial_index.get((date_str, home_name), [])
                if len(candidates) == 1:
                    match = candidates[0]
                    method = "partial"
            elif has_away and not has_home:
                # Only away team known: match by (date, away_team)
                candidates = partial_index.get((date_str, away_name), [])
                if len(candidates) == 1:
                    match = candidates[0]
                    method = "partial"

        # Strategy C — time-only knockout (TBD: no home name on API)
        if match is None and not ext_home_raw.strip() and not ext_away_raw.strip():
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
