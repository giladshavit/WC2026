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

        teams = GroupStatisticsService._get_group_teams(group)
        result = DBReader.get_group_stage_result(db, group_id)

        if result:
            return GroupStatisticsService._post_result_stats(db, group, teams, result)
        else:
            return GroupStatisticsService._pre_result_stats(db, group, teams)

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre/Post
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(db: Session, group, teams: Dict[int, str]) -> Dict[str, Any]:
        team_ids = list(teams.keys())
        if not team_ids:
            return {"group_id": group.id, "group_name": group.name, "has_result": False, "total_predictions": 0}

        data = DBReader.get_group_winner_distribution(db, group.id, team_ids)
        if not data:
            return {"group_id": group.id, "group_name": group.name, "has_result": False, "total_predictions": 0}

        total = next(iter(data.values()))["total"]
        if total == 0:
            return {"group_id": group.id, "group_name": group.name, "has_result": False, "total_predictions": 0}

        position_counts = {
            team_id: {
                "first_place":  v["first"],
                "second_place": v["second"],
                "third_place":  v["third"],
                "fourth_place": v["fourth"],
            }
            for team_id, v in data.items()
        }

        return {
            "group_id": group.id,
            "group_name": group.name,
            "has_result": False,
            "total_predictions": total,
            "consensus_table": GroupStatisticsService._calc_consensus_table(position_counts),
            "position_distribution": GroupStatisticsService._calc_position_distribution(position_counts, total),
        }

    @staticmethod
    def _post_result_stats(db: Session, group, teams: Dict[int, str], result) -> Dict[str, Any]:
        counts = DBReader.get_group_accuracy_counts(
            db, group.id,
            result.first_place, result.second_place,
            result.third_place, result.fourth_place,
        )
        total = counts["total"]
        if total == 0:
            return {"group_id": group.id, "group_name": group.name, "has_result": True, "total_predictions": 0}

        position_accuracy = {
            "first_place":  {"team_name": teams.get(result.first_place,  "Unknown"), "correct_pct": round(counts["first_correct"]  / total * 100, 1)},
            "second_place": {"team_name": teams.get(result.second_place, "Unknown"), "correct_pct": round(counts["second_correct"] / total * 100, 1)},
            "third_place":  {"team_name": teams.get(result.third_place,  "Unknown"), "correct_pct": round(counts["third_correct"]  / total * 100, 1)},
            "fourth_place": {"team_name": teams.get(result.fourth_place, "Unknown"), "correct_pct": round(counts["fourth_correct"] / total * 100, 1)},
        }

        dist = counts["distribution"]
        accuracy_distribution = {
            k: round(v / total * 100, 1) if total else 0
            for k, v in dist.items()
        }

        return {
            "group_id": group.id,
            "group_name": group.name,
            "has_result": True,
            "total_predictions": total,
            "position_accuracy": position_accuracy,
            "accuracy_distribution": accuracy_distribution,
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
