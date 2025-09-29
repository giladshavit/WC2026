# Tournament Deletion Scripts

This directory contains scripts to delete various types of tournament data from the database.

## Individual Scripts

- `delete_all_pred.py` - Delete all predictions (match, group, third place, knockout)
- `delete_all_results.py` - Delete all results (match, group, third place, knockout)
- `delete_all_matches.py` - Delete all tournament matches (preserves match templates)
- `delete_all_groups.py` - Delete all groups and group templates
- `delete_all_teams.py` - Delete all teams
- `reset_all_users_points.py` - Reset all users' points to zero

## Master Script

- `reset_all.py` - Runs all deletion scripts in the correct order to completely reset the tournament

## Usage

### Reset Everything
```bash
cd backend/utils/deletion
source ../../venv/bin/activate
python reset_all.py
```

### Run Individual Scripts
```bash
cd backend/utils/deletion
source ../../venv/bin/activate
python delete_all_pred.py
python delete_all_results.py
# etc.
```

## What Gets Preserved

The deletion scripts preserve:
- Users (but reset their points to zero)
- Tournament configuration
- Column mappings
- Third place combinations (reference data)
- Match templates (in delete_all_matches.py)

## Safety

All scripts use database transactions and will rollback on errors. They also provide verification of successful deletion.
