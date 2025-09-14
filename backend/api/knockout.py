from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
import subprocess
import sys
import os
from datetime import datetime

from database import get_db
from models.predictions import KnockoutStagePrediction, GroupStagePrediction, ThirdPlacePrediction
from models.matches_template import MatchTemplate
from models.team import Team
from models.third_place_combinations import ThirdPlaceCombination
from models.user import User
from models.results import KnockoutStageResult

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
            template = get_template_by_id(pred.template_match_id, db)
            
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


def create_predictions_for_stage(db, stage, templates):
    """
    יוצר ניחושים לשלב מסוים לפי הניחושים הקיימים מהשלב הקודם
    """
    
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
    
    # מוצא את הניחוש של המשחק הקודם
    previous_prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.template_match_id == match_id
    ).first()
    
    if previous_prediction and previous_prediction.winner_team_id:
        print(f"מצא מנצחת למשחק {match_id}: {previous_prediction.winner_team_id}")
        return previous_prediction.winner_team_id
    
    print(f"לא נמצא מנצחת למשחק {match_id}")
    return None

def find_next_knockout_prediction(db, prediction):
    """
    מוצא את הניחוש הבא בשרשרת הנוקאאוט
    מחזיר: KnockoutStagePrediction או None אם לא נמצא
    """
    # מוצא את התבנית של הניחוש הנוכחי
    current_template = get_template_by_id(prediction.template_match_id, db)
    
    if not current_template or not current_template.winner_destination:
        return None  # אין destination
    
    # מפרסר את ה-destination
    try:
        dest_parts = current_template.winner_destination.split('_')
        next_match_id = int(dest_parts[0])
    except:
        return None
    
    # מוצא את הניחוש הבא
    next_prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.template_match_id == next_match_id
    ).first()
    
    return next_prediction

def get_next_knockout_position(db, prediction):
    """
    מוצא את המיקום (position) של הניחוש הבא בשרשרת הנוקאאוט
    מחזיר: int (1 או 2) או None אם לא נמצא
    """
    # מוצא את התבנית של הניחוש הנוכחי
    current_template = get_template_by_id(prediction.template_match_id, db)
    
    if not current_template or not current_template.winner_destination:
        return None  # אין destination
    
    # מפרסר את ה-destination
    try:
        dest_parts = current_template.winner_destination.split('_')
        position = int(dest_parts[1])
        return position
    except:
        return None

def remove_prev_winner_from_next_stages(db, prediction, previous_winner_id):
    """
    מסיר את הקבוצה המנצחת הקודמת מכל השלבים הבאים בשרשרת
    """
    
    if not previous_winner_id:
        return
    
    # מוצא את הניחוש הבא
    next_prediction = find_next_knockout_prediction(db, prediction)
    
    if not next_prediction:
        return  # אין ניחוש למחוק
    
    # מוצא את המיקום
    position = get_next_knockout_position(db, prediction)
    
    if not position:
        return  # אין position
    
    # בודק אם הקבוצה המנצחת הקודמת מופיעה בניחוש הבא
    team_removed = False
    
    if position == 1 and next_prediction.team1_id == previous_winner_id:
        # הקבוצה המנצחת הקודמת מופיעה בניחוש הבא - מוחק אותה
        next_prediction.team1_id = None
        team_removed = True
        print(f"נמחקה קבוצה {previous_winner_id} מניחוש {next_prediction.id} (position 1)")
    elif position == 2 and next_prediction.team2_id == previous_winner_id:
        # הקבוצה המנצחת הקודמת מופיעה בניחוש הבא - מוחק אותה
        next_prediction.team2_id = None
        team_removed = True
        print(f"נמחקה קבוצה {previous_winner_id} מניחוש {next_prediction.id} (position 2)")
    
    # מוחק גם את המנצחת אם היא הקבוצה שמחקנו
    if next_prediction.winner_team_id == previous_winner_id:
        next_prediction.winner_team_id = None
        print(f"נמחקה מנצחת {previous_winner_id} מניחוש {next_prediction.id}")
    
    # אם שתי הקבוצות נמחקו, מוחק את כל הניחוש
    if not next_prediction.team1_id and not next_prediction.team2_id:
        db.delete(next_prediction)
        print(f"נמחק ניחוש {next_prediction.id} (אין קבוצות)")
        return  # לא צריך להמשיך כי הניחוש נמחק
    
    # ממשיך בשרשרת רק אם הסרנו קבוצה או אם יש עדיין קבוצות בניחוש
    if team_removed or (next_prediction.team1_id or next_prediction.team2_id):
        remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)

