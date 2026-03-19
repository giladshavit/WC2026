#!/usr/bin/env python3
"""
PL Sync Integration Test – Run all 4 validation checks end-to-end.

Usage:
  python backend/utils/testing/pl_sync_test_run.py
"""

import sys
import os
import json

# Point to backend root: utils/testing -> backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from services.external.football_data_client import FootballDataClient
from services.external.match_sync_service import MatchSyncService
from services.database import DBReader
from services.results_service import ResultsService

PL_TEST_IDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pl_test_ids.json")


def load_test_ids():
    if not os.path.exists(PL_TEST_IDS_PATH):
        return None
    with open(PL_TEST_IDS_PATH) as f:
        return json.load(f)


def run_checks():
    results = {"check1": False, "check2": False, "check3_info": None, "check4": False}

    # Check 1 — API connectivity
    print("Check 1: API connectivity...")
    try:
        client = FootballDataClient()
        resp = client.get_live_matches(competition_code="PL")
        if isinstance(resp, list):
            results["check1"] = True
            print("  ✅ PASS: API returns a list (may be empty)")
        else:
            print(f"  ❌ FAIL: Expected list, got {type(resp)}")
    except Exception as e:
        print(f"  ❌ FAIL: {e}")

    # Check 2 — get_matches_today includes our test matches
    print("\nCheck 2: get_matches_today includes our test matches...")
    test_ids = load_test_ids()
    if not test_ids:
        print("  ❌ FAIL: pl_test_ids.json not found — run pl_sync_test_setup.py first")
    else:
        match_ids = set(test_ids.get("match_ids", []))
        db = SessionLocal()
        try:
            matches_today = DBReader.get_matches_today(db)
            our_matches = [m for m in matches_today if m.id in match_ids]
            if our_matches:
                results["check2"] = True
                for m in our_matches:
                    home = m.home_team.name if m.home_team else "?"
                    away = m.away_team.name if m.away_team else "?"
                    dt = m.date.strftime("%Y-%m-%d %H:%M") if m.date else "?"
                    print(f"  Match {m.id}: {home} vs {away} at {dt} UTC")
                print("  ✅ PASS: Our test matches appear in get_matches_today")
            else:
                print("  ❌ FAIL: Our test matches not found in get_matches_today")
                print("  → Dates may not be today — run setup on the actual test day (Saturday/Sunday)")
        finally:
            db.close()

    # Check 3 — is_within_active_window (INFO only)
    print("\nCheck 3: is_within_active_window (info only)...")
    try:
        within = MatchSyncService.is_within_active_window()
        results["check3_info"] = within
        print(f"  ℹ️  is_within_active_window = {within}")
        print("  → True if within 5 min before / 3 hours after a match start. False otherwise.")
    except Exception as e:
        print(f"  ℹ️  Error: {e}")

    # Check 4 — Live sync + DB update
    print("\nCheck 4: Live sync + DB update...")
    test_ids = load_test_ids()
    match_ids_set = set(test_ids.get("match_ids", [])) if test_ids else set()

    db = SessionLocal()
    try:
        client = FootballDataClient()
        live_matches = client.get_live_matches(competition_code="PL")
        if not live_matches:
            print("  ℹ️  No live PL matches right now — run during a match")
        else:
            any_updated = False
            any_in_test = False
            for ext in live_matches:
                ext_id = ext.get("id")
                match = DBReader.get_match_by_external_id(db, ext_id)
                if match and match.id in match_ids_set:
                    any_in_test = True
                    score = ext.get("score", {}).get("fullTime", {})
                    home = score.get("home")
                    away = score.get("away")
                    if home is not None and away is not None:
                        try:
                            ResultsService.update_match_result(
                                db=db,
                                match_id=match.id,
                                home_team_score=home,
                                away_team_score=away,
                                is_final=False,
                            )
                            # Re-read to verify
                            updated_match = DBReader.get_match(db, match.id)
                            result = DBReader.get_match_result(db, match.id)
                            if result and result.home_team_score == home and result.away_team_score == away:
                                results["check4"] = True
                                any_updated = True
                                print(f"  ✅ PASS: Match {match.id} updated to {home}-{away}")
                            else:
                                print(f"  ❌ FAIL: Match {match.id} update not persisted correctly")
                        except Exception as e:
                            print(f"  ❌ FAIL: {e}")
                    else:
                        print(f"  ⚠️  Live match ext_id={ext_id} has no fullTime score yet")
                elif match:
                    print(f"  ⚠️  Live match ext_id={ext_id} not in our test data (expected if mapping not done yet)")
                else:
                    print(f"  ⚠️  Live match ext_id={ext_id} not in our DB (run pl_map_and_verify.py first)")
            if live_matches and not any_in_test:
                print("  ℹ️  Live matches exist but none in our test set — map first or run during PL match")
            elif not any_updated and any_in_test:
                print("  ℹ️  Live match in test set but scores not yet available from API")
    finally:
        db.close()

    # Final output block
    print("\n" + "═" * 40)
    print("SYNC TEST RESULTS")
    print("═" * 40)
    print(f"{'✅' if results['check1'] else '❌'} Check 1: API connectivity")
    print(f"{'✅' if results['check2'] else '❌'} Check 2: get_matches_today includes our test matches")
    print(f"ℹ️   Check 3: is_within_active_window = {results['check3_info']}")
    print(f"{'✅' if results['check4'] else '❌'} Check 4: Live sync updated DB correctly")
    print("═" * 40)


if __name__ == "__main__":
    run_checks()
