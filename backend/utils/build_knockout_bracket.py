#!/usr/bin/env python3
"""
Build the knockout bracket based on user predictions
This script creates the Round of 32 matches (73-88) based on:
1. Group stage predictions (who finishes 1st and 2nd in each group)
2. Third place predictions (which 8 groups advance from 3rd place)
3. Third place combinations mapping
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.predictions import GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.third_place_combinations import ThirdPlaceCombination
from models.matches import Match
from models.matches_template import MatchTemplate
from models.team import Team
from models.groups import Group

def build_knockout_bracket():
    """Build the Round of 32 bracket based on predictions"""
    
    db = SessionLocal()
    try:
        print("🏆 Building the Round of 32 bracket...")
        
        # Step 1: Read group predictions
        print("\n📊 Reading group predictions...")
        group_predictions = db.query(GroupStagePrediction).all()
        
        if not group_predictions:
            print("❌ No group predictions found! Please create predictions first.")
            return
        
        print(f"Found {len(group_predictions)} group predictions")
        
        # Step 2: Read third-place predictions
        print("\n🥉 Reading third-place predictions...")
        third_place_predictions = db.query(ThirdPlacePrediction).all()
        
        if not third_place_predictions:
            print("❌ No third-place predictions found! Please create predictions first.")
            return
        
        print(f"Found {len(third_place_predictions)} third-place predictions")
        
        # Step 3: Build the list of third-place qualifying groups
        print("\n🔍 Building list of third-place qualifying groups...")
        third_place_groups = []
        
        # Use the first prediction (we assume there is one)
        if third_place_predictions:
            prediction = third_place_predictions[0]
            
            # Resolve the groups of the qualifying teams
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
            
            # מוצא את הבתים של הקבוצות האלה
            for team_id in qualifying_teams:
                team = db.query(Team).filter(Team.id == team_id).first()
                if team and team.group_letter not in third_place_groups:
                    third_place_groups.append(team.group_letter)
        
        # Create a sorted hash key (for lookup only)
        hash_key = ''.join(sorted(third_place_groups))
        print(f"Third-place qualifiers (original order): {third_place_groups}")
        print(f"Hash key (sorted): {hash_key}")
        
        # Step 4: Find the matching combination
        print("\n🎯 Finding matching combination...")
        combination = db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()
        
        if not combination:
            print(f"❌ No combination found for {hash_key}")
            return
        
        print(f"Found combination ID {combination.id}: {combination.hash_key}")
        
        # Step 5: Build team mapping
        print("\n🗺️ Building team mapping...")
        team_mapping = build_team_mapping(db, group_predictions, combination)
        
        # Step 6: Create KnockoutStagePrediction records (not real matches!)
        print("\n📝 Creating KnockoutStagePrediction records...")
        create_knockout_predictions(db, team_mapping, combination)
        
        db.commit()
        print("\n✅ Bracket built successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def build_team_mapping(db, group_predictions, combination):
    """Build mapping of teams for Round of 32 matches"""
    
    team_mapping = {}
    
    # Create a dictionary of group predictions
    group_predictions_dict = {}
    for pred in group_predictions:
        # Resolve group name via relationship
        group_name = pred.group.name
        group_predictions_dict[group_name] = pred
    
    # Map teams according to the template
    mapping_rules = {
        'match_1A': combination.match_1A,  # 3A -> match_1A
        'match_1B': combination.match_1B,  # 3B -> match_1B
        'match_1D': combination.match_1D,  # 3C -> match_1D
        'match_1E': combination.match_1E,  # 3D -> match_1E
        'match_1G': combination.match_1G,  # 3E -> match_1G
        'match_1I': combination.match_1I,  # 3F -> match_1I
        'match_1K': combination.match_1K,  # 3G -> match_1K
        'match_1L': combination.match_1L,  # 3H -> match_1L
    }
    
    # Mapping for the Round of 32 must match MatchTemplate
    
    print("Team mapping:")
    for match_key, third_place_group in mapping_rules.items():
        group_letter = third_place_group[1]  # 3A -> A
        if group_letter in group_predictions_dict:
            pred = group_predictions_dict[group_letter]
            third_place_team = db.query(Team).filter(Team.id == pred.third_place).first()
            if third_place_team:
                team_mapping[match_key] = third_place_team
                print(f"  {match_key}: {third_place_team.name} (Group {group_letter}, 3rd place)")
    
    return team_mapping

def find_team_for_template(db, team_source, team_mapping, combination=None, match_template=None):
    """Find the team according to the template"""
    if team_source.startswith('3rd_team_'):  # 3rd_team_1
        # מחפש במיפוי של עולות ממקום 3
        # 3rd_team_1 -> צריך למצוא את הקבוצה המתאימה לפי הקומבינציה
        if combination and match_template:
            # מוצא את הקבוצה המתאימה לפי הקומבינציה
            # 3rd_team_1 -> צריך למצוא איזה match_key מתאים
            # האלגוריתם: מוצאים את הקבוצה הראשונה במשחק (נניח 1A)
            # ומחפשים ב-third_place_combinations את הערך של match_1A (נניח 3D)
            # ואז הולכים ל-group_predictions ומחלצים את הקבוצה ממקום 3 בבית D
            
            # מוצא את הקבוצה הראשונה במשחק (home_team)
            home_team_source = match_template.team_1 if match_template.team_1 != team_source else match_template.team_2
            
            if home_team_source and len(home_team_source) >= 2 and home_team_source[0].isdigit():
                # home_team_source הוא כמו "1A", "1E", etc.
                group_letter = home_team_source[1]  # 1A -> A
                position = int(home_team_source[0])  # 1A -> 1
                
                # מוצא את הקבוצה המתאימה לפי הקומבינציה
                if position == 1:  # רק מקום ראשון
                    # מחפש ב-third_place_combinations את הערך המתאים
                    match_key = f"match_1{group_letter}"  # match_1A, match_1E, etc.
                    
                    if hasattr(combination, match_key):
                        third_place_source = getattr(combination, match_key)  # 3D, 3A, etc.
                        
                        # מוצא את הקבוצה ממקום 3 בבית המתאים
                        third_group_letter = third_place_source[1]  # 3D -> D
                        third_group = db.query(Group).filter(Group.name == third_group_letter).first()
                        
                        if third_group:
                            group_pred = db.query(GroupStagePrediction).filter(
                                GroupStagePrediction.group_id == third_group.id
                            ).first()
                            
                            if group_pred:
                                return db.query(Team).filter(Team.id == group_pred.third_place).first()
            
            print(f"  ⚠️  לא הצליח למצוא קבוצה עבור {team_source}")
            return None
        return None
    elif team_source.startswith('3'):  # 3rd place
        # Search in third-place mapping
        for match_key, team in team_mapping.items():
            if team_source in match_key:
                return team
    else:  # 1st or 2nd place
        # Search in group predictions
        # team_source can be "1A", "2B", "3C", etc.
        if len(team_source) >= 2 and team_source[0].isdigit():
            group_letter = team_source[1]  # 1A -> A
            position = int(team_source[0])  # 1A -> 1
        else:
            return None
        
        # Find group by letter
        group = db.query(Group).filter(Group.name == group_letter).first()
        if group:
            group_pred = db.query(GroupStagePrediction).filter(
                GroupStagePrediction.group_id == group.id
            ).first()
        
        if group_pred:
            if position == 1:
                return db.query(Team).filter(Team.id == group_pred.first_place).first()
            elif position == 2:
                return db.query(Team).filter(Team.id == group_pred.second_place).first()
    
    return None

def create_knockout_predictions(db, team_mapping, combination):
    """יוצר KnockoutStagePrediction records"""
    
    # קורא את התבנית של משחקי 32 הגדולות
    round32_templates = db.query(MatchTemplate).filter(
        MatchTemplate.stage == 'round32'
    ).order_by(MatchTemplate.id).all()
    
    print(f"יוצר {len(round32_templates)} KnockoutStagePrediction records...")
    
    for template in round32_templates:
        # מוצא את הקבוצות המתאימות
        home_team = find_team_for_template(db, template.team_1, team_mapping, combination, template)
        away_team = find_team_for_template(db, template.team_2, team_mapping, combination, template)
        
        if home_team and away_team:
            # בודק אם כבר קיים prediction
            existing = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.template_match_id == template.id
            ).first()
            
            if not existing:
                # מוצא את ה-KnockoutStageResult המתאים
                from models.results import KnockoutStageResult
                result = db.query(KnockoutStageResult).filter(
                    KnockoutStageResult.match_id == template.id
                ).first()
                
                if result:
                    prediction = KnockoutStagePrediction(
                        user_id=1,  # ברירת מחדל - user 1
                        knockout_result_id=result.id,
                        template_match_id=template.id,
                        stage=template.stage,  # הוספנו את השדה stage
                        winner_team_id=None,  # לא מנחשים על המנצחת כרגע
                        status="must_change_predict"  # סטטוס התחלתי
                    )
                else:
                    print(f"  לא נמצא KnockoutStageResult עבור match_id {template.id}")
                    continue
                
                db.add(prediction)
                print(f"  נוצר prediction עבור משחק {template.id}: {home_team.name} vs {away_team.name}")
            else:
                print(f"  prediction עבור משחק {template.id} כבר קיים")
        else:
            print(f"  לא הצליח למצוא קבוצות עבור משחק {template.id}")

if __name__ == "__main__":
    build_knockout_bracket()
