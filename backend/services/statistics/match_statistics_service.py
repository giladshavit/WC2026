from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from collections import Counter
import math

from services.predictions.enums import MatchPredictionStatus
from services.database import DBReader


class MatchStatisticsService:
    """On-the-fly match statistics. Read-only."""

    # ═══════════════════════════════════════════════════════
    # PUBLIC
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_match_statistics(db: Session, match_id: int) -> Dict[str, Any]:
        """
        Server decides what to return based on match state:
        - No result → winner distribution + popular scores
        - Has result → accuracy percentages
        """
        match = DBReader.get_match(db, match_id)
        if not match:
            return {"error": "Match not found"}

        predictions = DBReader.get_match_predictions_by_match(db, match_id)
        if not predictions:
            return {"match_id": match_id, "total_predictions": 0}

        match_result = DBReader.get_match_result(db, match_id)

        if match_result:
            return MatchStatisticsService._post_result_stats(match, predictions)
        else:
            return MatchStatisticsService._pre_result_stats(match, predictions)

    @staticmethod
    def get_user_match_profile(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
        """User's match accuracy from MatchPrediction.status counts."""
        user_scores = DBReader.get_user_scores(db, user_id)
        counts = DBReader.count_match_predictions_by_status(db, user_id)

        exact = counts.get(MatchPredictionStatus.EXACT.value, 0)
        correct_outcome = counts.get(MatchPredictionStatus.CORRECT_OUTCOME.value, 0)
        wrong = counts.get(MatchPredictionStatus.WRONG.value, 0)

        return {
            "user_id": user_id,
            "matches_score": user_scores.matches_score if user_scores else 0,
            "exact": exact,
            "correct_outcome": correct_outcome,
            "correct": correct_outcome,  # Alias for backward compat with mobile
            "wrong": wrong,
            "total_judged": exact + correct_outcome + wrong,
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre/Post result
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(match, predictions) -> Dict[str, Any]:
        """Before result: who people think will win + popular predicted scores."""
        total = len(predictions)

        home = sum(1 for p in predictions if p.predicted_winner == match.home_team_id)
        draw = sum(1 for p in predictions if p.predicted_winner == 0)
        away = sum(1 for p in predictions if p.predicted_winner == match.away_team_id)

        home_pct, draw_pct, away_pct = MatchStatisticsService._round_percentages_to_100(
            [home, draw, away], total
        )

        return {
            "match_id": match.id,
            "has_result": False,
            "total_predictions": total,
            "winner_distribution": {
                "home_pct": home_pct,
                "draw_pct": draw_pct,
                "away_pct": away_pct,
            },
            "popular_scores": MatchStatisticsService._calc_popular_scores(predictions),
        }

    @staticmethod
    def _post_result_stats(match, predictions) -> Dict[str, Any]:
        """After result: how many got it right."""
        exact = sum(1 for p in predictions if p.status == MatchPredictionStatus.EXACT)
        correct = sum(1 for p in predictions if p.status == MatchPredictionStatus.CORRECT_OUTCOME)
        wrong = sum(1 for p in predictions if p.status == MatchPredictionStatus.WRONG)
        judged = exact + correct + wrong

        if judged == 0:
            return {"match_id": match.id, "has_result": True, "total_predictions": len(predictions)}

        exact_pct, correct_pct, wrong_pct = MatchStatisticsService._round_percentages_to_100(
            [exact, correct, wrong], judged
        )

        return {
            "match_id": match.id,
            "has_result": True,
            "total_predictions": len(predictions),
            "accuracy": {
                "exact_pct": exact_pct,
                "correct_pct": correct_pct,
                "wrong_pct": wrong_pct,
            },
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _calc_popular_scores(predictions) -> list:
        """Top 3 most predicted exact scores."""
        score_counts = Counter(
            (p.home_score, p.away_score)
            for p in predictions
            if p.home_score is not None and p.away_score is not None
        )
        return [
            {"home": s[0], "away": s[1], "count": c}
            for s, c in score_counts.most_common(3)
        ]

    @staticmethod
    def _round_percentages_to_100(counts: list, total: int) -> list:
        """
        Round percentages to whole integers that sum to exactly 100.
        Uses largest-remainder method:
        1. Floor all percentages
        2. Distribute leftover (100 - sum) to items with largest fractional parts
        """
        if total == 0:
            return [0] * len(counts)

        raw = [c / total * 100 for c in counts]
        floored = [math.floor(r) for r in raw]
        remainders = [r - f for r, f in zip(raw, floored)]
        leftover = 100 - sum(floored)

        # Give +1 to the items with the largest remainders
        indices_by_remainder = sorted(range(len(remainders)), key=lambda i: remainders[i], reverse=True)
        for i in range(leftover):
            floored[indices_by_remainder[i]] += 1

        return floored
