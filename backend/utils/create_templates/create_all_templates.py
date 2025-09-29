#!/usr/bin/env python3
"""
Master script to create all tournament templates.
This script runs all template creation scripts in the correct order to set up the complete tournament structure.

Order of operations:
1. Create column mappings
2. Create match templates (all 104 matches)
3. Create group templates (12 groups with round32 mappings)
4. Load third place combinations from Google Sheets (495 combinations)

This will set up the complete tournament structure templates.
"""

import sys
import os
import subprocess
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def run_script(script_name, description):
    """Run a template creation script and handle errors."""
    print(f"\n{'='*60}")
    print(f"🔄 {description}")
    print(f"{'='*60}")
    
    script_path = Path(__file__).parent / script_name
    
    try:
        # Run the script
        result = subprocess.run([
            sys.executable, str(script_path)
        ], capture_output=True, text=True, cwd=Path(__file__).parent)
        
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

def create_all_templates():
    """Create all tournament templates."""
    
    print("🚀 STARTING COMPLETE TOURNAMENT TEMPLATE CREATION")
    print("This will create all tournament templates in the following order:")
    print("1. Column mappings (database configurations)")
    print("2. Match templates (all 104 tournament matches)")
    print("3. Group templates (12 groups with round32 mappings)")
    print("4. Third place combinations (495 combinations from Google Sheets)")
    print()
    print("⚠️  This will create/overwrite existing template data!")
    print()
    
    # List of scripts to run in order
    scripts = [
        ("create_column_mapping.py", "Creating column mappings"),
        ("create_matches_template.py", "Creating match templates"),
        ("create_group_template.py", "Creating group templates"),
        ("load_combinations_from_google_sheet.py", "Loading third place combinations")
    ]
    
    failed_scripts = []
    
    for script_name, description in scripts:
        success = run_script(script_name, description)
        if not success:
            failed_scripts.append(script_name)
            print(f"\n⚠️  Failed to run {script_name}")
            print("Continuing with remaining scripts...")
    
    print(f"\n{'='*60}")
    print("🎉 TOURNAMENT TEMPLATE CREATION COMPLETED")
    print(f"{'='*60}")
    
    if failed_scripts:
        print(f"⚠️  Some scripts failed: {', '.join(failed_scripts)}")
        print("Please check the errors above and run failed scripts manually.")
    else:
        print("✅ All template creation scripts completed successfully!")
        print()
        print("The tournament templates have been created:")
        print("- Column mappings configured")
        print("- 104 match templates created (group stage + knockout)")
        print("- 12 group templates with round32 mappings")
        print("- 495 third place combinations loaded from Google Sheets")
        print()
        print("The tournament structure is now ready for setup!")

if __name__ == "__main__":
    create_all_templates()
