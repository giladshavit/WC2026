from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
import subprocess
import sys
import os

from database import get_db

router = APIRouter()

class UpdatePredictionRequest(BaseModel):
    winner_team_number: int  # 1 או 2
    winner_team_name: str

@router.post("/knockout/build-bracket")
def build_knockout_bracket(db: Session = Depends(get_db)):
    """
    בונה את הבראקט של 32 הגדולות לפי הניחושים הקיימים
    """
    try:
        # מריץ את הסקריפט לבניית הבראקט
        script_path = os.path.join(os.path.dirname(__file__), "..", "utils", "build_knockout_bracket.py")
        python_path = os.path.join(os.path.dirname(__file__), "..", "venv", "bin", "python")
        
        result = subprocess.run(
            [python_path, script_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(__file__))
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=500, 
                detail=f"שגיאה בבניית הבראקט: {result.stderr}"
            )
        
        return {
            "success": True,
            "message": "הבראקט נבנה בהצלחה!",
            "output": result.stdout
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה בבניית הבראקט: {str(e)}"
        )

@router.get("/knockout/predictions")
def get_knockout_predictions(stage: str = None, db: Session = Depends(get_db)):
    """
    מביא את כל הניחושים של משחקי הנוקאאוט עם שמות הקבוצות האמיתיות
    אם אין ניחושים לשלב המבוקש, יוצר אותם אוטומטית
    """
    try:
        from models.predictions import KnockoutStagePrediction, GroupStagePrediction, ThirdPlacePrediction
        from models.matches_template import MatchTemplate
        from models.team import Team
        from models.third_place_combinations import ThirdPlaceCombination
        from models.user import User
        from models.results import KnockoutStageResult
        
        # אם לא צוין שלב, מחזיר את כל הניחושים
        if stage:
            # מוצא את ה-templates של השלב המבוקש
            templates = db.query(MatchTemplate).filter(MatchTemplate.stage == stage).all()
            template_ids = [t.id for t in templates]
            
            # בדוק אם יש ניחושים לשלב הזה
            existing_predictions = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.template_match_id.in_(template_ids)
            ).all()
            
            # אם אין ניחושים, צור אותם
            if not existing_predictions:
                print(f"אין ניחושים לשלב {stage}, יוצר אותם...")
                print(f"מספר templates: {len(templates)}")
                create_predictions_for_stage(db, stage, templates)
                
                # טען שוב את הניחושים
                existing_predictions = db.query(KnockoutStagePrediction).filter(
                    KnockoutStagePrediction.template_match_id.in_(template_ids)
                ).all()
            
            predictions = existing_predictions
        else:
            predictions = db.query(KnockoutStagePrediction).all()
        
        result = []
        for pred in predictions:
            # מוצא את התבנית
            template = db.query(MatchTemplate).filter(
                MatchTemplate.id == pred.template_match_id
            ).first()
            
            if template:
                # מוצא את שמות הקבוצות - עכשיו פשוט יותר!
                team1_name = pred.team1.name if pred.team1 else "קבוצה 1"
                team2_name = pred.team2.name if pred.team2 else "קבוצה 2"
                winner_team_name = pred.winner_team.name if pred.winner_team else None
                
                result.append({
                    "id": pred.id,
                    "match_id": pred.template_match_id,
                    "template": f"{template.team_1} vs {template.team_2}",
                    "home_team": team1_name,
                    "away_team": team2_name,
                    "display": f"{team1_name} vs {team2_name}",
                    "winner_team_id": pred.winner_team_id,
                    "winner_team_name": winner_team_name,
                    "created_at": pred.created_at
                })
        
        return {
            "success": True,
            "predictions": result,
            "count": len(result)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה בקבלת הניחושים: {str(e)}"
        )

