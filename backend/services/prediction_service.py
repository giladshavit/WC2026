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
                    "country_code": match.home_team.country_code
                },
                "away_team": {
                    "id": match.away_team.id,
                    "name": match.away_team.name,
                    "country_code": match.away_team.country_code
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
                "positions": json.loads(pred.positions),
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            } for pred in group_predictions],
            "third_place_predictions": [{
                "id": pred.id,
                "stage": pred.stage,
                "advancing_team_ids": json.loads(pred.advancing_team_ids),
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
    def create_or_update_group_prediction(db: Session, user_id: int, group_id: int, positions: List[int]) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש לבית
        positions: רשימה של 4 team IDs בסדר המקומות (1, 2, 3, 4)
        """
        # בודק אם יש כבר ניחוש לבית הזה
        existing_prediction = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id,
            GroupStagePrediction.group_id == group_id
        ).first()
        
        # ממיר ל-JSON string
        positions_json = json.dumps(positions)
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.positions = positions_json
            db.commit()
            
            return {
                "id": existing_prediction.id,
                "group_id": group_id,
                "positions": positions,
                "updated": True
            }
        else:
            # יוצר ניחוש חדש
            new_prediction = GroupStagePrediction(
                user_id=user_id,
                group_id=group_id,
                positions=positions_json
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "group_id": group_id,
                "positions": positions,
                "updated": False
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
            "positions": json.loads(pred.positions),
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
        
        # ממיר ל-JSON string
        advancing_team_ids_json = json.dumps(advancing_team_ids)
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.advancing_team_ids = advancing_team_ids_json
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
                advancing_team_ids=advancing_team_ids_json
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
            "stage": pred.stage,
            "advancing_team_ids": json.loads(pred.advancing_team_ids),
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
            positions = json.loads(pred.positions)
            if len(positions) >= 3:
                third_place_team_id = positions[2]  # מיקום 3 (אינדקס 2)
                
                # מביא את פרטי הקבוצה
                team = db.query(Team).filter(Team.id == third_place_team_id).first()
                if team:
                    third_place_teams.append({
                        "id": team.id,
                        "name": team.name,
                        "country_code": team.country_code,
                        "group_id": pred.group_id
                    })
        
        return third_place_teams