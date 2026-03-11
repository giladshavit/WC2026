from typing import Dict, Any
from sqlalchemy.orm import Session

from services.database import DBReader
from services.predictions.enums import MatchPredictionStatus, KnockoutPredictionStatus


class UserProfileStatisticsService:
    """Aggregates user scoring profile across all prediction types."""

    @staticmethod
    def get_user_full_profile(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Single endpoint: complete scoring profile for StatisticsScreen.
        Returns matches stats, groups per-group breakdown, knockout status counts.
        """
        user_scores = DBReader.get_user_scores(db, user_id)
        if not user_scores:
            return {"error": "User scores not found"}

        bonus_prediction = UserProfileStatisticsService._get_bonus_profile(db, user_id, user_scores)

        return {
            "user_id": user_id,
            "total_points": user_scores.total_points,
            "penalty": user_scores.penalty,
            "bonus_score": getattr(user_scores, 'bonus_score', 0) or 0,
            "bonus_penalty": getattr(user_scores, 'bonus_penalty', 0) or 0,
            "penalty_breakdown": {
                "groups": user_scores.groups_penalty or 0,
                "third_place": user_scores.third_place_penalty or 0,
                "knockout": user_scores.knockout_penalty or 0,
                "bonus": user_scores.bonus_penalty or 0,
            },

            "matches": UserProfileStatisticsService._get_matches_profile(db, user_id, user_scores),
            "groups": UserProfileStatisticsService._get_groups_profile(db, user_id, user_scores),
            "third_place": UserProfileStatisticsService._get_third_place_profile(db, user_id, user_scores),
            "knockout": UserProfileStatisticsService._get_knockout_profile(db, user_id, user_scores),
            "bonus": bonus_prediction,
        }

    # ═══════════════════════════════════════════════════════
    # MATCHES
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_matches_profile(db: Session, user_id: int, user_scores) -> Dict[str, Any]:
        """Match stats from GROUP BY on MatchPrediction.status."""
        status_counts = DBReader.count_match_predictions_by_status(db, user_id)

        exact = status_counts.get(MatchPredictionStatus.EXACT.value, 0)
        correct_outcome = status_counts.get(MatchPredictionStatus.CORRECT_OUTCOME.value, 0)
        wrong = status_counts.get(MatchPredictionStatus.WRONG.value, 0)
        pending = status_counts.get(MatchPredictionStatus.PENDING.value, 0)

        return {
            "score": user_scores.matches_score,
            "exact": exact,
            "correct_outcome": correct_outcome,
            "wrong": wrong,
            "pending": pending,
            "total_judged": exact + correct_outcome + wrong,
        }

    # ═══════════════════════════════════════════════════════
    # GROUPS
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_groups_profile(db: Session, user_id: int, user_scores) -> Dict[str, Any]:
        """
        Groups profile with:
        - Total score
        - Per-group list (12 items): group_name, points, correct_positions_count
        - Per-position totals via DBReader
        - Accuracy distribution (how many groups got 0/1/2/3/4 correct)
        """
        predictions = DBReader.get_group_predictions_by_user(db, user_id)

        per_group = []
        for p in predictions:
            group = DBReader.get_group(db, p.group_id)
            per_group.append({
                "group_id": p.group_id,
                "group_name": group.name if group else f"Group {p.group_id}",
                "points": p.points or 0,
                "correct_positions_count": p.correct_positions_count,
            })

        per_group.sort(key=lambda x: (-x["points"], -(x["correct_positions_count"] or 0), x["group_name"]))

        position_totals = DBReader.count_group_position_correct(db, user_id)

        judged = [p for p in per_group if p["correct_positions_count"] is not None]
        judged_count = len(judged)

        accuracy_dist = DBReader.count_group_accuracy_distribution(db, user_id)
        accuracy_distribution = {str(k): v for k, v in accuracy_dist.items()}

        return {
            "score": user_scores.groups_score,
            "total_groups": len(predictions),
            "judged_groups": judged_count,
            "per_group": per_group,
            "position_totals": position_totals,
            "accuracy_distribution": accuracy_distribution,
        }

    # ═══════════════════════════════════════════════════════
    # THIRD PLACE
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_third_place_profile(db: Session, user_id: int, user_scores) -> Dict[str, Any]:
        """Third place picks breakdown: which groups user picked, which were correct."""
        PRED_FIELDS = [
            'first_team_qualifying', 'second_team_qualifying', 'third_team_qualifying',
            'fourth_team_qualifying', 'fifth_team_qualifying', 'sixth_team_qualifying',
            'seventh_team_qualifying', 'eighth_team_qualifying',
        ]

        prediction = DBReader.get_third_place_prediction(db, user_id)
        result = DBReader.get_third_place_result(db)

        score = user_scores.third_place_score or 0

        # If no prediction yet
        if not prediction:
            return {"score": score, "has_prediction": False, "picks": [], "result_available": False}

        # Extract the 8 group letters the user picked
        def get_group_letters(obj) -> list:
            letters = []
            for field in PRED_FIELDS:
                team_id = getattr(obj, field, None)
                if team_id:
                    letter = DBReader.get_team_group_letter(db, team_id)
                    if letter:
                        letters.append(letter)
            return letters

        user_picks = get_group_letters(prediction)

        # No result yet - return picks without correctness info
        if not result:
            picks = [{"group": letter, "is_correct": None} for letter in user_picks]
            return {
                "score": score,
                "has_prediction": True,
                "result_available": False,
                "picks": picks,
                "correct_count": None,
            }

        # Result available - compute correctness per pick
        result_groups = set(get_group_letters(result))

        picks = [
            {"group": letter, "is_correct": letter in result_groups}
            for letter in user_picks
        ]
        correct_count = sum(1 for p in picks if p["is_correct"])

        return {
            "score": score,
            "has_prediction": True,
            "result_available": True,
            "picks": picks,
            "correct_count": correct_count,
        }

    # ═══════════════════════════════════════════════════════
    # KNOCKOUT
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_knockout_profile(db: Session, user_id: int, user_scores) -> Dict[str, Any]:
        """Knockout stats from GROUP BY on status."""
        status_counts = DBReader.count_knockout_predictions_by_status(db, user_id)

        return {
            "score": user_scores.knockout_score,
            "correct_full": status_counts.get(KnockoutPredictionStatus.CORRECT_FULL.value, 0),
            "correct_partial": status_counts.get(KnockoutPredictionStatus.CORRECT_PARTIAL.value, 0),
            "incorrect": status_counts.get(KnockoutPredictionStatus.INCORRECT.value, 0),
            "valid": status_counts.get(KnockoutPredictionStatus.VALID.value, 0),
            "invalid": status_counts.get(KnockoutPredictionStatus.INVALID.value, 0),
            "unreachable": status_counts.get(KnockoutPredictionStatus.UNREACHABLE.value, 0),
        }

    # ═══════════════════════════════════════════════════════
    # BONUS
    # ═══════════════════════════════════════════════════════

    BONUS_STATUS_COLS = [
        "q_g1_status", "q_g2_status", "q_g3_status", "q_g4_status", "q_g5_status",
        "q_k1_status", "q_k2_status", "q_k3_status", "q_t1_status", "q_t2_status",
    ]

    @staticmethod
    def _get_bonus_profile(db: Session, user_id: int, user_scores) -> Dict[str, Any]:
        """Bonus prediction stats: score, penalty, correct/incorrect counts from q_*_status columns."""
        pred = DBReader.get_bonus_prediction(db, user_id)
        if not pred:
            return {
                "score": user_scores.bonus_score or 0,
                "penalty": user_scores.bonus_penalty or 0,
                "correct_count": 0,
                "incorrect_count": 0,
                "has_any_judged": False,
            }
        correct_count = sum(
            1 for col in UserProfileStatisticsService.BONUS_STATUS_COLS
            if getattr(pred, col, "pending") == "correct"
        )
        incorrect_count = sum(
            1 for col in UserProfileStatisticsService.BONUS_STATUS_COLS
            if getattr(pred, col, "pending") in ("incorrect", "wrong")
        )
        has_any_judged = correct_count + incorrect_count > 0
        return {
            "score": user_scores.bonus_score or 0,
            "penalty": user_scores.bonus_penalty or 0,
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "has_any_judged": has_any_judged,
        }