def get_team_name_for_template(db, team_source):
    """
    מוצא את שם הקבוצה האמיתי לפי התבנית (כמו 1A, 2B, Best_3rd_ABCDF)
    """
    try:
        from models.predictions import GroupStagePrediction, ThirdPlacePrediction
        from models.team import Team
        from models.third_place_combinations import ThirdPlaceCombination
        
        if team_source.startswith('3rd_team_'):
            # זה קבוצה ממקום 3 - צריך למצוא אותה דרך third_place_combinations
            # קודם מוצא את הקומבינציה המתאימה
            third_place_predictions = db.query(ThirdPlacePrediction).all()
            if not third_place_predictions:
                return f"קבוצה ממקום 3 ({team_source})"
            
            # בונה רשימת עולות ממקום 3
            advancing_teams = []
            for pred in third_place_predictions:
                # מוצא את כל הקבוצות העולות
                team_ids = [
                    pred.first_team_qualifying,
                    pred.second_team_qualifying,
                    pred.third_team_qualifying,
                    pred.fourth_team_qualifying,
                    pred.fifth_team_qualifying,
                    pred.sixth_team_qualifying,
                    pred.seventh_team_qualifying,
                    pred.eighth_team_qualifying
                ]
                
                for team_id in team_ids:
                    team = db.query(Team).filter(Team.id == team_id).first()
                    if team:
                        advancing_teams.append(team.group_letter)
            
            advancing_teams.sort()
            hash_key = ''.join(advancing_teams)
            
            # מוצא את הקומבינציה המתאימה
            combination = db.query(ThirdPlaceCombination).filter(
                ThirdPlaceCombination.hash_key == hash_key
            ).first()
            
            if not combination:
                return f"קבוצה ממקום 3 ({team_source})"
            
            # מוצא את הקבוצה המתאימה לפי התבנית
            # team_source הוא כמו "3rd_team_1" - צריך למצוא את הקבוצה המתאימה
            # הסדר הנכון: 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L
            if team_source == "3rd_team_1":
                # זה משחק נגד 1A, אז צריך את match_1A
                team_letter = combination.match_1A
            elif team_source == "3rd_team_2":
                # זה משחק נגד 1B, אז צריך את match_1B
                team_letter = combination.match_1B
            elif team_source == "3rd_team_3":
                # זה משחק נגד 1D, אז צריך את match_1D
                team_letter = combination.match_1D
            elif team_source == "3rd_team_4":
                # זה משחק נגד 1E, אז צריך את match_1E
                team_letter = combination.match_1E
            elif team_source == "3rd_team_5":
                # זה משחק נגד 1G, אז צריך את match_1G
                team_letter = combination.match_1G
            elif team_source == "3rd_team_6":
                # זה משחק נגד 1I, אז צריך את match_1I
                team_letter = combination.match_1I
            elif team_source == "3rd_team_7":
                # זה משחק נגד 1K, אז צריך את match_1K
                team_letter = combination.match_1K
            elif team_source == "3rd_team_8":
                # זה משחק נגד 1L, אז צריך את match_1L
                team_letter = combination.match_1L
            else:
                return f"קבוצה ממקום 3 ({team_source})"
            
            # מוצא את הקבוצה במקום 3 בבית המתאים
            if team_letter:
                # team_letter הוא כמו "3A" - צריך לחלץ את האות
                if len(team_letter) >= 2 and team_letter[0] == '3':
                    group_letter = team_letter[1]
                    
                    group_predictions = db.query(GroupStagePrediction).all()
                    for group_pred in group_predictions:
                        if group_pred.group.name == group_letter:
                            third_place_team = db.query(Team).filter(Team.id == group_pred.third_place).first()
                            if third_place_team:
                                return third_place_team.name
                
                return f"קבוצה ממקום 3 ({team_source})"
            else:
                return f"קבוצה ממקום 3 ({team_source})"
        
        else:
            # זה קבוצה רגילה (1A, 2B, וכו')
            if len(team_source) >= 2 and team_source[0].isdigit():
                position = int(team_source[0])
                group_letter = team_source[1]
                
                # מוצא את הקבוצה במקום המתאים בבית המתאים
                group_predictions = db.query(GroupStagePrediction).all()
                for group_pred in group_predictions:
                    if group_pred.group.name == group_letter:
                        team_id = None
                        if position == 1:
                            team_id = group_pred.first_place
                        elif position == 2:
                            team_id = group_pred.second_place
                        elif position == 3:
                            team_id = group_pred.third_place
                        elif position == 4:
                            team_id = group_pred.fourth_place
                        
                        if team_id:
                            team = db.query(Team).filter(Team.id == team_id).first()
                            if team:
                                return team.name
                
                return f"קבוצה {team_source}"
            else:
                return f"קבוצה {team_source}"
                
    except Exception as e:
        print(f"Error getting team name for {team_source}: {e}")
        return f"קבוצה {team_source}"

