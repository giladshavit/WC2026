#!/usr/bin/env python3
"""
Master script to reset the entire tournament database.
This script runs all deletion scripts in the correct order to completely reset the tournament.

Order of operations:
1. Delete all predictions
2. Delete all results  
3. Delete all matches
4. Delete all groups
5. Delete all teams

This will completely reset the tournament while preserving:
- Users
- Tournament configuration
- Column mappings
- Third place combinations (reference data)
"""

import sys
import os
import subprocess
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

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

def reset_all():
    """Reset the entire tournament database."""
    
    print("🚀 STARTING COMPLETE TOURNAMENT RESET")
    print("This will delete ALL tournament data in the following order:")
    print("1. All predictions (match, group, third place, knockout)")
    print("2. All results (match, group, third place, knockout)")
    print("3. All matches (tournament matches only)")
    print("4. All groups (tournament groups and templates)")
    print("5. All teams")
    print("6. All users' points (reset to zero)")
    print()
    print("⚠️  This action cannot be undone!")
    print()
    
    # List of scripts to run in order
    scripts = [
        ("delete_all_pred.py", "Deleting all predictions"),
        ("delete_all_results.py", "Deleting all results"),
        ("delete_all_matches.py", "Deleting all matches"),
        ("delete_all_groups.py", "Deleting all groups"),
        ("delete_all_teams.py", "Deleting all teams"),
        ("reset_all_users_points.py", "Resetting all users' points")
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
        print("The tournament database has been completely reset.")
        print("Remaining data:")
        print("- Users")
        print("- Tournament configuration")
        print("- Column mappings")
        print("- Third place combinations (reference data)")
        print()
        print("You can now set up a fresh tournament!")

if __name__ == "__main__":
    reset_all()
