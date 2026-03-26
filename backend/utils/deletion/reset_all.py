#!/usr/bin/env python3
"""
Master script to reset the entire tournament database.
This script runs all deletion scripts in the correct order for a complete full reset.

Order of operations:
1. Delete all predictions (match, group, third, knockout, bonus, drafts)
2. Delete all results
3. Delete all matches
4. Delete all groups
5. Delete all teams
6. Delete all users and leagues
7. Delete static templates and singletons (column_mapping, matches_template, group_template, third_place_combinations, bonus_results, third_place_group_counts, tournament_config)

After reset: empty database. Restore with create_all_templates.py then start_game.py.
"""

import sys
import os
import subprocess
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal


def run_script(script_name, description):
    """Run a deletion script and handle errors."""
    print(f"\n{'='*60}")
    print(f"🔄 {description}")
    print(f"{'='*60}")
    
    script_path = Path(__file__).parent / script_name
    
    try:
        # Run the script from the backend directory (parent of utils)
        backend_dir = Path(__file__).parent.parent.parent
        result = subprocess.run([
            sys.executable, str(script_path)
        ], capture_output=True, text=True, cwd=backend_dir)
        
        if result.returncode == 0:
            print("✅ SUCCESS")
            if result.stdout:
                print(result.stdout)
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
    
    return True


def delete_static_templates():
    """Delete all static template data and singletons."""
    from models.column_mapping import ColumnMapping
    from models.matches_template import MatchTemplate
    from models.group_template import GroupTemplate
    from models.third_place_combinations import ThirdPlaceCombination
    from models.results import BonusResults
    from models.statistics import ThirdPlaceGroupCounts
    from models.tournament_config import TournamentConfig

    db = SessionLocal()
    try:
        db.query(ColumnMapping).delete()
        print("  ✅ Deleted column_mapping")

        db.query(MatchTemplate).delete()
        print("  ✅ Deleted matches_template")

        db.query(GroupTemplate).delete()
        print("  ✅ Deleted group_template")

        db.query(ThirdPlaceCombination).delete()
        print("  ✅ Deleted third_place_combinations")

        db.query(BonusResults).delete()
        print("  ✅ Deleted bonus_results")

        db.query(ThirdPlaceGroupCounts).delete()
        print("  ✅ Deleted third_place_group_counts")

        db.query(TournamentConfig).delete()
        print("  ✅ Deleted tournament_config")

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"\n❌ delete_static_templates() failed: {e}")
        raise
    finally:
        db.close()


def reset_all():
    """Reset the entire tournament database."""
    
    print("🚀 STARTING COMPLETE TOURNAMENT RESET")
    print("This will delete ALL tournament data in the following order:")
    print("1. All predictions (match, group, third place, knockout, bonus, draft)")
    print("2. All results (match, group, third place, knockout)")
    print("3. All matches")
    print("4. All groups")
    print("5. All teams")
    print("6. All users, leagues, and memberships")
    print("7. Static templates and singletons (column_mapping, matches_template, group_template, third_place_combinations, bonus_results, third_place_group_counts, tournament_config)")
    print()
    print("⚠️  This action cannot be undone!")
    print()
    
    # List of scripts to run in order
    scripts = [
        ("delete_all_pred.py", "Deleting all predictions and drafts"),
        ("delete_all_results.py", "Deleting all results"),
        ("delete_all_matches.py", "Deleting all matches"),
        ("delete_all_groups.py", "Deleting all groups"),
        ("delete_all_teams.py", "Deleting all teams"),
        ("delete_all_users.py", "Deleting all users and leagues"),
    ]
    
    failed_scripts = []
    
    for script_name, description in scripts:
        success = run_script(script_name, description)
        if not success:
            failed_scripts.append(script_name)
            print(f"\n⚠️  Failed to run {script_name}")
            print("Continuing with remaining scripts...")
    
    print(f"\n{'='*60}")
    print("🎉 TOURNAMENT RESET COMPLETED")
    print(f"{'='*60}")
    
    if failed_scripts:
        print(f"⚠️  Some scripts failed: {', '.join(failed_scripts)}")
        print("Please check the errors above and run failed scripts manually.")
    else:
        print("✅ All deletion scripts completed successfully!")
        print()
        print("✅ Database completely reset. Ready for fresh initialization.")
        print("Run in this order to restore:")
        print("  1. python utils/create_templates/create_all_templates.py")
        print("  2. python utils/start_game/start_game.py")
    
    print("\n" + "=" * 60)
    print("🗂️  Deleting static templates...")
    delete_static_templates()


if __name__ == "__main__":
    reset_all()