def get_team_id_for_template(db, team_source):
    """
    מוצא את ID הקבוצה האמיתי לפי התבנית (כמו 1A, 2B, Best_3rd_ABCDF)
    """
    try:
        from models.predictions import GroupStagePrediction, ThirdPlacePrediction
        from models.team import Team
        from models.third_place_combinations import ThirdPlaceCombination
        
        if team_source.startswith('3rd_team_'):
            # זה קבוצה ממקום 3 - צריך למצוא אותה דרך third_place_combinations
            # קודם מוצא את הקומבינציה המתאימה
            third_place_predictions = db.query(ThirdPlacePrediction).all()
            if not third_place_predictions:
                return None
            
            # בונה רשימת עולות ממקום 3
            advancing_teams = []
            for pred in third_place_predictions:
                # מוצא את כל הקבוצות העולות
                team_ids = [
                    pred.first_team_qualifying,
                    pred.second_team_qualifying,
                    pred.third_team_qualifying,
                    pred.fourth_team_qualifying,
                    pred.fifth_team_qualifying,
                    pred.sixth_team_qualifying,
                    pred.seventh_team_qualifying,
                    pred.eighth_team_qualifying
                ]
                
                for team_id in team_ids:
                    team = db.query(Team).filter(Team.id == team_id).first()
                    if team:
                        advancing_teams.append(team.group_letter)
            
            advancing_teams.sort()
            hash_key = ''.join(advancing_teams)
            
            # מוצא את הקומבינציה המתאימה
            combination = db.query(ThirdPlaceCombination).filter(
                ThirdPlaceCombination.hash_key == hash_key
            ).first()
            
            if not combination:
                return None
            
            # מוצא את הקבוצה המתאימה לפי התבנית
            if team_source == "3rd_team_1":
                team_letter = combination.match_1A
            elif team_source == "3rd_team_2":
                team_letter = combination.match_1B
            elif team_source == "3rd_team_3":
                team_letter = combination.match_1D
            elif team_source == "3rd_team_4":
                team_letter = combination.match_1E
            elif team_source == "3rd_team_5":
                team_letter = combination.match_1G
            elif team_source == "3rd_team_6":
                team_letter = combination.match_1I
            elif team_source == "3rd_team_7":
                team_letter = combination.match_1K
            elif team_source == "3rd_team_8":
                team_letter = combination.match_1L
            else:
                return None
            
            # מוצא את הקבוצה במקום 3 בבית המתאים
            if team_letter:
                # team_letter הוא כמו "3A" - צריך לחלץ את האות
                if len(team_letter) >= 2 and team_letter[0] == '3':
                    group_letter = team_letter[1]
                    
                    group_predictions = db.query(GroupStagePrediction).all()
                    for group_pred in group_predictions:
                        if group_pred.group.name == group_letter:
                            return group_pred.third_place
                
                return None
            else:
                return None
        
        else:
            # זה קבוצה רגילה (1A, 2B, וכו')
            if len(team_source) >= 2 and team_source[0].isdigit():
                position = int(team_source[0])
                group_letter = team_source[1]
                
                # מוצא את הקבוצה במקום המתאים בבית המתאים
                group_predictions = db.query(GroupStagePrediction).all()
                for group_pred in group_predictions:
                    if group_pred.group.name == group_letter:
                        team_id = None
                        if position == 1:
                            team_id = group_pred.first_place
                        elif position == 2:
                            team_id = group_pred.second_place
                        elif position == 3:
                            team_id = group_pred.third_place
                        elif position == 4:
                            team_id = group_pred.fourth_place
                        
                        return team_id
                
                return None
            else:
                return None
                
    except Exception as e:
        print(f"Error getting team ID for {team_source}: {e}")
        return None

