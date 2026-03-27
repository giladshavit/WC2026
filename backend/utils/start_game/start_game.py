#!/usr/bin/env python3
"""
Master script to start the game setup.
Runs:
1) create_teams.py
2) create_groups.py
3) create_matches.py

This sets up teams, groups, and all matches in the correct order.
"""

import argparse
import sys
import os
import subprocess
from pathlib import Path

HERE = Path(__file__).parent


def run_script(script_name: str, description: str) -> bool:
    print("\n" + "=" * 60)
    print(f"🔄 {description}")
    print("=" * 60)
    script_path = (HERE / script_name).resolve()
    
    # Set working directory to backend root for proper imports
    backend_dir = HERE.parent.parent
    
    try:
        result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True, cwd=str(backend_dir))
        if result.returncode == 0:
            print("✅ SUCCESS")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print("❌ ERROR")
            if result.stderr:
                print(f"Error: {result.stderr}")
            if result.stdout:
                print(f"Output: {result.stdout}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def run_create_admin_user(description: str, admin_password: str | None) -> bool | None:
    """
    Run create_admin_user.py with fixed admin identity and the given password.
    Returns True on success, False on failure, None if skipped (no password).
    """
    if admin_password is None:
        print("\n⚠️  No --admin-password provided; skipping create_admin_user.py")
        return None

    print("\n" + "=" * 60)
    print(f"🔄 {description}")
    print("=" * 60)
    script_path = (HERE / "create_admin_user.py").resolve()
    backend_dir = HERE.parent.parent
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(script_path),
                "--username",
                "admin",
                "--name",
                "Gilad",
                "--email",
                "giladshavit1@gmail.com",
                "--password",
                admin_password,
            ],
            capture_output=True,
            text=True,
            cwd=str(backend_dir),
        )
        if result.returncode == 0:
            print("✅ SUCCESS")
            if result.stdout:
                print(result.stdout)
            return True
        print("❌ ERROR")
        if result.stderr:
            print(f"Error: {result.stderr}")
        if result.stdout:
            print(f"Output: {result.stdout}")
        return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--admin-password", default=None)
    args = parser.parse_args()
    admin_password = args.admin_password

    print("🚀 STARTING GAME SETUP (teams → groups → matches → knockout results)")
    print()

    scripts = [
        ("create_teams.py", "Creating teams from Google Sheet"),
        ("update_team_flags.py", "Updating team flags"),
        ("populate_short_names.py", "Populating team short names"),
        ("create_groups.py", "Creating groups from teams"),
        ("create_matches.py", "Creating all matches from templates"),
        ("create_knockout_results.py", "Creating knockout results"),
        ("../fill_knockout_result_ids.py", "Filling knockout_result_id in match templates"),
        ("create_admin_user.py", "Creating admin user"),
        ("create_global_league.py", "Creating global league"),
    ]

    failed = []
    for name, desc in scripts:
        if name == "create_admin_user.py":
            outcome = run_create_admin_user(desc, admin_password)
            if outcome is False:
                failed.append(name)
            continue
        if not run_script(name, desc):
            failed.append(name)

    print("\n" + "=" * 60)
    if failed:
        print("⚠️  Completed with errors. Failed scripts:", ", ".join(failed))
    else:
        # Try to map external fixtures if API key is available
        api_key = os.environ.get("FOOTBALL_DATA_API_KEY", "")
        if api_key:
            print("\n" + "=" * 60)
            print("🔄 Mapping external fixture IDs...")
            print("=" * 60)
            if run_script("map_external_fixtures.py",
                          "Mapping matches to football-data.org IDs"):
                print("✅ External fixtures mapped successfully")
            else:
                print("⚠️  External fixture mapping failed — run manually later")
        else:
            print("\n⚠️  FOOTBALL_DATA_API_KEY not set — skipping fixture mapping")
            print("   Run manually: python utils/start_game/map_external_fixtures.py")

        print("🎉 Game setup completed successfully!")


if __name__ == "__main__":
    main()
