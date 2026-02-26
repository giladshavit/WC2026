from typing import Dict, Any, List
from sqlalchemy.orm import Session

from services.database import DBReader


class GroupStatisticsService:
    """On-the-fly group stage statistics. Read-only."""

    POSITIONS = ['first_place', 'second_place', 'third_place', 'fourth_place']

    # ═══════════════════════════════════════════════════════
    # PUBLIC
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_group_statistics(db: Session, group_id: int) -> Dict[str, Any]:
        """Server decides pre/post based on result existence."""
        group = DBReader.get_group(db, group_id)
        if not group:
            return {"error": "Group not found"}

        predictions = DBReader.get_group_predictions_by_group(db, group_id)
        if not predictions:
            return {"group_id": group_id, "group_name": group.name, "total_predictions": 0}

        teams = GroupStatisticsService._get_group_teams(group)
        result = DBReader.get_group_stage_result(db, group_id)

        if result:
            return GroupStatisticsService._post_result_stats(group, predictions, teams, result)
        else:
            return GroupStatisticsService._pre_result_stats(group, predictions, teams)

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre/Post
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(group, predictions, teams: Dict[int, str]) -> Dict[str, Any]:
        total = len(predictions)
        position_counts = GroupStatisticsService._count_positions(predictions, teams)

        return {
            "group_id": group.id,
            "group_name": group.name,
            "has_result": False,
            "total_predictions": total,
            "consensus_table": GroupStatisticsService._calc_consensus_table(position_counts),
            "position_distribution": GroupStatisticsService._calc_position_distribution(
                position_counts, total
            ),
        }

    @staticmethod
    def _post_result_stats(group, predictions, teams: Dict[int, str], result) -> Dict[str, Any]:
        total = len(predictions)

        return {
            "group_id": group.id,
            "group_name": group.name,
            "has_result": True,
            "total_predictions": total,
            "position_accuracy": GroupStatisticsService._calc_position_accuracy(
                predictions, teams, result, total
            ),
            "accuracy_distribution": GroupStatisticsService._calc_accuracy_distribution(
                predictions, result, total
            ),
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Post Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _calc_position_accuracy(predictions, teams, result, total) -> Dict[str, Any]:
        """For each position: which team finished there and what % got it right."""
        accuracy = {}
        for pos in GroupStatisticsService.POSITIONS:
            actual_team_id = getattr(result, pos)
            correct = sum(1 for p in predictions if getattr(p, pos) == actual_team_id)
            accuracy[pos] = {
                "team_name": teams.get(actual_team_id, "Unknown"),
                "correct_pct": round(correct / total * 100, 1) if total else 0,
            }
        return accuracy

    @staticmethod
    def _calc_accuracy_distribution(predictions, result, total) -> Dict[int, float]:
        """What % of users got exactly 0, 1, 2, 3, or 4 positions right."""
        counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
        for p in predictions:
            correct = sum(
                1 for pos in GroupStatisticsService.POSITIONS
                if getattr(p, pos) == getattr(result, pos)
            )
            counts[correct] += 1

        return {
            k: round(v / total * 100, 1) if total else 0
            for k, v in counts.items()
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _calc_consensus_table(position_counts: Dict[int, Dict[str, int]]) -> List[Dict[str, Any]]:
        """Borda-style consensus. Lower weighted_score = higher rank."""
        weights = {
            'first_place': 1, 'second_place': 2,
            'third_place': 3, 'fourth_place': 4,
        }
        scored = []
        for team_id, pos_counts in position_counts.items():
            weighted = sum(weights[pos] * count for pos, count in pos_counts.items())
            scored.append((team_id, weighted))

        scored.sort(key=lambda x: x[1])

        return [
            {"team_id": team_id, "rank": i + 1}
            for i, (team_id, _) in enumerate(scored)
        ]

    @staticmethod
    def _calc_position_distribution(
        position_counts: Dict[int, Dict[str, int]], total: int
    ) -> Dict[int, Dict[str, float]]:
        """For each team: % picked for each position. One decimal place."""
        distribution = {}
        for team_id, pos_counts in position_counts.items():
            distribution[team_id] = {
                "first_pct": round(pos_counts['first_place'] / total * 100, 1) if total else 0,
                "second_pct": round(pos_counts['second_place'] / total * 100, 1) if total else 0,
                "third_pct": round(pos_counts['third_place'] / total * 100, 1) if total else 0,
                "fourth_pct": round(pos_counts['fourth_place'] / total * 100, 1) if total else 0,
            }
        return distribution

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Shared
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _get_group_teams(group) -> Dict[int, str]:
        teams = {}
        for attr in ['team_1_obj', 'team_2_obj', 'team_3_obj', 'team_4_obj']:
            team = getattr(group, attr, None)
            if team:
                teams[team.id] = team.name
        return teams

    @staticmethod
    def _count_positions(predictions, teams: Dict[int, str]) -> Dict[int, Dict[str, int]]:
        counts: Dict[int, Dict[str, int]] = {}
        for team_id in teams:
            counts[team_id] = {pos: 0 for pos in GroupStatisticsService.POSITIONS}
        for p in predictions:
            for pos in GroupStatisticsService.POSITIONS:
                team_id = getattr(p, pos)
                if team_id in counts:
                    counts[team_id][pos] += 1
        return counts
