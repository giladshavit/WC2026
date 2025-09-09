from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import subprocess
import sys
import os

from database import get_db

router = APIRouter()

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
def get_knockout_predictions(db: Session = Depends(get_db)):
    """
    מביא את כל הניחושים של משחקי 32 הגדולות עם שמות הקבוצות האמיתיות
    """
    try:
        from models.predictions import KnockoutStagePrediction, GroupStagePrediction, ThirdPlacePrediction
        from models.matches_template import MatchTemplate
        from models.team import Team
        from models.third_place_combinations import ThirdPlaceCombination
        
        predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.stage == 'round32'
        ).all()
        
        result = []
        for pred in predictions:
            # מוצא את התבנית
            template = db.query(MatchTemplate).filter(
                MatchTemplate.id == pred.knockout_match_id
            ).first()
            
            if template:
                # מוצא את שמות הקבוצות האמיתיות
                home_team_name = get_team_name_for_template(db, template.team_1)
                away_team_name = get_team_name_for_template(db, template.team_2)
                
                result.append({
                    "id": pred.id,
                    "match_id": pred.knockout_match_id,
                    "template": f"{template.team_1} vs {template.team_2}",
                    "home_team": home_team_name,
                    "away_team": away_team_name,
                    "display": f"{home_team_name} vs {away_team_name}",
                    "winner_team_id": pred.winner_team_id,
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
