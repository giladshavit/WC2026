#!/usr/bin/env python3
"""
Script to create the matches_template table with all matches.
Fetches Google Sheet once and creates matches with correct dates/placeholders in a single pass.
"""

import csv
import sys
import os
from io import StringIO

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from database import engine
from models.matches_template import MatchTemplate
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import requests

from utils.datetime_utils import israel_time_to_utc

SHEET_ID = "1D9zV9rivLeDUql_6bMvFEdZ3gOpMnG015WNL9iGfX4g"
SHEET_GID = "255491779"


def _fetch_sheet_data() -> dict[int, dict]:
    """
    Fetch Google Sheet and parse into match_id -> {date, group, team_1, team_2}.
    Returns dict for all 104 matches. Knockout rows have group/team_1/team_2 as None.
    """
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={SHEET_GID}"
    response = requests.get(url)
    response.raise_for_status()
    all_rows = list(csv.reader(StringIO(response.text)))

    # Find header row
    header_idx = None
    for idx, row in enumerate(all_rows):
        if len(row) > 8 and row[5] == 'id' and row[6] == 'day' and row[7] == 'time' and row[8] == 'group':
            header_idx = idx
            break
    if header_idx is None:
        raise ValueError("Could not find schedule header row in sheet")

    result = {}
    for row in all_rows[header_idx + 1:]:
        if len(row) < 11 or not row[5] or not row[6] or not row[7]:
            continue
        try:
            match_id = int(row[5].strip())
            day_parts = row[6].strip().split('.')
            time_parts = row[7].strip().split(':')
            day = int(day_parts[0])
            month = int(day_parts[1])
            hour = int(time_parts[0])
            minute = int(time_parts[1])
            # Sheet times are Israel time → convert to UTC for storage
            date = israel_time_to_utc(2026, month, day, hour, minute)
            group_val = row[8].strip() if len(row) > 8 else ''
            t1_val = row[9].strip() if len(row) > 9 else ''
            t2_val = row[10].strip() if len(row) > 10 else ''
            result[match_id] = {
                "date": date,
                "group": group_val or None,
                "team_1": f"{group_val}{t1_val}" if (group_val and t1_val) else None,
                "team_2": f"{group_val}{t2_val}" if (group_val and t2_val) else None,
            }
        except (ValueError, IndexError):
            continue
    return result


def create_matches_template():
    """Create the matches_template table with all matches. Single pass using sheet data."""
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Fetch sheet once (dates + placeholders for group stage)
        print("Fetching schedule from Google Sheet...")
        sheet_data = _fetch_sheet_data()
        print(f"✅ Loaded {len(sheet_data)} matches from sheet\n")

        # Create the table if it does not exist
        MatchTemplate.__table__.create(engine, checkfirst=True)
        session.query(MatchTemplate).delete()

        # Fallback dates in UTC (19:00 UTC ≈ 22:00 Israel)
        group_stage_start = israel_time_to_utc(2026, 6, 15, 19, 0)
        knockout_start = israel_time_to_utc(2026, 7, 1, 19, 0)
        matches = []

        # ========================================
        # Group stage (72 matches) - from sheet in one pass
        # ========================================
        groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
        fallback_pairs = [
            (1, 2), (3, 4), (1, 3), (4, 2), (4, 1), (2, 3)
        ]  # Round 1-3 pairs per group
        for match_id in range(1, 73):
            data = sheet_data.get(match_id, {})
            date = data.get("date") or group_stage_start
            group = data.get("group")
            team_1 = data.get("team_1")
            team_2 = data.get("team_2")
            if not group:
                group_idx = (match_id - 1) // 6
                pair_idx = (match_id - 1) % 6
                group = groups[group_idx] if group_idx < 12 else "A"
                p1, p2 = fallback_pairs[pair_idx]
                team_1 = team_1 or f"{group}{p1}"
                team_2 = team_2 or f"{group}{p2}"
            matches.append(MatchTemplate(
                id=match_id,
                stage="group",
                team_1=team_1 or f"{group}1",
                team_2=team_2 or f"{group}2",
                status="scheduled",
                date=date,
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
            mid = match_data["id"]
            date = sheet_data.get(mid, {}).get("date") or knockout_start + timedelta(days=(mid - 73) // 2)
            matches.append(MatchTemplate(
                id=mid,
                stage="round32",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=date,
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
            mid = match_data["id"]
            date = sheet_data.get(mid, {}).get("date") or knockout_start + timedelta(days=8 + (mid - 89) // 2)
            matches.append(MatchTemplate(
                id=mid,
                stage="round16",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=date,
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
            mid = match_data["id"]
            date = sheet_data.get(mid, {}).get("date") or knockout_start + timedelta(days=12 + (mid - 97))
            matches.append(MatchTemplate(
                id=mid,
                stage="quarter",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=date,
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Semi finals (2 matches) - ID 101-102
        semi_matches = [
            {"id": 101, "team_1": "Winner_M97", "team_2": "Winner_M98", "winner_next_knockout_match": 104, "winner_next_position": 1},
            {"id": 102, "team_1": "Winner_M99", "team_2": "Winner_M100", "winner_next_knockout_match": 104, "winner_next_position": 2}
        ]
        
        for match_data in semi_matches:
            mid = match_data["id"]
            date = sheet_data.get(mid, {}).get("date") or knockout_start + timedelta(days=16 + (mid - 101))
            matches.append(MatchTemplate(
                id=mid,
                stage="semi",
                team_1=match_data["team_1"],
                team_2=match_data["team_2"],
                status="scheduled",
                date=date,
                winner_next_knockout_match=match_data["winner_next_knockout_match"],
                winner_next_position=match_data["winner_next_position"]
            ))
        
        # Third-place match - ID 103
        date_103 = sheet_data.get(103, {}).get("date") or knockout_start + timedelta(days=18)
        matches.append(MatchTemplate(
            id=103,
            stage="third_place",
            team_1="Runner_up_M101",
            team_2="Runner_up_M102",
            status="scheduled",
            date=date_103,
            winner_next_knockout_match=None,
            winner_next_position=None
        ))

        # Final - ID 104
        date_104 = sheet_data.get(104, {}).get("date") or knockout_start + timedelta(days=19)
        matches.append(MatchTemplate(
            id=104,
            stage="final",
            team_1="Winner_M101",
            team_2="Winner_M102",
            status="scheduled",
            date=date_104,
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


if __name__ == "__main__":
    create_matches_template()
