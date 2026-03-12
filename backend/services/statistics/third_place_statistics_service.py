from typing import Dict, Any, Set
from sqlalchemy.orm import Session

from services.database import DBReader


class ThirdPlaceStatisticsService:
    """On-the-fly third place qualifying statistics. Read-only."""

    TEAM_FIELDS = [
        'first_team_qualifying', 'second_team_qualifying',
        'third_team_qualifying', 'fourth_team_qualifying',
        'fifth_team_qualifying', 'sixth_team_qualifying',
        'seventh_team_qualifying', 'eighth_team_qualifying',
    ]

    # ═══════════════════════════════════════════════════════
    # PUBLIC
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_third_place_statistics(db: Session) -> Dict[str, Any]:
        """Server decides pre/post based on result existence."""
        predictions = DBReader.get_all_third_place_predictions(db)
        if not predictions:
            return {"total_predictions": 0}

        # Build team_id -> group_letter cache once (1 DB query instead of N*8)
        team_group_cache = ThirdPlaceStatisticsService._build_team_group_cache(db)

        result = DBReader.get_third_place_result(db)

        if result:
            return ThirdPlaceStatisticsService._post_result_stats(predictions, result, team_group_cache)
        else:
            return ThirdPlaceStatisticsService._pre_result_stats(predictions, team_group_cache)

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre-Result
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(predictions, team_group_cache: Dict[int, str]) -> Dict[str, Any]:
        """How many % picked each group to have a qualifier."""
        total = len(predictions)
        group_counts = ThirdPlaceStatisticsService._count_groups_picked(predictions, team_group_cache)

        return {
            "has_result": False,
            "total_predictions": total,
            "group_pick_pct": {
                group: round(count / total * 100, 1)
                for group, count in sorted(group_counts.items())
            },
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Post-Result
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _post_result_stats(predictions, result, team_group_cache: Dict[int, str]) -> Dict[str, Any]:
        """Accuracy per group + distribution (4-8) as percentages."""
        # Keep only predictions where at least one team was picked
        answered = [
            p for p in predictions
            if any(getattr(p, field, None) is not None for field in ThirdPlaceStatisticsService.TEAM_FIELDS)
        ]
        total = len(answered)

        if total == 0:
            return {"has_result": True, "total_predictions": 0}

        actual_groups = ThirdPlaceStatisticsService._extract_groups(result, team_group_cache)

        return {
            "has_result": True,
            "total_predictions": total,
            "group_accuracy": ThirdPlaceStatisticsService._calc_group_accuracy(
                answered, actual_groups, team_group_cache, total
            ),
            "accuracy_distribution": ThirdPlaceStatisticsService._calc_accuracy_distribution(
                answered, actual_groups, team_group_cache, total
            ),
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Post Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _calc_group_accuracy(
        predictions, actual_groups: Set[str], team_group_cache: Dict[int, str], total: int
    ) -> Dict[str, float]:
        """For each qualifying group: what % of users picked it."""
        counts: Dict[str, int] = {group: 0 for group in actual_groups}

        for p in predictions:
            user_groups = ThirdPlaceStatisticsService._extract_groups(p, team_group_cache)
            for group in actual_groups:
                if group in user_groups:
                    counts[group] += 1

        return {
            group: round(count / total * 100, 1)
            for group, count in sorted(counts.items())
        }

    @staticmethod
    def _calc_accuracy_distribution(
        predictions, actual_groups: Set[str], team_group_cache: Dict[int, str], total: int
    ) -> Dict[str, float]:
        """What % of users got exactly N groups right. Range: 4-8. Values are percentages."""
        counts = {4: 0, 5: 0, 6: 0, 7: 0, 8: 0}

        for p in predictions:
            user_groups = ThirdPlaceStatisticsService._extract_groups(p, team_group_cache)
            correct = len(user_groups & actual_groups)
            key = max(4, min(8, correct))
            counts[key] += 1

        return {
            str(k): round(v / total * 100, 1) if total else 0
            for k, v in counts.items()
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Shared Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _build_team_group_cache(db: Session) -> Dict[int, str]:
        """Load all teams once and build team_id -> group_letter mapping."""
        teams = DBReader.get_all_teams(db)
        return {
            team.id: team.group_letter
            for team in teams
            if team.group_letter
        }

    @staticmethod
    def _extract_groups(prediction_or_result, team_group_cache: Dict[int, str]) -> Set[str]:
        """Extract set of group letters from a prediction or result object."""
        groups = set()
        for field in ThirdPlaceStatisticsService.TEAM_FIELDS:
            team_id = getattr(prediction_or_result, field, None)
            if team_id and team_id in team_group_cache:
                groups.add(team_group_cache[team_id])
        return groups

    @staticmethod
    def _count_groups_picked(predictions, team_group_cache: Dict[int, str]) -> Dict[str, int]:
        """Count how many users picked each group (pre-result)."""
        counts: Dict[str, int] = {}
        for p in predictions:
            user_groups = ThirdPlaceStatisticsService._extract_groups(p, team_group_cache)
            for group in user_groups:
                counts[group] = counts.get(group, 0) + 1
        return counts
