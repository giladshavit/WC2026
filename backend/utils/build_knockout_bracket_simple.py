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

def build_knockout_bracket():
    """בונה את הבראקט של 32 הגדולות לפי הניחושים - גרסה פשוטה"""
    
    db = SessionLocal()
    try:
        print("🏆 בונה את הבראקט של 32 הגדולות...")
        
        # שלב 1: קורא את הניחושים של העולות ממקום 3
        third_place_predictions = db.query(ThirdPlacePrediction).all()
        if not third_place_predictions:
            print("❌ לא נמצאו ניחושי עולות ממקום 3!")
            return
        
        prediction = third_place_predictions[0]
        
        # שלב 2: בונה את רשימת העולות ממקום 3 (בסדר המקורי!)
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
        
        # מוצא את הבתים של הקבוצות העולות (בסדר המקורי!)
        third_place_groups = []
        for team_id in qualifying_teams:
            team = db.query(Team).filter(Team.id == team_id).first()
            if team:
                third_place_groups.append(team.group_letter)
        
        print(f"עולות ממקום 3 (סדר מקורי): {third_place_groups}")
        
        # שלב 3: מוצא את הקומבינציה המתאימה
        hash_key = ''.join(sorted(third_place_groups))  # רק לצורך חיפוש
        combination = db.query(ThirdPlaceCombination).filter(
            ThirdPlaceCombination.hash_key == hash_key
        ).first()
        
        if not combination:
            print(f"❌ לא נמצאה קומבינציה עבור {hash_key}")
            return
        
        print(f"נמצאה קומבינציה ID {combination.id}")
        
        # שלב 4: יוצר מיפוי פשוט
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
        
        # שלב 5: יוצר KnockoutStagePrediction records
        round32_templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage == 'round32'
        ).order_by(MatchTemplate.id).all()
        
        print(f"יוצר {len(round32_templates)} KnockoutStagePrediction records...")
        
        for template in round32_templates:
            # מוצא את הקבוצות המתאימות
            home_team = get_team_for_source(db, template.team_1)
            away_team = get_team_for_source(db, template.team_2, combination, third_team_mapping)
            
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
                            user_id=1,
                            knockout_result_id=result.id,
                            template_match_id=template.id,
                            stage=template.stage,  # הוספנו את השדה stage
                            team1_id=home_team.id,
                            team2_id=away_team.id,
                            winner_team_id=None,
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
        
        db.commit()
        print("\n✅ הבראקט נבנה בהצלחה!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def get_team_for_source(db, team_source, combination=None, third_team_mapping=None):
    """מוצא את הקבוצה המתאימה לפי התבנית - גרסה פשוטה"""
    
    if team_source.startswith('3rd_team_'):
        # זה קבוצה ממקום 3
        if combination and third_team_mapping:
            # מוצא את העמודה המתאימה
            column_name = third_team_mapping[team_source]  # 3rd_team_1 -> match_1A
            
            # מוצא את הערך מהקומבינציה
            third_place_source = getattr(combination, column_name)  # 3A, 3B, etc.
            
            # מוצא את הקבוצה ממקום 3 בבית המתאים
            group_letter = third_place_source[1]  # 3A -> A
            group = db.query(Group).filter(Group.name == group_letter).first()
            
            if group:
                group_pred = db.query(GroupStagePrediction).filter(
                    GroupStagePrediction.group_id == group.id
                ).first()
                
                if group_pred:
                    return db.query(Team).filter(Team.id == group_pred.third_place).first()
        
        return None
    
    else:
        # זה קבוצה רגילה (1A, 2B, etc.)
        if len(team_source) >= 2 and team_source[0].isdigit():
            group_letter = team_source[1]  # 1A -> A
            position = int(team_source[0])  # 1A -> 1
            
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

if __name__ == "__main__":
    build_knockout_bracket()

