#!/usr/bin/env python3
"""
Build Knockout Bracket Script
Creates knockout stage predictions based on group predictions and third place combinations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models.predictions import GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from backend.models.third_place_combinations import ThirdPlaceCombination
from backend.models.matches import Match
from backend.models.groups import Group
from backend.models.team import Team
from sqlalchemy.orm import joinedload

def get_third_place_teams_from_predictions(db, user_id):
    """
    מקבל את 8 הקבוצות ממקום 3 לפי הניחושים
    מחזיר רשימה של קבוצות בסדר אלפביתי של שמות הבתים
    """
    # מקבל את כל הניחושים של בתים
    group_predictions = db.query(GroupStagePrediction).filter_by(user_id=user_id).all()
    
    third_place_teams = []
    group_letters = []
    
    for prediction in group_predictions:
        # מקבל את שם הבית
        group = db.query(Group).filter_by(id=prediction.group_id).first()
        if group:
            group_letters.append(group.name)
            third_place_teams.append(prediction.third_place)
    
    # מיון לפי סדר אלפביתי של שמות הבתים
    sorted_data = sorted(zip(group_letters, third_place_teams))
    sorted_teams = [team_id for _, team_id in sorted_data]
    
    return sorted_teams, [letter for letter, _ in sorted_data]

def find_third_place_combination(db, group_letters):
    """
    מוצא את הקומבינציה המתאימה לפי hash key
    """
    # יוצר hash key מהאותיות
    hash_key = ''.join(sorted(group_letters))
    
    combination = db.query(ThirdPlaceCombination).filter_by(hash_key=hash_key).first()
    return combination

def get_team_from_group_position(db, user_id, group_letter, position):
    """
    מקבל קבוצה לפי בית ומיקום מהניחושים
    position: 1, 2, 3, 4
    """
    # מוצא את הבית
    group = db.query(Group).filter_by(name=group_letter).first()
    if not group:
        return None
    
    # מוצא את הניחוש של הבית
    prediction = db.query(GroupStagePrediction).filter_by(
        user_id=user_id, 
        group_id=group.id
    ).first()
    
    if not prediction:
        return None
    
    # מחזיר את הקבוצה לפי המיקום
    if position == 1:
        return prediction.first_place
    elif position == 2:
        return prediction.second_place
    elif position == 3:
        return prediction.third_place
    elif position == 4:
        return prediction.fourth_place
    
    return None

def get_third_place_team_from_combination(combination, position):
    """
    מקבל קבוצה ממקום 3 לפי הקומבינציה
    position: 1-8 (המיקום בקומבינציה)
    """
    if position == 1:
        return getattr(combination, 'match_1A', None)
    elif position == 2:
        return getattr(combination, 'match_1B', None)
    elif position == 3:
        return getattr(combination, 'match_1D', None)
    elif position == 4:
        return getattr(combination, 'match_1E', None)
    elif position == 5:
        return getattr(combination, 'match_1G', None)
    elif position == 6:
        return getattr(combination, 'match_1I', None)
    elif position == 7:
        return getattr(combination, 'match_1K', None)
    elif position == 8:
        return getattr(combination, 'match_1L', None)
    
    return None

def resolve_team_source(db, user_id, team_source, third_place_combination):
    """
    פותר team_source לקבוצה אמיתית
    team_source יכול להיות: "A1", "B2", "3rd_combination_1", וכו'
    """
    if team_source.startswith("3rd_combination_"):
        # מקבל את המיקום בקומבינציה
        position = int(team_source.split("_")[-1])
        return get_third_place_team_from_combination(third_place_combination, position)
    
    elif len(team_source) == 2:
        # פורמט כמו "A1", "B2"
        group_letter = team_source[0]
        position = int(team_source[1])
        return get_team_from_group_position(db, user_id, group_letter, position)
    
    return None

def build_knockout_bracket(db, user_id):
    """
    בונה את הבראקט של 32 הגדולות לפי הניחושים
    """
    print(f"בונה בראקט עבור משתמש {user_id}...")
    
    # שלב 1: מקבל את 8 הקבוצות ממקום 3
    third_place_teams, group_letters = get_third_place_teams_from_predictions(db, user_id)
    print(f"קבוצות ממקום 3: {group_letters}")
    
    # שלב 2: מוצא את הקומבינציה המתאימה
    combination = find_third_place_combination(db, group_letters)
    if not combination:
        print(f"לא נמצאה קומבינציה עבור {group_letters}")
        return False
    
    print(f"נמצאה קומבינציה: {combination.hash_key}")
    
    # שלב 3: מקבל את משחקי 32 הגדולות (matches 73-88)
    round32_matches = db.query(Match).filter(
        Match.stage == "round32",
        Match.id >= 73,
        Match.id <= 88
    ).order_by(Match.id).all()
    
    print(f"נמצאו {len(round32_matches)} משחקי 32 הגדולות")
    
    # שלב 4: עובר על כל משחק ובונה את הניחוש
    predictions_created = 0
    
    for match in round32_matches:
        print(f"\nמעבד משחק {match.id}: {match.home_team_source} vs {match.away_team_source}")
        
        # פותר את הקבוצות
        home_team_id = resolve_team_source(db, user_id, match.home_team_source, combination)
        away_team_id = resolve_team_source(db, user_id, match.away_team_source, combination)
        
        if not home_team_id or not away_team_id:
            print(f"לא ניתן לפתור קבוצות עבור משחק {match.id}")
            continue
        
        # בודק אם כבר קיים ניחוש למשחק הזה
        existing_prediction = db.query(KnockoutStagePrediction).filter_by(
            user_id=user_id,
            knockout_match_id=match.id
        ).first()
        
        if existing_prediction:
            print(f"ניחוש כבר קיים עבור משחק {match.id}")
            continue
        
        # יוצר ניחוש חדש (בינתיים בלי מנצח - נמלא אחר כך)
        prediction = KnockoutStagePrediction(
            user_id=user_id,
            stage="round32",
            knockout_match_id=match.id,
            winner_team_id=home_team_id  # זמני - נמלא אחר כך
        )
        
        db.add(prediction)
        predictions_created += 1
        
        # הדפסה לבדיקה
        home_team = db.query(Team).filter_by(id=home_team_id).first()
        away_team = db.query(Team).filter_by(id=away_team_id).first()
        print(f"נוצר ניחוש: {home_team.name if home_team else 'Unknown'} vs {away_team.name if away_team else 'Unknown'}")
    
    # שמירה
    try:
        db.commit()
        print(f"\n✅ נשמרו {predictions_created} ניחושי 32 הגדולות בהצלחה!")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ שגיאה בשמירה: {e}")
        return False

def main():
    """פונקציה ראשית"""
    db = SessionLocal()
    try:
        # בונה בראקט עבור משתמש 1 (לפי הדוגמה)
        success = build_knockout_bracket(db, user_id=1)
        
        if success:
            print("\n🎉 הבראקט נבנה בהצלחה!")
        else:
            print("\n❌ נכשל בבניית הבראקט")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
