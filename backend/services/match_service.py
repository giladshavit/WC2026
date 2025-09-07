from typing import Dict, List, Any
from sqlalchemy.orm import Session
from datetime import datetime
from models.matches import Match
from models.predictions import MatchPrediction
from models.team import Team

class MatchService:
    
    @staticmethod
    def get_all_matches_with_predictions(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        מביא את כל המשחקים עם הניחושים של המשתמש
        """
        # מביא את כל המשחקים
        matches = db.query(Match).all()
        
        matches_with_predictions = []
        
        for match in matches:
            # מביא את הניחוש של המשתמש למשחק הזה
            prediction = db.query(MatchPrediction).filter(
                MatchPrediction.user_id == user_id,
                MatchPrediction.match_id == match.id
            ).first()
            
            match_data = {
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
                "status": match.status,
                "user_prediction": {
                    "home_score": prediction.home_score if prediction else None,
                    "away_score": prediction.away_score if prediction else None,
                    "predicted_winner": prediction.predicted_winner if prediction else None
                },
                "can_edit": match.status == "scheduled"  # אפשר לערוך רק משחקים שעדיין לא התקיימו
            }
            
            # מוסיף פרטים ספציפיים לפי סוג המשחק
            if match.is_group_stage:
                match_data["group"] = match.group
            elif match.is_knockout:
                match_data["match_number"] = match.match_number
                match_data["home_team_source"] = match.home_team_source
                match_data["away_team_source"] = match.away_team_source
            
            matches_with_predictions.append(match_data)
        
        # ממיין לפי תאריך
        matches_with_predictions.sort(key=lambda x: x["date"])
        
        return matches_with_predictions

    @staticmethod
    def create_group_stage_match(db: Session, home_team_id: int, away_team_id: int, group: str, date: datetime) -> Dict[str, Any]:
        """
        יוצר משחק שלב בתים
        """
        # בודק שהקבוצות קיימות
        home_team = db.query(Team).filter(Team.id == home_team_id).first()
        away_team = db.query(Team).filter(Team.id == away_team_id).first()
        
        if not home_team or not away_team:
            return {"error": "One or both teams not found"}
        
        match = Match(
            stage="group",
            home_team_id=home_team_id,
            away_team_id=away_team_id,
            group=group,
            date=date,
            status="scheduled"
        )
        
        db.add(match)
        db.commit()
        db.refresh(match)
        
        return {
            "id": match.id,
            "stage": "group",
            "home_team": {
                "id": home_team.id,
                "name": home_team.name,
            },
            "away_team": {
                "id": away_team.id,
                "name": away_team.name,
            },
            "group": group,
            "date": date.isoformat(),
            "status": "scheduled"
        }

    @staticmethod
    def create_knockout_match(db: Session, stage: str, match_number: int, home_team_source: str, away_team_source: str, date: datetime) -> Dict[str, Any]:
        """
        יוצר משחק נוקאאוט
        """
        match = Match(
            stage=stage,
            match_number=match_number,
            home_team_source=home_team_source,
            away_team_source=away_team_source,
            date=date,
            status="scheduled"
        )
        
        db.add(match)
        db.commit()
        db.refresh(match)
        
        return {
            "id": match.id,
            "stage": stage,
            "match_number": match_number,
            "home_team_source": home_team_source,
            "away_team_source": away_team_source,
            "date": date.isoformat(),
            "status": "scheduled"
        }