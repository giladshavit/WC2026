from typing import Dict, List, Any
from sqlalchemy.orm import Session
from models.user import User
from models.matches import Match
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.groups import Group
from models.team import Team
import json

class PredictionService:
    
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