def create_predictions_for_stage(db, stage, templates):
    """
    יוצר ניחושים לשלב מסוים לפי הניחושים הקיימים מהשלב הקודם
    """
    from models.user import User
    from models.results import KnockoutStageResult
    from models.predictions import KnockoutStagePrediction
    
    # מוצא משתמש (אנחנו מניחים שיש משתמש אחד)
    user = db.query(User).first()
    if not user:
        print("לא נמצא משתמש!")
        return
    
    # מוצא את כל ה-results הקיימים
    existing_results = db.query(KnockoutStageResult).all()
    results_by_match_id = {r.match_id: r for r in existing_results}
    
    predictions_created = 0
    
    for template in templates:
        # בדוק אם כבר יש ניחוש לתבנית הזו
        existing_prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == template.id,
            KnockoutStagePrediction.user_id == user.id
        ).first()
        
        if existing_prediction:
            continue
        
        # מוצא את ה-result המתאים
        result = results_by_match_id.get(template.id)
        if not result:
            print(f"לא נמצא result לתבנית {template.id}")
            continue
        
        # מוצא את הקבוצות לפי ה-template
        team1_id = None
        team2_id = None
        
        if template.team_1.startswith('Winner_M'):
            # זה מנצחת ממשחק קודם - צריך למצוא אותה
            match_id = int(template.team_1.split('_')[1].replace('M', ''))  # Winner_M73 -> 73
            team1_id = get_winner_from_previous_stage(db, match_id)
        
        if template.team_2.startswith('Winner_M'):
            # זה מנצחת ממשחק קודם - צריך למצוא אותה
            match_id = int(template.team_2.split('_')[1].replace('M', ''))  # Winner_M74 -> 74
            team2_id = get_winner_from_previous_stage(db, match_id)
        
        # יוצר ניחוש חדש
        prediction = KnockoutStagePrediction(
            user_id=user.id,
            knockout_result_id=result.id,
            template_match_id=template.id,
            team1_id=team1_id,
            team2_id=team2_id,
            winner_team_id=None  # עדיין לא נבחר
        )
        
        db.add(prediction)
        predictions_created += 1
        
        # עדכן את ה-knockout_id בטמפלייט
        template.knockout_id = prediction.id
        
        print(f"נוצר ניחוש לתבנית {template.id} ({template.stage}): {template.team_1} vs {template.team_2}")
    
    db.commit()
    print(f"נוצרו {predictions_created} ניחושים לשלב {stage}!")

def get_winner_from_previous_stage(db, match_id):
    """
    מוצא את המנצחת ממשחק קודם לפי match_id
    """
    from models.predictions import KnockoutStagePrediction
    
    # מוצא את הניחוש של המשחק הקודם
    previous_prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.template_match_id == match_id
    ).first()
    
    if previous_prediction and previous_prediction.winner_team_id:
        print(f"מצא מנצחת למשחק {match_id}: {previous_prediction.winner_team_id}")
        return previous_prediction.winner_team_id
    
    print(f"לא נמצא מנצחת למשחק {match_id}")
    return None

