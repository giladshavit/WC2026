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
        result = DBReader.get_third_place_result(db)

        total = DBReader.count_third_place_predictions_with_any_team(db)
        if total == 0:
            return {"total_predictions": 0}

        group_pick_pct = {g: 0.0 for g in "ABCDEFGHIJKL"}
        for row in DBReader.count_third_place_group_picks(db):
            if row.group_letter in group_pick_pct:
                group_pick_pct[row.group_letter] = round(row.cnt / total * 100, 1)

        if not result:
            return {
                "has_result": False,
                "total_predictions": total,
                "group_pick_pct": dict(sorted(group_pick_pct.items())),
            }

        qualifying_team_ids = [
            result.first_team_qualifying,  result.second_team_qualifying,
            result.third_team_qualifying,  result.fourth_team_qualifying,
            result.fifth_team_qualifying,  result.sixth_team_qualifying,
            result.seventh_team_qualifying, result.eighth_team_qualifying,
        ]
        qual_letter_rows = DBReader.get_group_letters_for_team_ids(db, qualifying_team_ids)
        qualifying_letters = [r.group_letter for r in qual_letter_rows]

        if not qualifying_letters:
            return {"has_result": True, "total_predictions": total}

        group_accuracy = {g: 0.0 for g in qualifying_letters}
        for row in DBReader.count_third_place_group_accuracy(db, qualifying_letters):
            group_accuracy[row.group_letter] = round(row.cnt / total * 100, 1)

        accuracy_distribution = {str(k): 0.0 for k in range(4, 9)}
        for row in DBReader.count_third_place_accuracy_distribution(db, qualifying_letters):
            accuracy_distribution[str(row.bucket)] = round(row.cnt / total * 100, 1)

        return {
            "has_result": True,
            "total_predictions": total,
            "group_accuracy": dict(sorted(group_accuracy.items())),
            "accuracy_distribution": accuracy_distribution,
        }
