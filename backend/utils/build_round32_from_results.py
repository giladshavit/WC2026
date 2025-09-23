#!/usr/bin/env python3
"""
Build the Round of 32 matches and results based on ACTUAL results (not predictions)
This script creates the knockout bracket using real group stage and third place results.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.results import GroupStageResult, ThirdPlaceResult, KnockoutStageResult
from models.third_place_combinations import ThirdPlaceCombination
from models.matches_template import MatchTemplate
from models.matches import Match
from models.team import Team
from models.groups import Group
from datetime import datetime, timedelta

def build_round32_from_results():
    """Builds the round of 32 matches and results based on actual results"""
    
    db = SessionLocal()
    try:
        print("🏆 Building Round of 32 from ACTUAL results...")
        
        # Step 1: Verify we have all required results
        print("📋 Checking for required results...")
        
        # Check group stage results
        group_results = db.query(GroupStageResult).all()
        if len(group_results) != 12:
            print(f"❌ Expected 12 group results, found {len(group_results)}")
            return
        
        # Check third place results
        third_place_result = db.query(ThirdPlaceResult).first()
        if not third_place_result:
            print("❌ No third place results found!")
            return
        
        print("✅ All required results found")
        
        # Step 2: Build the list of third-place qualifiers from actual results
        qualifying_teams = [
            third_place_result.first_team_qualifying,
            third_place_result.second_team_qualifying,
            third_place_result.third_team_qualifying,
            third_place_result.fourth_team_qualifying,
            third_place_result.fifth_team_qualifying,
            third_place_result.sixth_team_qualifying,
            third_place_result.seventh_team_qualifying,
            third_place_result.eighth_team_qualifying
        ]
        
        # Find the groups of the qualifying teams
        third_place_groups = []
        for team_id in qualifying_teams:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                third_place_groups.append(team.group_letter)
        
        print(f"Third-place qualifiers: {third_place_groups}")
        
        # Step 3: Find the matching combination
        hash_key = ''.join(sorted(third_place_groups))
        combination = db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()
        
        if not combination:
            print(f"❌ No combination found for {hash_key}")
            return
        
        print(f"Found combination ID {combination.id}")
        
        # Step 4: Create mapping for third-place teams based on the combination
        # The combination columns are: match_1A, match_1B, match_1D, match_1E, match_1G, match_1I, match_1K, match_1L
        # Values from combination 210: 3E|3J|3I|3C|3A|3G|3L|3K
        # But the templates use different mappings:
        # 3rd_team_1 -> 1E, 3rd_team_2 -> 1I, 3rd_team_3 -> 1A, 3rd_team_4 -> 1L
        # 3rd_team_5 -> 1D, 3rd_team_6 -> 1G, 3rd_team_7 -> 1B, 3rd_team_8 -> 1K
        third_team_mapping = {
            '3rd_team_1': 'match_1E',  # 3rd_team_1 -> 1E -> match_1E -> 3C
            '3rd_team_2': 'match_1I',  # 3rd_team_2 -> 1I -> match_1I -> 3G
            '3rd_team_3': 'match_1A',  # 3rd_team_3 -> 1A -> match_1A -> 3E
            '3rd_team_4': 'match_1L',  # 3rd_team_4 -> 1L -> match_1L -> 3K
            '3rd_team_5': 'match_1D',  # 3rd_team_5 -> 1D -> match_1D -> 3I
            '3rd_team_6': 'match_1G',  # 3rd_team_6 -> 1G -> match_1G -> 3A
            '3rd_team_7': 'match_1B',  # 3rd_team_7 -> 1B -> match_1B -> 3J
            '3rd_team_8': 'match_1K'   # 3rd_team_8 -> 1K -> match_1K -> 3L
        }
        
        # Step 5: Get round 32 templates (should be matches 73-88)
        round32_templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage == 'round32'
        ).order_by(MatchTemplate.id).all()
        
        if len(round32_templates) != 16:
            print(f"❌ Expected 16 round32 templates, found {len(round32_templates)}")
            return
        
        print(f"Creating {len(round32_templates)} Round of 32 matches...")
        
        # Step 6: Create matches and results
        base_date = datetime(2026, 7, 1)  # Start date for Round of 32
        
        for i, template in enumerate(round32_templates):
            match_id = 73 + i  # Matches 73-88
            
            # Resolve the participating teams
            home_team = get_team_for_source_from_results(db, template.team_1, combination, third_team_mapping)
            away_team = get_team_for_source_from_results(db, template.team_2, combination, third_team_mapping)
            
            if home_team and away_team:
                # Create Match record
                match_date = base_date + timedelta(days=i//2)  # 2 matches per day
                match_time = datetime.combine(match_date.date(), datetime.min.time().replace(hour=16 + (i % 2) * 3))
                
                # Check if match already exists
                existing_match = db.query(Match).filter(Match.id == match_id).first()
                if not existing_match:
                    match = Match(
                        id=match_id,
                        stage='round32',
                        home_team_id=home_team.id,
                        away_team_id=away_team.id,
                        status='scheduled',
                        date=match_time,
                        match_number=i + 1,
                        home_team_source=template.team_1,
                        away_team_source=template.team_2
                    )
                    db.add(match)
                    print(f"  Created match {match_id}: {home_team.name} vs {away_team.name}")
                else:
                    # Update existing match with teams
                    existing_match.home_team_id = home_team.id
                    existing_match.away_team_id = away_team.id
                    existing_match.home_team_source = template.team_1
                    existing_match.away_team_source = template.team_2
                    existing_match.status = 'scheduled'
                    if not existing_match.date:
                        match_date = base_date + timedelta(days=i//2)
                        match_time = datetime.combine(match_date.date(), datetime.min.time().replace(hour=16 + (i % 2) * 3))
                        existing_match.date = match_time
                    print(f"  Updated match {match_id}: {home_team.name} vs {away_team.name}")
                
                # Create or update KnockoutStageResult record
                existing_result = db.query(KnockoutStageResult).filter(
                    KnockoutStageResult.match_id == match_id
                ).first()
                
                if not existing_result:
                    result = KnockoutStageResult(
                        match_id=match_id,
                        team_1=home_team.id,
                        team_2=away_team.id,
                        winner_team_id=None  # Will be filled when results are entered
                    )
                    db.add(result)
                    print(f"  Created result for match {match_id}")
                else:
                    # Update existing result with teams
                    existing_result.team_1 = home_team.id
                    existing_result.team_2 = away_team.id
                    print(f"  Updated result for match {match_id}")
            else:
                print(f"  Failed to resolve teams for match {match_id}")
        
        db.commit()
        print("\n✅ Round of 32 built successfully!")
        print("📊 Summary:")
        print(f"  - Created 16 matches (IDs 73-88)")
        print(f"  - Created 16 knockout stage results")
        print(f"  - Based on combination: {hash_key}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def get_team_for_source_from_results(db, team_source, combination, third_team_mapping):
    """Find the appropriate team according to the template using ACTUAL results"""
    
    if team_source.startswith('3rd_team_'):
        # Third-place team from actual results
        if combination and third_team_mapping:
            # Find the corresponding column name
            column_name = third_team_mapping[team_source]  # 3rd_team_1 -> match_1A
            
            # Get the value from the combination
            third_place_source = getattr(combination, column_name)  # 3A, 3B, etc.
            
            # Resolve the 3rd-place team in the appropriate group
            group_letter = third_place_source[1]  # 3A -> A
            group = db.query(Group).filter(Group.name == group_letter).first()
            
            if group:
                # Get ACTUAL result (not prediction)
                result = db.query(GroupStageResult).filter(
                    GroupStageResult.group_id == group.id
                ).first()
                
                if result:
                    return db.query(Team).filter(Team.id == result.third_place).first()
        
        return None
    
    else:
        # Regular team (1A, 2B, etc.) from actual results
        if len(team_source) >= 2 and team_source[0].isdigit():
            group_letter = team_source[1]  # 1A -> A
            position = int(team_source[0])  # 1A -> 1
            
            group = db.query(Group).filter(Group.name == group_letter).first()
            if group:
                # Get ACTUAL result (not prediction)
                result = db.query(GroupStageResult).filter(
                    GroupStageResult.group_id == group.id
                ).first()
                
                if result:
                    if position == 1:
                        return db.query(Team).filter(Team.id == result.first_place).first()
                    elif position == 2:
                        return db.query(Team).filter(Team.id == result.second_place).first()
        
        return None

if __name__ == "__main__":
    build_round32_from_results()