def clear_chain_predictions(db, prediction):
    """
    מוחק את כל הניחושים הבאים בשרשרת כשמשתמש משנה ניחוש
    """
    from models.predictions import KnockoutStagePrediction
    from models.matches_template import MatchTemplate
    
    # מוצא את התבנית של הניחוש הנוכחי
    current_template = db.query(MatchTemplate).filter(
        MatchTemplate.id == prediction.template_match_id
    ).first()
    
    if not current_template or not current_template.winner_destination:
        return  # אין destination, לא צריך למחוק כלום
    
    # מפרסר את ה-destination
    try:
        dest_parts = current_template.winner_destination.split('_')
        next_match_id = int(dest_parts[0])
        position = int(dest_parts[1])
    except:
        return
    
    # מוצא את הניחוש הבא
    next_prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.template_match_id == next_match_id
    ).first()
    
    if not next_prediction:
        return  # אין ניחוש למחוק
    
    # מוחק את הקבוצה מהניחוש הבא
    if position == 1:
        next_prediction.team1_id = None
    elif position == 2:
        next_prediction.team2_id = None
    
    # אם שתי הקבוצות נמחקו, מוחק את כל הניחוש
    if not next_prediction.team1_id and not next_prediction.team2_id:
        db.delete(next_prediction)
        print(f"נמחק ניחוש {next_prediction.id}")
    else:
        print(f"נמחקה קבוצה {position} מניחוש {next_prediction.id}")
    
    # ממשיך בשרשרת
    clear_chain_predictions(db, next_prediction)

def create_next_stage_predictions(db, prediction):
    """
    יוצר ניחושים לשלב הבא אם צריך, לפי ה-winner_destination של הניחוש הנוכחי
    """
    from models.matches_template import MatchTemplate
    from models.user import User
    from models.results import KnockoutStageResult
    
    # מוצא את התבנית של הניחוש הנוכחי
    current_template = db.query(MatchTemplate).filter(
        MatchTemplate.id == prediction.template_match_id
    ).first()
    
    if not current_template or not current_template.winner_destination:
        return  # אין destination, לא צריך ליצור ניחושים לשלב הבא
    
    # מפרסר את ה-destination (למשל "90_1" -> match_id=90, position=1)
    try:
        dest_parts = current_template.winner_destination.split('_')
        next_match_id = int(dest_parts[0])
        position = int(dest_parts[1])
    except:
        print(f"לא ניתן לפרסר destination: {current_template.winner_destination}")
        return
    
    # מוצא את התבנית של המשחק הבא
    next_template = db.query(MatchTemplate).filter(
        MatchTemplate.id == next_match_id
    ).first()
    
    if not next_template:
        print(f"לא נמצא template למשחק {next_match_id}")
        return
    
    # בדוק אם כבר יש ניחוש למשחק הבא
    from models.predictions import KnockoutStagePrediction
    existing_prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.template_match_id == next_match_id
    ).first()
    
    if existing_prediction:
        # עדכן את הקבוצה המתאימה
        if position == 1:
            existing_prediction.team1_id = prediction.winner_team_id
        elif position == 2:
            existing_prediction.team2_id = prediction.winner_team_id
        
        print(f"עודכן ניחוש {existing_prediction.id}: קבוצה {position} = {prediction.winner_team_id}")
    else:
        # יוצר ניחוש חדש למשחק הבא
        user = db.query(User).first()
        if not user:
            return
        
        # מוצא את ה-result המתאים
        result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        if not result:
            print(f"לא נמצא result למשחק {next_match_id}")
            return
        
        # יוצר ניחוש חדש
        new_prediction = KnockoutStagePrediction(
            user_id=user.id,
            knockout_result_id=result.id,
            template_match_id=next_match_id,
            team1_id=prediction.winner_team_id if position == 1 else None,
            team2_id=prediction.winner_team_id if position == 2 else None,
            winner_team_id=None
        )
        
        db.add(new_prediction)
        print(f"נוצר ניחוש חדש {next_match_id}: קבוצה {position} = {prediction.winner_team_id}")
    
    db.commit()

