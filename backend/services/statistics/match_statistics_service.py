from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
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

        if DBReader.count_match_predictions_for_match(db, match_id) == 0:
            return {"match_id": match_id, "total_predictions": 0}

        match_result = DBReader.get_match_result(db, match_id)

        if match_result:
            return MatchStatisticsService._post_result_stats(db, match)
        else:
            return MatchStatisticsService._pre_result_stats(db, match)

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
    def _pre_result_stats(db: Session, match) -> Dict[str, Any]:
        counts = DBReader.get_match_winner_distribution(
            db, match.id, match.home_team_id, match.away_team_id
        )
        total_all = counts["total"]
        home = counts["home"]
        draw = counts["draw"]
        away = counts["away"]
        total_with_winner = home + draw + away

        home_pct, draw_pct, away_pct = MatchStatisticsService._round_percentages_to_100(
            [home, draw, away], total_with_winner
        )

        return {
            "match_id": match.id,
            "has_result": False,
            "total_predictions": total_all,
            "winner_distribution": {
                "home_pct": home_pct,
                "draw_pct": draw_pct,
                "away_pct": away_pct,
            },
            "popular_scores": DBReader.get_match_popular_scores(db, match.id),
        }

    @staticmethod
    def _post_result_stats(db: Session, match) -> Dict[str, Any]:
        counts = DBReader.get_match_accuracy_counts(db, match.id)
        exact = counts["exact"]
        correct = counts["correct"]
        wrong = counts["wrong"]
        total = counts["total"]
        judged = exact + correct + wrong

        if judged == 0:
            return {"match_id": match.id, "has_result": True, "total_predictions": total}

        exact_pct, correct_pct, wrong_pct = MatchStatisticsService._round_percentages_to_100(
            [exact, correct, wrong], judged
        )

        return {
            "match_id": match.id,
            "has_result": True,
            "total_predictions": total,
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
    def _round_percentages_to_100(counts: list, total: int) -> list:
        """
        Round percentages to whole integers that sum to exactly 100.
        Uses largest-remainder method.
        Handles negative leftover (edge case where floored sum > 100).
        """
        if total == 0:
            return [0] * len(counts)

        raw = [c / total * 100 for c in counts]
        floored = [math.floor(r) for r in raw]
        remainders = [r - f for r, f in zip(raw, floored)]
        leftover = 100 - sum(floored)

        indices_by_remainder = sorted(
            range(len(remainders)),
            key=lambda i: remainders[i],
            reverse=True,
        )

        if leftover > 0:
            for i in range(min(leftover, len(indices_by_remainder))):
                floored[indices_by_remainder[i]] += 1
        elif leftover < 0:
            # Edge case: remove 1 from items with smallest remainders
            indices_asc = indices_by_remainder[::-1]
            for i in range(min(-leftover, len(indices_asc))):
                floored[indices_asc[i]] -= 1

        return floored
