"""
Compare team names between our DB matches and football-data.org API.
Shows where names match, differ, or are missing.
Run before map_external_fixtures to identify NAME_OVERRIDES needed.

Run from project root:
  FOOTBALL_DATA_API_KEY=your_key python backend/utils/start_game/compare_team_names.py
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

NAME_OVERRIDES = {
    "USA": "United States",
    "IR Iran": "Iran",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Cape Verde Islands": "Cape Verde",
}


def normalize(name: str | None) -> str:
    if name is None:
        return ""
    name = NAME_OVERRIDES.get(name, name)
    return name.lower().strip()


def fetch_api_matches() -> list[dict]:
    headers = {"X-Auth-Token": API_KEY}
    try:
        response = requests.get(
            f"{BASE_URL}/competitions/{COMPETITION_CODE}/matches",
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        return response.json().get("matches", [])
    except Exception as e:
        print(f"❌ Error fetching API: {e}")
        return []


def get_our_teams(session) -> set[str]:
    """Unique team names from our DB (matches with both teams set)."""
    teams = session.query(Team).all()
    return {normalize(t.name) for t in teams if t.name}


def get_api_teams(api_matches: list[dict]) -> set[str]:
    """Unique team names from API matches."""
    names = set()
    for m in api_matches:
        h = m.get("homeTeam", {}).get("name")
        a = m.get("awayTeam", {}).get("name")
        if h:
            names.add(normalize(h))
        if a:
            names.add(normalize(a))
    return names


def teams_similar(api_name: str, our_name: str) -> bool:
    """True if names match (exact or one contains the other, e.g. Cape Verde vs Cape Verde Islands)."""
    if not api_name or not our_name:
        return False
    an = normalize(api_name)
    on = normalize(our_name)
    if an == on:
        return True
    if an in on or on in an:
        return True
    return False


def find_best_our_match(
    date_str: str,
    api_home: str,
    api_away: str,
    our_matches_by_date: dict[str, list[tuple[int, str, str]]],
) -> tuple[int | None, str, str] | None:
    """
    Find the single our match that best corresponds to this API match.
    Returns (our_match_id, our_home, our_away) or None.
    """
    ours = our_matches_by_date.get(date_str, [])
    if not ours:
        return None

    best = None
    best_score = -1

    for our_id, our_home, our_away in ours:
        home_ok = teams_similar(api_home, our_home)
        away_ok = teams_similar(api_away, our_away)
        score = (2 if home_ok else 0) + (2 if away_ok else 0)
        if score > best_score:
            best_score = score
            best = (our_id, our_home, our_away)

    return best if best and best_score > 0 else None


def get_our_match_index(session) -> tuple[dict, dict[str, list[tuple[int, str, str]]]]:
    """
    Returns (index, matches_by_date).
    index: key = (date_str, norm_home, norm_away), value = (match_id, our_home_name, our_away_name)
    matches_by_date: date_str -> [(match_id, our_home, our_away), ...]
    """
    matches = session.query(Match).filter(
        Match.home_team_id.isnot(None),
        Match.away_team_id.isnot(None),
    ).all()
    teams = session.query(Team).all()
    team_map = {t.id: t.name for t in teams}

    index = {}
    matches_by_date: dict[str, list[tuple[int, str, str]]] = {}
    for match in matches:
        home_name = team_map.get(match.home_team_id, "")
        away_name = team_map.get(match.away_team_id, "")
        if match.date and home_name and away_name:
            date_str = match.date.strftime("%Y-%m-%d")
            key = (date_str, normalize(home_name), normalize(away_name))
            index[key] = (match.id, home_name, away_name)
            matches_by_date.setdefault(date_str, []).append((match.id, home_name, away_name))
    return index, matches_by_date


def main():
    print("=" * 60)
    print("Team Name Comparison: Our DB vs football-data.org API")
    print("=" * 60)

    api_matches = fetch_api_matches()
    if not api_matches:
        print("No API matches. Aborting.")
        return

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        our_teams = get_our_teams(session)
        api_teams = get_api_teams(api_matches)
        our_index, our_matches_by_date = get_our_match_index(session)

        # Team-level comparison
        exact = our_teams & api_teams
        only_ours = our_teams - api_teams
        only_api = api_teams - our_teams

        print(f"\n📊 Our teams: {len(our_teams)}")
        print(f"📊 API teams: {len(api_teams)}")
        print(f"\n✅ Exact matches ({len(exact)}): {', '.join(sorted(exact))}")
        if only_ours:
            print(f"\n⚠️  Only in our DB ({len(only_ours)}): {', '.join(sorted(only_ours))}")
        if only_api:
            print(f"\n⚠️  Only in API ({len(only_api)}): {', '.join(sorted(only_api))}")

        # Per-match comparison
        print(f"\n{'=' * 60}")
        print("Per-Match Comparison")
        print("=" * 60)

        matched = []
        name_mismatch = []
        not_in_ours = []

        for ext in api_matches:
            ext_id = ext.get("id")
            date_str = (ext.get("utcDate") or "")[:10]
            api_home = ext.get("homeTeam", {}).get("name") or "TBD"
            api_away = ext.get("awayTeam", {}).get("name") or "TBD"
            key = (date_str, normalize(api_home), normalize(api_away))
            our_match = our_index.get(key)

            if our_match:
                our_id, our_h, our_a = our_match
                matched.append((ext_id, date_str, api_home, api_away, our_id, our_h, our_a))
            elif not api_home or not api_away or api_home == "TBD" or api_away == "TBD":
                best = find_best_our_match(date_str, api_home, api_away, our_matches_by_date)
                not_in_ours.append((ext_id, date_str, api_home, api_away, best))
            else:
                best = find_best_our_match(date_str, api_home, api_away, our_matches_by_date)
                name_mismatch.append((ext_id, date_str, api_home, api_away, best))

        print(f"\n✅ Matched ({len(matched)}):")
        print("   API id | API: שלהם  →  Ours id | Ours: שלנו")
        for ext_id, d, api_h, api_a, our_id, our_h, our_a in matched[:15]:
            print(f"   {ext_id} | {d} {api_h} vs {api_a}  →  {our_id} | {our_h} vs {our_a}")
        if len(matched) > 15:
            print(f"   ... and {len(matched) - 15} more")

        if name_mismatch:
            print(f"\n⚠️  Name mismatch ({len(name_mismatch)}):")
            print("   API id | API: שלהם  →  Ours id | Ours: שלנו")
            for ext_id, d, api_h, api_a, best in name_mismatch:
                if best:
                    our_id, our_h, our_a = best
                    print(f"   {ext_id} | {d} {api_h} vs {api_a}  →  {our_id} | {our_h} vs {our_a}")
                else:
                    print(f"   {ext_id} | {d} {api_h} vs {api_a}  →  (לא נמצא משחק תואם)")
            print("   💡 Add API names to NAME_OVERRIDES in map_external_fixtures.py if they match our names.")

        if not_in_ours:
            print(f"\n❌ TBD / Not in our DB ({len(not_in_ours)}):")
            print("   API id | API: שלהם  →  Ours id | Ours: שלנו")
            for ext_id, d, api_h, api_a, best in not_in_ours:
                if best:
                    our_id, our_h, our_a = best
                    print(f"   {ext_id} | {d} {api_h} vs {api_a}  →  {our_id} | {our_h} vs {our_a}")
                else:
                    print(f"   {ext_id} | {d} {api_h} vs {api_a}  →  (לא נמצא משחק תואם)")

        print(f"\n{'=' * 60}")
        print(f"Summary: ✅ {len(matched)} matched  ⚠️ {len(name_mismatch)} name_mismatch  ❌ {len(not_in_ours)} not_in_ours")
        print("=" * 60)
    finally:
        session.close()


if __name__ == "__main__":
    main()
