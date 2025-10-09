#!/usr/bin/env python3
"""
Script to create the matches_template table with all matches
"""

import sys
import os
# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from database import engine
from models.matches_template import MatchTemplate
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import requests

def create_matches_template():
    """Create the matches_template table with all matches"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create the table if it does not exist
        MatchTemplate.__table__.create(engine, checkfirst=True)
        
        # Delete all existing matches
        session.query(MatchTemplate).delete()
        
        # Base dates
        group_stage_start = datetime(2026, 6, 15)  # June 15, 2026
        knockout_start = datetime(2026, 7, 1)      # July 1, 2026
        
        matches = []
        
        # ========================================
        # Create group stage matches (72 matches)
        # ========================================
        
        groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        
        # Round 1 (24 matches) - ID 1-24
        for i, group in enumerate(groups):
            # A1 vs A2
            matches.append(MatchTemplate(
                id=1 + i*2,
                stage="group",
                team_1=f"{group}1",
                team_2=f"{group}2",
                status="scheduled",
                date=group_stage_start,
                group=group
            ))
            # A3 vs A4
            matches.append(MatchTemplate(
                id=2 + i*2,
                stage="group",
                team_1=f"{group}3",
                team_2=f"{group}4",
                status="scheduled",
                date=group_stage_start,
                group=group
            ))
        
        # Round 2 (24 matches) - ID 25-48
        for i, group in enumerate(groups):
            # A1 vs A3
            matches.append(MatchTemplate(
                id=25 + i*2,
                stage="group",
                team_1=f"{group}1",
                team_2=f"{group}3",
                status="scheduled",
                date=group_stage_start + timedelta(days=3),
                group=group
            ))
            # A4 vs A2
            matches.append(MatchTemplate(
                id=26 + i*2,
                stage="group",
                team_1=f"{group}4",
                team_2=f"{group}2",
                status="scheduled",
                date=group_stage_start + timedelta(days=3),
                group=group
            ))
        
        # Round 3 (24 matches) - ID 49-72
        for i, group in enumerate(groups):
            # A4 vs A1
            matches.append(MatchTemplate(
                id=49 + i*2,
                stage="group",
                team_1=f"{group}4",
                team_2=f"{group}1",
                status="scheduled",
                date=group_stage_start + timedelta(days=6),
                group=group
            ))
            # A2 vs A3
            matches.append(MatchTemplate(
                id=50 + i*2,
                stage="group",
                team_1=f"{group}2",
                team_2=f"{group}3",
                status="scheduled",
                date=group_stage_start + timedelta(days=6),
                group=group
            ))
        
        # ========================================
        # Create knockout matches (32 matches)
        # ========================================
        
        # Round of 32 (16 matches) - ID 73-88
        # Template: each 1st place team plays a 3rd place team
        # Order: 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L
        round32_matches = [
            {"id": 73, "team_1": "2A", "team_2": "2B", "winner_next_knockout_match": 90, "winner_next_position": 1},
            {"id": 74, "team_1": "1E", "team_2": "3rd_team_1", "winner_next_knockout_match": 89, "winner_next_position": 1},
            {"id": 75, "team_1": "1F", "team_2": "2C", "winner_next_knockout_match": 90, "winner_next_position": 2},
            {"id": 76, "team_1": "1C", "team_2": "2F", "winner_next_knockout_match": 91, "winner_next_position": 1},
            {"id": 77, "team_1": "1I", "team_2": "3rd_team_2", "winner_next_knockout_match": 89, "winner_next_position": 2},
            {"id": 78, "team_1": "2E", "team_2": "2I", "winner_next_knockout_match": 91, "winner_next_position": 2},
            {"id": 79, "team_1": "1A", "team_2": "3rd_team_3", "winner_next_knockout_match": 92, "winner_next_position": 1},
            {"id": 80, "team_1": "1L", "team_2": "3rd_team_4", "winner_next_knockout_match": 92, "winner_next_position": 2},
            {"id": 81, "team_1": "1D", "team_2": "3rd_team_5", "winner_next_knockout_match": 94, "winner_next_position": 1},
            {"id": 82, "team_1": "1G", "team_2": "3rd_team_6", "winner_next_knockout_match": 94, "winner_next_position": 2},
            {"id": 83, "team_1": "2K", "team_2": "2L", "winner_next_knockout_match": 93, "winner_next_position": 1},
            {"id": 84, "team_1": "1H", "team_2": "2J", "winner_next_knockout_match": 93, "winner_next_position": 2},
            {"id": 85, "team_1": "1B", "team_2": "3rd_team_7", "winner_next_knockout_match": 96, "winner_next_position": 1},
            {"id": 86, "team_1": "1J", "team_2": "2H", "winner_next_knockout_match": 95, "winner_next_position": 1},
            {"id": 87, "team_1": "1K", "team_2": "3rd_team_8", "winner_next_knockout_match": 96, "winner_next_position": 2},
            {"id": 88, "team_1": "2D", "team_2": "2G", "winner_next_knockout_match": 95, "winner_next_position": 2}
        ]
        
        for match_data in round32_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="round32",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=(match_data["id"] - 73) // 2),
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Round of 16 (8 matches) - ID 89-96
        round16_matches = [
            {"id": 89, "team_1": "Winner_M74", "team_2": "Winner_M77", "winner_next_knockout_match": 97, "winner_next_position": 1},
            {"id": 90, "team_1": "Winner_M73", "team_2": "Winner_M75", "winner_next_knockout_match": 97, "winner_next_position": 2},
            {"id": 91, "team_1": "Winner_M76", "team_2": "Winner_M78", "winner_next_knockout_match": 99, "winner_next_position": 1},
            {"id": 92, "team_1": "Winner_M79", "team_2": "Winner_M80", "winner_next_knockout_match": 99, "winner_next_position": 2},
            {"id": 93, "team_1": "Winner_M83", "team_2": "Winner_M84", "winner_next_knockout_match": 98, "winner_next_position": 1},
            {"id": 94, "team_1": "Winner_M81", "team_2": "Winner_M82", "winner_next_knockout_match": 98, "winner_next_position": 2},
            {"id": 95, "team_1": "Winner_M86", "team_2": "Winner_M88", "winner_next_knockout_match": 100, "winner_next_position": 1},
            {"id": 96, "team_1": "Winner_M85", "team_2": "Winner_M87", "winner_next_knockout_match": 100, "winner_next_position": 2}
        ]
        
        for match_data in round16_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="round16",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=8 + (match_data["id"] - 89) // 2),
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Quarter finals (4 matches) - ID 97-100
        quarter_matches = [
            {"id": 97, "team_1": "Winner_M89", "team_2": "Winner_M90", "winner_next_knockout_match": 101, "winner_next_position": 1},
            {"id": 98, "team_1": "Winner_M93", "team_2": "Winner_M94", "winner_next_knockout_match": 101, "winner_next_position": 2},
            {"id": 99, "team_1": "Winner_M91", "team_2": "Winner_M92", "winner_next_knockout_match": 102, "winner_next_position": 1},
            {"id": 100, "team_1": "Winner_M95", "team_2": "Winner_M96", "winner_next_knockout_match": 102, "winner_next_position": 2}
        ]
        
        for match_data in quarter_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="quarter",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=12 + (match_data["id"] - 97)),
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Semi finals (2 matches) - ID 101-102
        semi_matches = [
            {"id": 101, "team_1": "Winner_M97", "team_2": "Winner_M98", "winner_next_knockout_match": 104, "winner_next_position": 1},
            {"id": 102, "team_1": "Winner_M99", "team_2": "Winner_M100", "winner_next_knockout_match": 104, "winner_next_position": 2}
        ]
        
        for match_data in semi_matches:
            matches.append(MatchTemplate(
                id=match_data["id"],
                stage="semi",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=knockout_start + timedelta(days=16 + (match_data["id"] - 101)),
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Third-place match - ID 103
        matches.append(MatchTemplate(
            id=103,
            stage="third_place",
            team_1="Runner_up_M101",
            team_2="Runner_up_M102",
            status="scheduled",
            date=knockout_start + timedelta(days=18),
            winner_next_knockout_match=None,
            winner_next_position=None
        ))
        
        # Final - ID 104
        matches.append(MatchTemplate(
            id=104,
            stage="final",
            team_1="Winner_M101",
            team_2="Winner_M102",
            status="scheduled",
            date=knockout_start + timedelta(days=19),
            winner_next_knockout_match=None,
            winner_next_position=None
        ))
        
        # Add all matches
        session.add_all(matches)
        session.commit()
        
        print(f"Created {len(matches)} matches successfully!")
        
        # Summary
        print("\nSummary of created matches:")
        print("=" * 50)
        print(f"Group stage: 72 matches (ID: 1-72)")
        print(f"Round of 32: 16 matches (ID: 73-88)")
        print(f"Round of 16: 8 matches (ID: 89-96)")
        print(f"Quarter finals: 4 matches (ID: 97-100)")
        print(f"Semi finals: 2 matches (ID: 101-102)")
        print(f"Third-place: 1 match (ID: 103)")
        print(f"Final: 1 match (ID: 104)")
        print(f"Total: {len(matches)} matches")
        
        # Show some examples
        print("\nExamples - group stage:")
        group_matches = session.query(MatchTemplate).filter(MatchTemplate.stage == "group").limit(6).all()
        for match in group_matches:
            print(f"ID {match.id}: {match.team_1} vs {match.team_2} (Group {match.group})")
        
        print("\nExamples - knockout:")
        knockout_matches = session.query(MatchTemplate).filter(MatchTemplate.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])).limit(5).all()
        for match in knockout_matches:
            if match.winner_next_knockout_match:
                print(f"ID {match.id}: {match.team_1} vs {match.team_2} ({match.stage}) → Match {match.winner_next_knockout_match} Position {match.winner_next_position}")
            else:
                print(f"ID {match.id}: {match.team_1} vs {match.team_2} ({match.stage}) → Final")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating matches: {e}")
    finally:
        session.close()

def update_matches_dates_from_sheet():
    """
    Update match dates and times from Google Sheet
    Sheet URL: https://docs.google.com/spreadsheets/d/1D9zV9rivLeDUql_6bMvFEdZ3gOpMnG015WNL9iGfX4g
    Range: F11:H114 (id, day, time) - row 10 is header
    """
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Access public Google Sheet via CSV export
        sheet_id = "1D9zV9rivLeDUql_6bMvFEdZ3gOpMnG015WNL9iGfX4g"
        gid = "255491779"  # First sheet
        
        # Export as CSV and parse
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
        response = requests.get(url)
        response.raise_for_status()
        
        # Parse CSV data
        import csv
        from io import StringIO
        
        csv_data = StringIO(response.text)
        reader = csv.reader(csv_data)
        
        # Skip to row 11 (0-indexed row 10) where data starts
        # Row 1-9 are header rows, row 10 has column headers
        all_rows = list(reader)
        
        # Find the row with "id", "day", "time" headers in columns F, G, H (indices 5, 6, 7)
        header_row_idx = None
        for idx, row in enumerate(all_rows):
            if len(row) > 7 and row[5] == 'id' and row[6] == 'day' and row[7] == 'time':
                header_row_idx = idx
                break
        
        if header_row_idx is None:
            print("Error: Could not find header row with 'id', 'day', 'time'")
            return
        
        # Get data rows (starting from row after header)
        data = []
        for row in all_rows[header_row_idx + 1:]:
            if len(row) > 7 and row[5] and row[6] and row[7]:  # columns F, G, H
                data.append([row[5], row[6], row[7]])  # id, day, time
        
        print(f"Found {len(data)} rows of match schedule data")
        
        updated_count = 0
        skipped_count = 0
        
        for row in data:
            if len(row) < 3:
                continue
            
            try:
                match_id = int(row[0])  # id column
                day_str = str(row[1])   # day column (e.g., "11.6" for June 11)
                time_str = str(row[2])  # time column (e.g., "19:00")
                
                # Parse the day (format: "DD.M" where M is month)
                day_parts = day_str.split('.')
                if len(day_parts) != 2:
                    print(f"Skipping match {match_id}: Invalid day format '{day_str}'")
                    skipped_count += 1
                    continue
                
                day = int(day_parts[0])
                month = int(day_parts[1])
                
                # Parse the time (format: "HH:MM")
                time_parts = time_str.split(':')
                if len(time_parts) != 2:
                    print(f"Skipping match {match_id}: Invalid time format '{time_str}'")
                    skipped_count += 1
                    continue
                
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                
                # Create the datetime object (year 2026)
                match_datetime = datetime(2026, month, day, hour, minute)
                
                # Find and update the match
                match = session.query(MatchTemplate).filter(MatchTemplate.id == match_id).first()
                if match:
                    match.date = match_datetime
                    updated_count += 1
                    print(f"Updated match {match_id}: {match_datetime.strftime('%Y-%m-%d %H:%M')}")
                else:
                    print(f"Warning: Match {match_id} not found in database")
                    skipped_count += 1
                    
            except ValueError as e:
                print(f"Error parsing row {row}: {e}")
                skipped_count += 1
                continue
        
        session.commit()
        print(f"\n✅ Successfully updated {updated_count} matches with dates and times")
        if skipped_count > 0:
            print(f"⚠️  Skipped {skipped_count} matches due to errors")
        
    except Exception as e:
        session.rollback()
        print(f"Error updating match dates: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    create_matches_template()
    print("\n" + "="*50)
    print("Now updating match dates and times from Google Sheet...")
    print("="*50 + "\n")
    update_matches_dates_from_sheet()