def update_next_stage_prediction(db, prediction):
    """
    יוצר ניחושים לשלב הבא אם צריך, לפי ה-winner_destination של הניחוש הנוכחי
    """
    
    # מוצא את הניחוש הבא
    existing_prediction = find_next_knockout_prediction(db, prediction)
    
    if not existing_prediction:
        return  # אין destination או לא נמצא template
    
    # מוצא את המיקום
    position = get_next_knockout_position(db, prediction)
    
    if not position:
        return  # אין position
    
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
        
        # מוצא את ה-match_id הבא
        current_template = get_template_by_id(prediction.template_match_id, db)
        dest_parts = current_template.winner_destination.split('_')
        next_match_id = int(dest_parts[0])
        
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
        
        prediction = get_knockout_prediction_by_id(prediction_id, db)
        
        # מוצא את התבנית
        template = get_template_by_id(prediction.template_match_id, db)
        
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

def get_winner_team_id(prediction, winner_team_number):
    """מחזיר את ID הקבוצה המנצחת לפי מספר הקבוצה"""
    if winner_team_number == 1:
        return prediction.team1_id
    elif winner_team_number == 2:
        return prediction.team2_id
    else:
        raise HTTPException(
            status_code=400,
            detail="מספר קבוצה לא תקין (חייב להיות 1 או 2)"
        )

def get_knockout_prediction_by_id(prediction_id, db):
    """מוצא ניחוש נוקאאוט לפי ID"""
    
    prediction = db.query(KnockoutStagePrediction).filter(
        KnockoutStagePrediction.id == prediction_id
    ).first()
    
    if not prediction:
        raise HTTPException(
            status_code=404,
            detail="ניחוש לא נמצא"
        )
    
    return prediction

def get_template_by_id(template_id, db):
    """מוצא תבנית משחק לפי ID"""
    
    template = db.query(MatchTemplate).filter(
        MatchTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail="תבנית משחק לא נמצאה"
        )
    
    return template

def create_success_response(prediction, message, db, request=None):
    """יוצר תגובת הצלחה"""
    
    # מוצא את שם הקבוצה המנצחת
    winner_team = None
    if prediction.winner_team_id:
        winner_team = db.query(Team).filter(Team.id == prediction.winner_team_id).first()
    
    winner_team_name = winner_team.name if winner_team else (request.winner_team_name if request else None)
    
    return {
        "success": True,
        "message": message,
        "prediction": {
            "id": prediction.id,
            "winner_team_id": prediction.winner_team_id,
            "winner_team_name": winner_team_name,
            "updated_at": prediction.updated_at
        }
    }

def update_next_stages(db, prediction, previous_winner_id):
    """
    מעדכן את השלבים הבאים:
    1. משבץ את המנצחת החדשה במשחק הבא
    2. מסיר את המנצחת הקודמת מכל השלבים הבאים
    """
    # 1. עדכון המשחק הבא עם המנצחת החדשה
    update_next_stage_prediction(db, prediction)
    
    # 2. הסרת המנצחת הקודמת מכל השלבים הבאים
    if previous_winner_id:
        remove_prev_winner_from_next_stages(db, prediction, previous_winner_id)

@router.put("/knockout/predictions/{prediction_id}")
def update_knockout_prediction(
    prediction_id: int, 
    request: UpdatePredictionRequest, 
    db: Session = Depends(get_db)
):
    """
    מעדכן ניחוש נוקאאוט - בוחר קבוצה מנצחת ומעדכן את השלבים הבאים
    """
    try:
        
        # 1. אימות וטעינת נתונים
        prediction = get_knockout_prediction_by_id(prediction_id, db)
        template = get_template_by_id(prediction.template_match_id, db)
        winner_team_id = get_winner_team_id(prediction, request.winner_team_number)
        
        if not winner_team_id:
            raise HTTPException(
                status_code=400,
                detail="לא ניתן למצוא את ID הקבוצה המנצחת"
            )
        
        # 2. בדיקה אם המנצחת השתנתה
        if prediction.winner_team_id == winner_team_id:
            print(f"המנצחת לא השתנתה: {winner_team_id}")
            return create_success_response(prediction, "המנצחת לא השתנתה", db, request)
        
        # 3. עדכון המנצחת
        previous_winner_id = prediction.winner_team_id
        prediction.winner_team_id = winner_team_id
        prediction.updated_at = datetime.utcnow()
        
        # 4. עדכון השלבים הבאים
        update_next_stages(db, prediction, previous_winner_id)
        
        # 5. שמירה והחזרת תגובה
        db.commit()
        return create_success_response(prediction, f"ניחוש עודכן בהצלחה", db, request)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה בעדכון הניחוש: {str(e)}"
        )
