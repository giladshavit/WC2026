from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models.user import User
from models.matches import Match
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.groups import Group
from models.team import Team
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult
from fastapi import HTTPException
from datetime import datetime
import json
from enum import Enum

class PredictionStatus(Enum):
    PREDICTED = "predicted"  # המשתמש ניחש והניחוש תקין
    MIGHT_CHANGE_PREDICT = "might_change_predict"  # הקבוצות השתנו, אולי המשתמש ירצה לבחון מחדש
    MUST_CHANGE_PREDICT = "must_change_predict"  # חייב לקבוע את המנצחת כי הניחוש לא תקין/אין ניחוש

class PredictionService:
    
    @staticmethod
    def set_status(prediction, status: PredictionStatus):
        """
        מעדכן את הסטטוס של ניחוש נוקאאוט
        """
        prediction.status = status.value
        prediction.updated_at = datetime.utcnow()
    
    @staticmethod
    def get_match_prediction(db: Session, user_id: int, match_id: int) -> Dict[str, Any]:
        """
        מביא חיזוי למשחק ספציפי
        """
        prediction = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
        
        if not prediction:
            return None
        
        return {
            "id": prediction.id,
            "user_id": prediction.user_id,
            "match_id": prediction.match_id,
            "home_score": prediction.home_score,
            "away_score": prediction.away_score,
            "predicted_winner": prediction.predicted_winner
        }
    
    @staticmethod
    def get_user_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        מביא את כל הניחושים של המשתמש
        """
        # מביא את פרטי המשתמש
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # מביא את כל ניחושי המשחקים עם relationships
        match_predictions = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id
        ).all()
        
        # מביא את כל ניחושי הבתים
        group_predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        # מביא את כל ניחושי מקומות 3
        third_place_predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        
        # מביא את כל ניחושי הנוקאאוט
        knockout_predictions = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).all()
        
        # ממיר למילון עם פרטי משחקים - עכשיו עם relationships ישירים
        match_predictions_with_details = []
        for pred in match_predictions:
            # עכשיו יש לנו relationship ישיר למשחק
            match = pred.match
            
            if not match:
                continue  # דלג אם לא נמצא המשחק
            
            match_details = {
                "id": match.id,
                "stage": match.stage,
                "home_team": {
                    "id": match.home_team.id,
                    "name": match.home_team.name,
                },
                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name,
                },
                "date": match.date.isoformat(),
                "status": match.status
            }
            
            # מוסיף פרטים ספציפיים לפי סוג המשחק
            if match.is_group_stage:
                match_details["group"] = match.group
            elif match.is_knockout:
                match_details["match_number"] = match.match_number
                match_details["home_team_source"] = match.home_team_source
                match_details["away_team_source"] = match.away_team_source
            
            # מוסיף תוצאה אמיתית אם המשחק הסתיים
            actual_result = None
            if match.status == "finished":
                # TODO: כאן נצטרך להוסיף טבלת תוצאות אמיתיות
                # כרגע נחזיר None
                actual_result = None
            
            match_predictions_with_details.append({
                "id": pred.id,
                "match": match_details,
                "home_score": pred.home_score,
                "away_score": pred.away_score,
                "predicted_winner": pred.predicted_winner,
                "actual_result": actual_result,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            })
        
        # ממיר למילון
        return {
            "user": {
                "id": user.id,
                "name": user.name,
                "total_points": user.total_points
            },
            "match_predictions": match_predictions_with_details,
            "group_predictions": [{
                "id": pred.id,
                "group_id": pred.group_id,
                "first_place": pred.first_place,
                "second_place": pred.second_place,
                "third_place": pred.third_place,
                "fourth_place": pred.fourth_place,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in group_predictions],
            "third_place_predictions": [{
                "id": pred.id,
                "advancing_team_ids": [
                    pred.first_team_qualifying,
                    pred.second_team_qualifying,
                    pred.third_team_qualifying,
                    pred.fourth_team_qualifying,
                    pred.fifth_team_qualifying,
                    pred.sixth_team_qualifying,
                    pred.seventh_team_qualifying,
                    pred.eighth_team_qualifying
                ],
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in third_place_predictions],
            "knockout_predictions": [{
                "id": pred.id,
                "stage": pred.stage,
                "knockout_match_id": pred.knockout_match_id,
                "winner_team_id": pred.winner_team_id,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in knockout_predictions]
        }
    
    @staticmethod
    def create_or_update_match_prediction(db: Session, user_id: int, match_id: int, home_score: int, away_score: int) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש למשחק בודד
        """
        # מביא את פרטי המשחק כדי לקבוע את המנצח
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return {"error": "Match not found"}
        
        # קובע את המנצח לפי התוצאה
        predicted_winner = None
        if home_score > away_score:
            predicted_winner = match.home_team_id
        elif away_score > home_score:
            predicted_winner = match.away_team_id
        # אם תיקו, predicted_winner נשאר None
        
        # בודק אם יש כבר ניחוש למשחק הזה
        existing_prediction = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.home_score = home_score
            existing_prediction.away_score = away_score
            existing_prediction.predicted_winner = predicted_winner
            # updated_at מתעדכן אוטומטית
            db.commit()
            
            return {
                "id": existing_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
                "predicted_winner": predicted_winner,
                "updated": True
            }
        else:
            # יוצר ניחוש חדש
            new_prediction = MatchPrediction(
                user_id=user_id,
                match_id=match_id,
                home_score=home_score,
                away_score=away_score,
                predicted_winner=predicted_winner
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
                "predicted_winner": predicted_winner,
                "updated": False
            }

    @staticmethod
    def create_or_update_batch_predictions(db: Session, user_id: int, predictions: List[Dict]) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחושים מרובים
        """
        results = []
        
        for prediction_data in predictions:
            match_id = prediction_data.get("match_id")
            home_score = prediction_data.get("home_score")
            away_score = prediction_data.get("away_score")
            
            if not all([match_id, home_score is not None, away_score is not None]):
                return {"error": f"Missing data for match {match_id}"}
            
            # משתמש בפונקציה הקיימת לכל ניחוש
            result = PredictionService.create_or_update_match_prediction(
                db, user_id, match_id, home_score, away_score
            )
            results.append(result)
        
        return {
            "predictions": results,
            "total_updated": len([r for r in results if r.get("updated")]),
            "total_created": len([r for r in results if not r.get("updated")])
        }
    
    @staticmethod
    def create_or_update_group_prediction(db: Session, user_id: int, group_id: int, first_place: int, second_place: int, third_place: int, fourth_place: int) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש לבית
        first_place, second_place, third_place, fourth_place: team IDs למקומות השונים
        """
        # בודק אם יש כבר ניחוש לבית הזה
        existing_prediction = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id,
            GroupStagePrediction.group_id == group_id
        ).first()
        
        # בודק אם המקום השלישי השתנה
        third_place_changed = False
        old_third_place = None
        if existing_prediction and existing_prediction.third_place != third_place:
            third_place_changed = True
            old_third_place = existing_prediction.third_place
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.first_place = first_place
            existing_prediction.second_place = second_place
            existing_prediction.third_place = third_place
            existing_prediction.fourth_place = fourth_place
            db.commit()
            
            # אם המקום השלישי השתנה, מעדכן את חיזויי העולות
            if third_place_changed:
                # מביא את חיזויי העולות הקיימים
                third_place_prediction = db.query(ThirdPlacePrediction).filter(
                    ThirdPlacePrediction.user_id == user_id
                ).first()
                
                if third_place_prediction:
                    # בודק אם הקבוצה הישנה במקום 3 נבחרה
                    old_team_selected = False
                    new_team_selected = False
                    
                    # בודק אם הקבוצה החדשה כבר נבחרה
                    for i in range(1, 9):  # first_team_qualifying עד eighth_team_qualifying
                        team_field = getattr(third_place_prediction, f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i-1]}_team_qualifying")
                        if team_field == old_third_place:
                            old_team_selected = True
                            # מחליף את הקבוצה הישנה בחדשה
                            setattr(third_place_prediction, f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i-1]}_team_qualifying", third_place)
                            break
                        elif team_field == third_place:
                            new_team_selected = True
                    
                    # אם הקבוצה החדשה כבר נבחרה והקבוצה הישנה גם נבחרה - מחליף ביניהם
                    if new_team_selected and old_team_selected:
                        # מוצא את המיקום של הקבוצה החדשה ומחליף אותה בקבוצה הישנה
                        for i in range(1, 9):
                            team_field = getattr(third_place_prediction, f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i-1]}_team_qualifying")
                            if team_field == third_place:
                                setattr(third_place_prediction, f"{['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i-1]}_team_qualifying", old_third_place)
                                break
                    
                    db.commit()
            
            return {
                "id": existing_prediction.id,
                "group_id": group_id,
                "first_place": first_place,
                "second_place": second_place,
                "third_place": third_place,
                "fourth_place": fourth_place,
                "updated": True,
                "third_place_changed": third_place_changed
            }
        else:
            # יוצר ניחוש חדש
            new_prediction = GroupStagePrediction(
                user_id=user_id,
                group_id=group_id,
                first_place=first_place,
                second_place=second_place,
                third_place=third_place,
                fourth_place=fourth_place
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            # אם זה ניחוש חדש, מוחק את חיזויי העולות הקיימים
            db.query(ThirdPlacePrediction).filter(
                ThirdPlacePrediction.user_id == user_id
            ).delete()
            db.commit()
            
            return {
                "id": new_prediction.id,
                "group_id": group_id,
                "first_place": first_place,
                "second_place": second_place,
                "third_place": third_place,
                "fourth_place": fourth_place,
                "updated": False,
                "third_place_changed": True
            }
    
    @staticmethod
    def get_group_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את כל ניחושי הבתים של המשתמש
        """
        predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        return [{
            "id": pred.id,
            "group_id": pred.group_id,
            "first_place": pred.first_place,
            "second_place": pred.second_place,
            "third_place": pred.third_place,
            "fourth_place": pred.fourth_place,
            "created_at": pred.created_at.isoformat(),
            "updated_at": pred.updated_at.isoformat()
        } for pred in predictions]
    
    @staticmethod
    def create_or_update_third_place_prediction(db: Session, user_id: int, advancing_team_ids: List[int]) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש למקומות 3
        advancing_team_ids: רשימה של 8 team IDs שיעלו
        """
        # בודק אם יש כבר ניחוש למקומות 3
        existing_prediction = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()
        
        if len(advancing_team_ids) != 8:
            return {"error": "Must provide exactly 8 team IDs"}
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.first_team_qualifying = advancing_team_ids[0]
            existing_prediction.second_team_qualifying = advancing_team_ids[1]
            existing_prediction.third_team_qualifying = advancing_team_ids[2]
            existing_prediction.fourth_team_qualifying = advancing_team_ids[3]
            existing_prediction.fifth_team_qualifying = advancing_team_ids[4]
            existing_prediction.sixth_team_qualifying = advancing_team_ids[5]
            existing_prediction.seventh_team_qualifying = advancing_team_ids[6]
            existing_prediction.eighth_team_qualifying = advancing_team_ids[7]
            db.commit()
            
            return {
                "id": existing_prediction.id,
                "advancing_team_ids": advancing_team_ids,
                "updated": True
            }
        else:
            # יוצר ניחוש חדש
            new_prediction = ThirdPlacePrediction(
                user_id=user_id,
                first_team_qualifying=advancing_team_ids[0],
                second_team_qualifying=advancing_team_ids[1],
                third_team_qualifying=advancing_team_ids[2],
                fourth_team_qualifying=advancing_team_ids[3],
                fifth_team_qualifying=advancing_team_ids[4],
                sixth_team_qualifying=advancing_team_ids[5],
                seventh_team_qualifying=advancing_team_ids[6],
                eighth_team_qualifying=advancing_team_ids[7]
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "advancing_team_ids": advancing_team_ids,
                "updated": False
            }
    
    @staticmethod
    def get_third_place_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את ניחושי המקומות 3 של המשתמש
        """
        predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        
        return [{
            "id": pred.id,
            "advancing_team_ids": [
                pred.first_team_qualifying,
                pred.second_team_qualifying,
                pred.third_team_qualifying,
                pred.fourth_team_qualifying,
                pred.fifth_team_qualifying,
                pred.sixth_team_qualifying,
                pred.seventh_team_qualifying,
                pred.eighth_team_qualifying
            ],
            "created_at": pred.created_at.isoformat(),
            "updated_at": pred.updated_at.isoformat()
        } for pred in predictions]
    
    @staticmethod
    def get_third_place_eligible_teams(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את 12 הקבוצות שמגיעות ממקום 3 לפי ניחושי הבתים של המשתמש
        """
        # מביא את כל ניחושי הבתים של המשתמש
        group_predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        if len(group_predictions) != 12:
            return {"error": "User must predict all 12 groups first"}
        
        third_place_teams = []
        
        for pred in group_predictions:
            third_place_team_id = pred.third_place  # מיקום 3
            
            # מביא את פרטי הקבוצה
            team = db.query(Team).filter(Team.id == third_place_team_id).first()
            if team:
                # מביא את שם הבית
                group = db.query(Group).filter(Group.id == pred.group_id).first()
                group_name = group.name if group else f"בית {pred.group_id}"
                
                third_place_teams.append({
                    "id": team.id,
                    "name": team.name,
                    "group_id": pred.group_id,
                    "group_name": group_name
                })
        
        return third_place_teams
    
    @staticmethod
    def create_or_update_batch_group_predictions(db: Session, user_id: int, predictions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחושי בתים מרובים
        """
        try:
            saved_predictions = []
            errors = []
            
            for prediction_data in predictions_data:
                group_id = prediction_data.get("group_id")
                first_place = prediction_data.get("first_place")
                second_place = prediction_data.get("second_place")
                third_place = prediction_data.get("third_place")
                fourth_place = prediction_data.get("fourth_place")
                
                if not all([group_id, first_place, second_place, third_place, fourth_place]):
                    errors.append(f"Missing data for group {group_id}")
                    continue
                
                # שמירת הניחוש
                result = PredictionService.create_or_update_group_prediction(
                    db, user_id, group_id, first_place, second_place, third_place, fourth_place
                )
                
                if "error" in result:
                    errors.append(f"Error saving group {group_id}: {result['error']}")
                else:
                    saved_predictions.append(result)
            
            return {
                "saved_predictions": saved_predictions,
                "errors": errors,
                "total_saved": len(saved_predictions),
                "total_errors": len(errors),
                "success": len(errors) == 0
            }
            
        except Exception as e:
            return {"error": f"Batch save failed: {str(e)}"}

    @staticmethod
    def get_knockout_predictions(db: Session, user_id: int, stage: str = None) -> List[Dict[str, Any]]:
        """
        מביא את כל ניחושי הנוקאאוט של המשתמש
        אם stage מוגדר, מסנן לפי השלב
        """
        try:
            # בונה את השאילתה הבסיסית
            query = db.query(KnockoutStagePrediction).filter(
                KnockoutStagePrediction.user_id == user_id
            )
            
            # אם stage מוגדר, מוסיף סינון
            if stage:
                query = query.filter(KnockoutStagePrediction.stage == stage)
            
            # מביא את הניחושים
            predictions = query.all()
            
            # ממיר לרשימה של dictionaries
            result = []
            for prediction in predictions:
                result.append({
                    "id": prediction.id,
                    "user_id": prediction.user_id,
                    "knockout_result_id": prediction.knockout_result_id,
                    "template_match_id": prediction.template_match_id,
                    "stage": prediction.stage,
                    "team1_id": prediction.team1_id,
                    "team2_id": prediction.team2_id,
                    "winner_team_id": prediction.winner_team_id,
                    "status": prediction.status,
                    "created_at": prediction.created_at,
                    "updated_at": prediction.updated_at,
                    # הוספת שמות הקבוצות אם קיימות
                    "team1_name": prediction.team1.name if prediction.team1 else None,
                    "team2_name": prediction.team2.name if prediction.team2 else None,
                    "winner_team_name": prediction.winner_team.name if prediction.winner_team else None
                })
            
            return result
            
        except Exception as e:
            raise Exception(f"שגיאה בקבלת ניחושי הנוקאאוט: {str(e)}")

    @staticmethod
    def update_knockout_prediction_with_winner(db: Session, prediction, winner_team_id: Optional[int] = None):
        """
        פונקציה פנימית לעדכון ניחוש נוקאאוט עם מנצחת חדשה
        
        Args:
            db: Session
            prediction: הניחוש לעדכון
            winner_team_id: ID של הקבוצה המנצחת (אופציונלי - יכול להיות None)
        """
        # 1. בדיקה אם צריך ליצור ניחוש חדש לשלב הבא
        template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        next_prediction = PredictionService.create_next_stage_if_needed(db, prediction, template)
        
        # 2. בדיקה אם המנצחת השתנתה
        if prediction.winner_team_id == winner_team_id and winner_team_id is not None:
            PredictionService.set_status(prediction, PredictionStatus.PREDICTED)
            db.commit()
            return PredictionService.create_success_response(db, prediction, "המנצחת לא השתנתה")
        
        # 3. עדכון המנצחת
        previous_winner_id = prediction.winner_team_id
        prediction.winner_team_id = winner_team_id
        prediction.updated_at = datetime.utcnow()
        
        # 4. עדכון סטטוס
        PredictionService.set_status(prediction, PredictionStatus.PREDICTED if winner_team_id else PredictionStatus.MUST_CHANGE_PREDICT)
        
        # 5. עדכון השלבים הבאים
        if next_prediction:
            PredictionService.update_next_stages(db, prediction, previous_winner_id)
        
        # 6. שמירה
        db.commit()
        
        return PredictionService.create_success_response(db, prediction, "ניחוש עודכן בהצלחה")


    @staticmethod
    def update_knockout_prediction_winner(db: Session, prediction_id: int, request) -> Dict[str, Any]:
        """
        מעדכן ניחוש נוקאאוט - בוחר קבוצה מנצחת ומעדכן את השלבים הבאים
        """
        try:
            # 1. אימות וטעינת נתונים
            prediction = PredictionService.get_knockout_prediction_by_id(db, prediction_id)
            winner_team_id = PredictionService.get_winner_team_id(prediction, request.winner_team_number)
            
            if not winner_team_id:
                raise HTTPException(
                    status_code=400,
                    detail="לא ניתן למצוא את ID הקבוצה המנצחת"
                )
            
            # 2. קורא לפונקציה הפנימית
            result = PredictionService.update_knockout_prediction_with_winner(db, prediction, winner_team_id)
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"שגיאה בעדכון הניחוש: {str(e)}"
            )
    @staticmethod
    def get_knockout_prediction_by_id(db: Session, prediction_id: int):
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

    @staticmethod
    def get_template_by_id(db: Session, template_id: int):
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

    @staticmethod
    def get_winner_team_id(prediction, winner_team_number: int):
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

    @staticmethod
    def create_success_response(db: Session, prediction, message: str, request=None):
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

    @staticmethod
    def update_next_stages(db: Session, prediction, previous_winner_id):
        """
        מעדכן את השלבים הבאים:
        1. משבץ את המנצחת החדשה במשחק הבא
        2. מסיר את המנצחת הקודמת מכל השלבים הבאים
        """
        # מוצא את הניחוש הבא ואת המיקום
        next_prediction, position = PredictionService.find_next_knockout_prediction_and_position(db, prediction)
        
        # 1. עדכון המשחק הבא עם המנצחת החדשה
        PredictionService.update_next_stage_prediction(db, prediction, next_prediction, position)
        
        # 2. הסרת המנצחת הקודמת מכל השלבים הבאים
        if previous_winner_id and next_prediction:
            PredictionService.remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)

    @staticmethod
    def find_next_knockout_prediction_and_position(db: Session, prediction):
        """
        מוצא את הניחוש הבא בשרשרת הנוקאאוט ואת המיקום שלו
        מחזיר: tuple (next_prediction, position) או (None, None) אם לא נמצא
        """
        # מוצא את התבנית של הניחוש הנוכחי
        current_template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None, None  # אין destination
        
        # משתמש בשדות החדשים
        next_match_id = current_template.winner_next_knockout_match
        position = current_template.winner_next_position
        
        # מוצא את הניחוש הבא
        next_prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == next_match_id,
            KnockoutStagePrediction.user_id == prediction.user_id
        ).first()
        
        return next_prediction, position

    @staticmethod
    def create_next_stage_if_needed(db: Session, prediction, template):
        """
        בודק אם צריך ליצור ניחוש חדש לשלב הבא ויוצר אותו אם נדרש
        מחזיר: KnockoutStagePrediction או None
        """
        if not template.winner_next_knockout_match:
            return None
        
        # משתמש בשדות החדשים
        next_match_id = template.winner_next_knockout_match
        
        # בודק אם קיים ניחוש למשחק הבא
        existing_next_prediction = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.template_match_id == next_match_id,
            KnockoutStagePrediction.user_id == prediction.user_id
        ).first()
        
        if existing_next_prediction:
            return existing_next_prediction
        
        # צריך ליצור ניחוש חדש לשלב הבא
        next_prediction = PredictionService.create_next_stage_prediction(db, prediction, next_match_id)
        if next_prediction:
            print(f"נוצר ניחוש חדש לשלב הבא: {next_prediction.id}")
        return next_prediction

    @staticmethod
    def create_next_stage_prediction(db: Session, prediction, next_match_id):
        """
        יוצר ניחוש חדש לשלב הבא בשרשרת הנוקאאוט
        """
        # מוצא את ה-result המתאים
        result = db.query(KnockoutStageResult).filter(
            KnockoutStageResult.match_id == next_match_id
        ).first()
        
        if not result:
            print(f"לא נמצא KnockoutStageResult עבור match_id {next_match_id}")
            return None
        
        # מוצא את התבנית של השלב הבא
        next_template = db.query(MatchTemplate).filter(
            MatchTemplate.id == next_match_id
        ).first()
        
        if not next_template:
            print(f"לא נמצא MatchTemplate עבור match_id {next_match_id}")
            return None
        
        # יוצר ניחוש חדש
        new_prediction = KnockoutStagePrediction(
            user_id=prediction.user_id,
            knockout_result_id=result.id,
            template_match_id=next_match_id,
            stage=next_template.stage,
            winner_team_id=None
        )
        
        db.add(new_prediction)
        db.flush()  # כדי לקבל את ה-ID
        
        # מעדכן סטטוס ל-MUST_CHANGE_PREDICT
        PredictionService.set_status(new_prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        return new_prediction

    @staticmethod
    def get_next_knockout_position(db: Session, prediction):
        """
        מוצא את המיקום (position) של הניחוש הנוכחי בשרשרת הנוקאאוט
        מחזיר: int (1 או 2) או None אם לא נמצא
        """
        # מוצא את התבנית של הניחוש הנוכחי
        current_template = PredictionService.get_template_by_id(db, prediction.template_match_id)
        
        if not current_template or not current_template.winner_next_knockout_match:
            return None  # אין destination
        
        # משתמש בשדה החדש
        return current_template.winner_next_position

    @staticmethod
    def remove_prev_winner_from_next_stages(db: Session, prediction, previous_winner_id):
        """
        מסיר את הקבוצה המנצחת הקודמת מכל השלבים הבאים בשרשרת
        """
        if not previous_winner_id or not prediction:
            return
        
        # בדיקה: אם המנצחת הנוכחית שונה מהקבוצה שצריך למחוק - לא עושים כלום
        if prediction.winner_team_id and prediction.winner_team_id != previous_winner_id:
            # עדכון סטטוס ל-MIGHT_CHANGE_PREDICT
            PredictionService.set_status(prediction, PredictionStatus.MIGHT_CHANGE_PREDICT)
            return
        
        # מוחק את המנצחת
        prediction.winner_team_id = None
        print(f"נמחקה מנצחת {previous_winner_id} מניחוש {prediction.id}")
        
        # עדכון סטטוס ל-MUST_CHANGE_PREDICT
        PredictionService.set_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
        
        # מוצא את הניחוש הבא בשרשרת
        next_prediction, next_position = PredictionService.find_next_knockout_prediction_and_position(db, prediction)
        
        if next_prediction and next_position:
            # קורא לפונקציה update_next_stage_prediction
            PredictionService.update_next_stage_prediction(db, prediction, next_prediction, next_position)
        
        # קורא לפונקציה שוב עם הניחוש הבא
        if next_prediction:
            PredictionService.remove_prev_winner_from_next_stages(db, next_prediction, previous_winner_id)

    @staticmethod
    def update_next_stage_prediction(db: Session, prediction, next_prediction, position):
        """
        מעדכן את הניחוש הבא בשרשרת הנוקאאוט עם המנצחת החדשה
        """
        if not next_prediction or not position:
            return  # אין destination או לא נמצא template או אין position
        
        # עדכן את הקבוצה המתאימה
        if position == 1:
            next_prediction.team1_id = prediction.winner_team_id
        elif position == 2:
            next_prediction.team2_id = prediction.winner_team_id
        
        print(f"עודכן ניחוש {next_prediction.id} - position {position} עם קבוצה {prediction.winner_team_id}")

    @staticmethod
    def update_knockout_prediction_teams(db: Session, prediction, old_team_id: int, new_team_id: int):
        """
        פונקציה תשתיתית לעדכון ניחוש נוקאאוט - מחליפה קבוצה ומעדכנת את השלבים הבאים
        
        Args:
            db: Session
            prediction: הניחוש לעדכון
            old_team_id: ID של הקבוצה הישנה
            new_team_id: ID של הקבוצה החדשה
        """
        # מבצע את החילוף
        if prediction.team1_id == old_team_id:
            prediction.team1_id = new_team_id
        elif prediction.team2_id == old_team_id:
            prediction.team2_id = new_team_id
        else:
            # הקבוצה הישנה לא נמצאה בניחוש
            return
        
        # בודק אם המנצחת היא הקבוצה הקודמת
        if prediction.winner_team_id == old_team_id:
            # קורא לפונקציה update_knockout_prediction_with_winner עם winner_team_id שהוא None
            return PredictionService.update_knockout_prediction_with_winner(db, prediction, None)
        else:
            # המנצחת לא השתנתה, אבל הקבוצות השתנו
            # אם המנצחת היא None, מעדכן סטטוס לאדום
            if prediction.winner_team_id is None:
                PredictionService.set_status(prediction, PredictionStatus.MUST_CHANGE_PREDICT)
                db.commit()