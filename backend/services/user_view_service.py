"""
UserViewService: Read-only service for viewing another user's predictions.
Exposes only settled/completed predictions — no drafts, no pending data.
"""
from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException

from services.database import DBReader
from services.predictions.match_prediction_service import MatchPredictionService
from services.predictions.group_prediction_service import GroupPredictionService
from services.predictions.third_place_prediction_service import ThirdPlacePredictionService
from services.predictions.knockout_service import KnockoutService
from services.predictions.bonus_prediction_service import BonusPredictionService


class UserViewService:
    """Read-only service for viewing another user's settled predictions."""

    @staticmethod
    def get_user_profile(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get basic user profile and scores.
        Raises HTTPException(404) if user not found.
        """
        user = DBReader.get_user(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user_scores = DBReader.get_user_scores(db, user_id)

        return {
            "user_id": user.id,
            "username": user.username,
            "name": user.name if user.name else None,
            "total_points": user_scores.total_points if user_scores else 0,
            "matches_score": user_scores.matches_score if user_scores else 0,
            "groups_score": user_scores.groups_score if user_scores else 0,
            "third_place_score": user_scores.third_place_score if user_scores else 0,
            "knockout_score": user_scores.knockout_score if user_scores else 0,
            "bonus_score": user_scores.bonus_score if user_scores else 0,
            "penalty": user_scores.penalty if user_scores else 0,
        }

    @staticmethod
    def get_user_match_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get match predictions filtered to live/finished matches only.
        """
        result = MatchPredictionService.get_all_matches_with_predictions(db, user_id)
        filtered_matches = [
            m for m in result["matches"]
            if m.get("status") in ("live", "finished")
        ]
        return {
            "matches": filtered_matches,
            "matches_score": result.get("matches_score"),
        }

    @staticmethod
    def get_user_group_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        result = GroupPredictionService.get_group_predictions(db, user_id)
        filtered_groups = [
            g for g in result["groups"]
            if g.get("first_place") is not None or g.get("second_place") is not None
        ]
        return {
            "groups": filtered_groups,
            "groups_score": result.get("groups_score"),
            "groups_penalty": result.get("groups_penalty", 0),
        }

    @staticmethod
    def get_user_third_place_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        data = ThirdPlacePredictionService.get_third_place_predictions_data(db, user_id)
        if "error" in data:
            return {"available": False}
        return {
            "available": True,
            **data,
        }

    @staticmethod
    def get_user_knockout_predictions(db: Session, user_id: int) -> Dict[str, Any]:
        result = KnockoutService.get_knockout_predictions(
            db, user_id, stage=None, is_draft=False
        )
        filtered_predictions = [
            p for p in result["predictions"]
            if p.get("team1_id") is not None or p.get("team2_id") is not None
        ]
        return {
            "predictions": filtered_predictions,
            "knockout_score": result.get("knockout_score"),
            "knockout_penalty": result.get("knockout_penalty", 0),
        }

    @staticmethod
    def get_user_bonus_prediction(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get bonus prediction for a user (read-only view).
        Returns same format as bonus API plus groups for label resolution.
        """
        pred = DBReader.get_bonus_prediction(db, user_id)
        if not pred:
            raise HTTPException(status_code=404, detail="Bonus prediction not found")
        result = BonusPredictionService._to_response(pred, db)
        # Include groups for resolving group/team names in labels
        groups_result = GroupPredictionService.get_group_predictions(db, user_id)
        result["groups"] = groups_result.get("groups", [])
        return result
