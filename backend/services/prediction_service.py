from typing import Dict, List, Any
from sqlalchemy.orm import Session
from models.user import User
from models.matches import GroupStageMatch, KnockoutMatch
from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
from models.groups import Group
from models.team import Team
import json

class PredictionService:
    
    @staticmethod
    def get_user_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        מביא את כל הניחושים של המשתמש
        """
        # מביא את פרטי המשתמש
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # מביא את כל ניחושי המשחקים
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
        
        # ממיר למילון עם פרטי משחקים
        match_predictions_with_details = []
        for pred in match_predictions:
            # מביא את פרטי המשחק
            match = db.query(GroupStageMatch).filter(GroupStageMatch.id == pred.match_id).first()
            if not match:
                # בודק אם זה משחק נוקאאוט
                match = db.query(KnockoutMatch).filter(KnockoutMatch.id == pred.match_id).first()
            
            match_details = {
                "id": match.id,
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
                "points": pred.points,
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
            "group_predictions": [
                {
                    "id": pred.id,
                    "group_id": pred.group_id,
                    "positions": pred.positions,  # JSON string
                    "points": pred.points,
                    "created_at": pred.created_at.isoformat(),
                    "updated_at": pred.updated_at.isoformat()
                }
                for pred in group_predictions
            ],
            "third_place_predictions": [
                {
                    "id": pred.id,
                    "advancing_team_ids": pred.advancing_team_ids,  # JSON string of 8 team IDs
                    "points": pred.points,
                    "created_at": pred.created_at.isoformat(),
                    "updated_at": pred.updated_at.isoformat()
                }
                for pred in third_place_predictions
            ],
            "knockout_predictions": [
                {
                    "id": pred.id,
                    "stage": pred.stage,
                    "knockout_match_id": pred.knockout_match_id,
                    "winner_team_id": pred.winner_team_id,
                    "points": pred.points,
                    "created_at": pred.created_at.isoformat(),
                    "updated_at": pred.updated_at.isoformat()
                }
                for pred in knockout_predictions
            ]
        }

    @staticmethod
    def create_or_update_match_prediction(db: Session, user_id: int, match_id: int, home_score: int, away_score: int) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש למשחק בודד
        """
        # בודק אם יש כבר ניחוש למשחק הזה
        existing_prediction = db.query(MatchPrediction).filter(
            MatchPrediction.user_id == user_id,
            MatchPrediction.match_id == match_id
        ).first()
        
        if existing_prediction:
            # מעדכן ניחוש קיים
            existing_prediction.home_score = home_score
            existing_prediction.away_score = away_score
            # updated_at מתעדכן אוטומטית
            db.commit()
            
            return {
                "id": existing_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
                "updated": True
            }
        else:
            # יוצר ניחוש חדש
            new_prediction = MatchPrediction(
                user_id=user_id,
                match_id=match_id,
                home_score=home_score,
                away_score=away_score
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            
            return {
                "id": new_prediction.id,
                "match_id": match_id,
                "home_score": home_score,
                "away_score": away_score,
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
        
        result = []
        for pred in predictions:
            # מביא את פרטי הבית
            group = db.query(Group).filter(Group.id == pred.group_id).first()
            
            # ממיר מ-JSON string חזרה לרשימה
            positions = json.loads(pred.positions)
            
            result.append({
                "id": pred.id,
                "group": {
                    "id": group.id,
                    "name": group.name
                },
                "positions": positions,  # רשימה של team IDs
                "points": pred.points,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            })
        
        return result

    @staticmethod
    def create_or_update_third_place_prediction(db: Session, user_id: int, advancing_team_ids: List[int]) -> Dict[str, Any]:
        """
        יצירה או עדכון ניחוש למקומות 3
        advancing_team_ids: רשימה של 8 team IDs שיעלו
        """
        # בודק שיש בדיוק 8 קבוצות
        if len(advancing_team_ids) != 8:
            return {"error": "חייבים לבחור בדיוק 8 קבוצות"}
        
        # בודק שכל הקבוצות הן אכן ממקום 3
        eligible_teams = PredictionService.get_third_place_eligible_teams(db, user_id)
        eligible_team_ids = [team["team_id"] for team in eligible_teams]
        
        for team_id in advancing_team_ids:
            if team_id not in eligible_team_ids:
                return {"error": f"קבוצה {team_id} לא מגיעה ממקום 3"}
        
        existing_prediction = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).first()
        
        advancing_team_ids_json = json.dumps(advancing_team_ids)
        
        if existing_prediction:
            existing_prediction.advancing_team_ids = advancing_team_ids_json
            db.commit()
            return {"id": existing_prediction.id, "advancing_team_ids": advancing_team_ids, "updated": True}
        else:
            new_prediction = ThirdPlacePrediction(
                user_id=user_id,
                advancing_team_ids=advancing_team_ids_json
            )
            db.add(new_prediction)
            db.commit()
            db.refresh(new_prediction)
            return {"id": new_prediction.id, "advancing_team_ids": advancing_team_ids, "updated": False}

    @staticmethod
    def get_third_place_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את ניחושי המקומות 3 של המשתמש
        """
        predictions = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).all()
        
        result = []
        for pred in predictions:
            advancing_team_ids = json.loads(pred.advancing_team_ids)
            
            result.append({
                "id": pred.id,
                "advancing_team_ids": advancing_team_ids,
                "points": pred.points,
                "created_at": pred.created_at.isoformat(),
                "updated_at": pred.updated_at.isoformat()
            })
        return result

    @staticmethod
    def get_third_place_eligible_teams(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את 12 הקבוצות שמגיעות ממקום 3 לפי ניחושי הבתים של המשתמש
        """
        # מביא את כל ניחושי הבתים של המשתמש
        group_predictions = db.query(GroupStagePrediction).filter(
            GroupStagePrediction.user_id == user_id
        ).all()
        
        # בודק שיש ניחוש לכל 12 הבתים
        if len(group_predictions) != 12:
            return []
        
        third_place_teams = []
        
        for pred in group_predictions:
            positions = json.loads(pred.positions)
            if len(positions) >= 3:
                third_place_team_id = positions[2]  # מקום 3 (אינדקס 2)
                
                # מביא את פרטי הקבוצה
                team = db.query(Team).filter(Team.id == third_place_team_id).first()
                if team:
                    third_place_teams.append({
                        "team_id": team.id,
                        "team_name": team.name,
                        "country_code": team.country_code,
                        "group_name": pred.group.name
                    })
        
        return third_place_teams
