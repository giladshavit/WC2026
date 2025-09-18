#!/usr/bin/env python3
"""
Build the knockout bracket based on user predictions - SIMPLE VERSION
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.predictions import GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.third_place_combinations import ThirdPlaceCombination
from models.matches_template import MatchTemplate
from models.team import Team
from models.groups import Group

user_id = 1
if len(sys.argv) >= 2 and sys.argv[1].isdigit():
    user_id = int(sys.argv[1])

def build_knockout_bracket():
    """Builds the round of 32 bracket based on predictions - simple version"""
    
    db = SessionLocal()
    try:
        print("🏆 Building the round of 32 bracket...")
        
        # Step 1: Read third place qualifying predictions
        third_place_predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        if not third_place_predictions:
            print(f"❌ No third place qualifying predictions found for user_id={user_id}!")
            return
        
        prediction = third_place_predictions[0]
        
        # Step 2: Build the list of third-place qualifiers (original order!)
        qualifying_teams = [
            prediction.first_team_qualifying,
            prediction.second_team_qualifying,
            prediction.third_team_qualifying,
            prediction.fourth_team_qualifying,
            prediction.fifth_team_qualifying,
            prediction.sixth_team_qualifying,
            prediction.seventh_team_qualifying,
            prediction.eighth_team_qualifying
        ]
        
        # Find the groups of the qualifying teams (original order!)
        third_place_groups = []
        for team_id in qualifying_teams:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                third_place_groups.append(team.group_letter)
        
        print(f"Third-place qualifiers (original order): {third_place_groups}")
        
        # Step 3: Find the matching combination
        hash_key = ''.join(sorted(third_place_groups))  # for lookup only
        combination = db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()
        
        if not combination:
            print(f"❌ No combination found for {hash_key}")
            return
        
        print(f"Found combination ID {combination.id}")
        
        # Step 4: Create simple mapping
        third_team_mapping = {
            '3rd_team_1': 'match_1A',
            '3rd_team_2': 'match_1B', 
            '3rd_team_3': 'match_1D',
            '3rd_team_4': 'match_1E',
            '3rd_team_5': 'match_1G',
            '3rd_team_6': 'match_1I',
            '3rd_team_7': 'match_1K',
            '3rd_team_8': 'match_1L'
        }
        
        # Step 5: Create KnockoutStagePrediction records
        round32_templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage == 'round32'
        ).order_by(MatchTemplate.id).all()
        
        print(f"Creating {len(round32_templates)} KnockoutStagePrediction records...")
        
        for template in round32_templates:
            # Resolve the participating teams
            home_team = get_team_for_source(db, template.team_1)
            away_team = get_team_for_source(db, template.team_2, combination, third_team_mapping)
            
            if home_team and away_team:
                # Check if a prediction already exists
                existing = db.query(KnockoutStagePrediction).filter(
                    KnockoutStagePrediction.user_id == user_id,
                    KnockoutStagePrediction.template_match_id == template.id
                ).first()
                
                if not existing:
                    # Find the matching KnockoutStageResult
                    from models.results import KnockoutStageResult
                    result = db.query(KnockoutStageResult).filter(
                        KnockoutStageResult.match_id == template.id
                    ).first()
                    
                    if result:
                        prediction = KnockoutStagePrediction(
                            user_id=user_id,
                            knockout_result_id=result.id,
                            template_match_id=template.id,
                            stage=template.stage,  # include stage field
                            team1_id=home_team.id,
                            team2_id=away_team.id,
                            winner_team_id=None,
                            status="must_change_predict"  # initial status
                        )
                    else:
                        print(f"  KnockoutStageResult not found for match_id {template.id}")
                        continue
                    
                    db.add(prediction)
                    print(f"  Created prediction for match {template.id}: {home_team.name} vs {away_team.name}")
                else:
                    print(f"  Prediction for match {template.id} already exists")
            else:
                print(f"  Failed to resolve teams for match {template.id}")
        
        db.commit()
        print("\n✅ Bracket built successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def get_team_for_source(db, team_source, combination=None, third_team_mapping=None):
    """Find the appropriate team according to the template - simple version"""
    
    if team_source.startswith('3rd_team_'):
        # Third-place team
        if combination and third_team_mapping:
            # Find the corresponding column name
            column_name = third_team_mapping[team_source]  # 3rd_team_1 -> match_1A
            
            # Get the value from the combination
            third_place_source = getattr(combination, column_name)  # 3A, 3B, etc.
            
            # Resolve the 3rd-place team in the appropriate group
            group_letter = third_place_source[1]  # 3A -> A
            group = db.query(Group).filter(Group.name == group_letter).first()
            
            if group:
                group_pred = db.query(GroupStagePrediction).filter(
                    GroupStagePrediction.group_id == group.id,
                    GroupStagePrediction.user_id == user_id
                ).first()
                
                if group_pred:
                    return db.query(Team).filter(Team.id == group_pred.third_place).first()
        
        return None
    
    else:
        # Regular team (1A, 2B, etc.)
        if len(team_source) >= 2 and team_source[0].isdigit():
            group_letter = team_source[1]  # 1A -> A
            position = int(team_source[0])  # 1A -> 1
            
            group = db.query(Group).filter(Group.name == group_letter).first()
            if group:
                group_pred = db.query(GroupStagePrediction).filter(
                    GroupStagePrediction.group_id == group.id,
                    GroupStagePrediction.user_id == user_id
                ).first()
                
                if group_pred:
                    if position == 1:
                        return db.query(Team).filter(Team.id == group_pred.first_place).first()
                    elif position == 2:
                        return db.query(Team).filter(Team.id == group_pred.second_place).first()
        
        return None

if __name__ == "__main__":
    build_knockout_bracket()

