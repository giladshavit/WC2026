"""Bonus question statistics — answer distribution per question."""
from typing import Any, Dict, List

from sqlalchemy import cast, func, String
from sqlalchemy.orm import Session

from models.predictions import BonusPrediction

FIELD_TO_COLUMN: Dict[str, str] = {
    "g1": "g1_total_goals_group",
    "g2": "g2_top_group_id",
    "g3": "g3_top_team_id",
    "g4": "g4_perfect_teams",
    "g5": "g5_clean_sheet_teams",
    "g6": "g6_scoreless_draws_group",
    "k1": "k1_total_goals_knockout",
    "k2": "k2_penalty_shootouts",
    "k3": "k3_third_place_quarters",
    "t1": "t1_total_goals_tournament",
    "t2": "t2_champion_team_id",
    "t3": "t3_top_scorer",
}

STATUS_COLUMN_MAP: Dict[str, str] = {
    "g1": "q_g1_status", "g2": "q_g2_status", "g3": "q_g3_status",
    "g4": "q_g4_status", "g5": "q_g5_status", "g6": "q_g6_status",
    "k1": "q_k1_status", "k2": "q_k2_status", "k3": "q_k3_status",
    "t1": "q_t1_status", "t2": "q_t2_status", "t3": "q_t3_status",
}


class BonusStatisticsService:
    """On-the-fly bonus question statistics. Read-only, no DB writes."""

    @staticmethod
    def get_question_statistics(db: Session, field_key: str) -> Dict[str, Any]:
        if field_key not in FIELD_TO_COLUMN:
            raise ValueError(f"Unknown field_key: {field_key}")

        column_name = FIELD_TO_COLUMN[field_key]

        col = getattr(BonusPrediction, column_name)

        rows = (
            db.query(cast(col, String), func.count())
            .filter(col.isnot(None))
            .group_by(col)
            .all()
        )

        # Filter out zero/empty/null values (same logic as before)
        counts: Dict[str, int] = {}
        for val_str, cnt in rows:
            if not val_str:
                continue
            s = val_str.strip()
            if not s or s.lower() in ("none", "null", "0"):
                continue
            counts[s] = counts.get(s, 0) + cnt

        total_answered = sum(counts.values())

        if total_answered == 0:
            return {"field_key": field_key, "total_answered": 0, "distribution": []}

        # Build distribution — normalize to 100 regardless of how many answered
        # This handles any edge case where floats don't sum to 100
        distribution = BonusStatisticsService._normalize_to_100(counts)

        return {
            "field_key": field_key,
            "total_answered": total_answered,
            "distribution": distribution,
        }

    @staticmethod
    def _normalize_to_100(counts: Dict[str, int]) -> list:
        """
        Convert raw counts to percentages that sum to exactly 100.
        Uses proportional scaling so partial-answer sets still produce valid charts.
        """
        if not counts:
            return []

        total = sum(counts.values())
        if total == 0:
            return []

        # Calculate raw floats
        items = [
            {"value": v, "count": c, "raw_pct": c / total * 100}
            for v, c in counts.items()
        ]

        # Floor each
        for item in items:
            item["pct"] = int(item["raw_pct"])

        # Distribute remainder using largest-remainder method
        remainder = 100 - sum(item["pct"] for item in items)
        items.sort(key=lambda x: -(x["raw_pct"] - int(x["raw_pct"])))
        for i in range(max(0, remainder)):
            items[i]["pct"] += 1

        # Clean up helper field
        for item in items:
            item.pop("raw_pct", None)

        # Sort by count descending
        items.sort(key=lambda x: -x["count"])
        return items

    @staticmethod
    def get_question_outcome_stats(db: Session, field_key: str) -> dict:
        if field_key not in FIELD_TO_COLUMN:
            raise ValueError(f"Unknown field_key: {field_key}")

        status_col = STATUS_COLUMN_MAP[field_key]
        answer_col = FIELD_TO_COLUMN[field_key]

        from services.database import DBReader
        data = DBReader.count_bonus_outcome_stats(db, status_col, answer_col)
        correct  = data["correct"]
        incorrect = data["incorrect"]
        total    = data["total_answered"]
        settled      = (correct + incorrect) > 0
        correct_pct  = round(correct / total * 100) if total > 0 else 0

        return {
            "field_key":      field_key,
            "settled":        settled,
            "correct":        correct,
            "incorrect":      incorrect,
            "total_answered": total,
            "correct_pct":    correct_pct,
            "incorrect_pct":  100 - correct_pct if total > 0 else 0,
        }
