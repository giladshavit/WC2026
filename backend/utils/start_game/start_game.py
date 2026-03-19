#!/usr/bin/env python3
"""
Master script to start the game setup.
Runs:
1) create_teams.py
2) create_groups.py
3) create_matches.py

This sets up teams, groups, and all matches in the correct order.
"""

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


def main() -> None:
    print("🚀 STARTING GAME SETUP (teams → groups → matches → knockout results)")
    print()

    scripts = [
        ("create_teams.py", "Creating teams from Google Sheet"),
        ("update_team_flags.py", "Updating team flags"),
        ("create_groups.py", "Creating groups from teams"),
        ("create_matches.py", "Creating all matches from templates"),
        ("create_knockout_results.py", "Creating knockout results"),
        ("../fill_knockout_result_ids.py", "Filling knockout_result_id in match templates"),
        ("create_global_league.py", "Creating global league"),
    ]

    failed = []
    for name, desc in scripts:
        if not run_script(name, desc):
            failed.append(name)

    print("\n" + "=" * 60)
    if failed:
        print("⚠️  Completed with errors. Failed scripts:", ", ".join(failed))
    else:
        print("🎉 Game setup completed successfully!")
        print()
        print("Next step (run manually with API key):")
        print("  FOOTBALL_DATA_API_KEY=your_key python utils/start_game/map_external_fixtures.py")


if __name__ == "__main__":
    main()