@router.get("/knockout/predictions/{prediction_id}")
def get_knockout_prediction(prediction_id: int, db: Session = Depends(get_db)):
    """
    מביא ניחוש נוקאאוט ספציפי לפי ID
    """
    try:
        from models.predictions import KnockoutStagePrediction
        from models.matches_template import MatchTemplate
        from models.team import Team
        
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.id == prediction_id
        ).first()
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="ניחוש לא נמצא"
            )
        
        # מוצא את התבנית
        template = db.query(MatchTemplate).filter(
            MatchTemplate.id == prediction.template_match_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=404,
                detail="תבנית משחק לא נמצאה"
            )
        
        # מוצא את שמות הקבוצות - עכשיו פשוט יותר!
        team1_name = prediction.team1.name if prediction.team1 else "קבוצה 1"
        team2_name = prediction.team2.name if prediction.team2 else "קבוצה 2"
        winner_team_name = prediction.winner_team.name if prediction.winner_team else None
        
        return {
            "success": True,
            "prediction": {
                "id": prediction.id,
                "match_id": prediction.template_match_id,
                "template": f"{template.team_1} vs {template.team_2}",
                "home_team": team1_name,
                "away_team": team2_name,
                "display": f"{team1_name} vs {team2_name}",
                "winner_team_id": prediction.winner_team_id,
                "winner_team_name": winner_team_name,
                "created_at": prediction.created_at,
                "updated_at": prediction.updated_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה בקבלת הניחוש: {str(e)}"
        )

@router.put("/knockout/predictions/{prediction_id}")
def update_knockout_prediction(
    prediction_id: int, 
    request: UpdatePredictionRequest, 
    db: Session = Depends(get_db)
):
    """
    מעדכן ניחוש נוקאאוט - בוחר קבוצה מנצחת ומעדכן את ה-destination
    """
    try:
        from models.predictions import KnockoutStagePrediction
        from models.matches_template import MatchTemplate
        from models.team import Team
        from datetime import datetime
        
        # מוצא את הניחוש
        prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.id == prediction_id
        ).first()
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="ניחוש לא נמצא"
            )
        
        # מוצא את התבנית
        template = db.query(MatchTemplate).filter(
            MatchTemplate.id == prediction.template_match_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=404,
                detail="תבנית משחק לא נמצאה"
            )
        
        # מוצא את ID הקבוצה המנצחת - עכשיו פשוט יותר!
        winner_team_id = None
        if request.winner_team_number == 1:
            winner_team_id = prediction.team1_id
        elif request.winner_team_number == 2:
            winner_team_id = prediction.team2_id
        else:
            raise HTTPException(
                status_code=400,
                detail="מספר קבוצה לא תקין (חייב להיות 1 או 2)"
            )
        
        if not winner_team_id:
            raise HTTPException(
                status_code=400,
                detail="לא ניתן למצוא את ID הקבוצה המנצחת"
            )
        
        # מעדכן את הניחוש
        prediction.winner_team_id = winner_team_id
        prediction.updated_at = datetime.utcnow()
        
        # מוחק את השרשרת הקודמת
        clear_chain_predictions(db, prediction)
        
        # שומר את השינויים
        db.commit()
        
        # יוצר ניחושים לשלב הבא אם צריך
        create_next_stage_predictions(db, prediction)
        
        # מוצא את שם הקבוצה המנצחת
        winner_team = db.query(Team).filter(Team.id == winner_team_id).first()
        winner_team_name = winner_team.name if winner_team else request.winner_team_name
        
        return {
            "success": True,
            "message": f"ניחוש עודכן בהצלחה: {winner_team_name} נבחרה כמנצחת",
            "prediction": {
                "id": prediction.id,
                "winner_team_id": winner_team_id,
                "winner_team_name": winner_team_name,
                "updated_at": prediction.updated_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה בעדכון הניחוש: {str(e)}"
        )
