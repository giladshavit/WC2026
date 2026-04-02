from typing import Dict, Any, List
from collections import Counter
from sqlalchemy.orm import Session

from models.team import Team
from services.database import DBReader


class KnockoutStatisticsService:
    """On-the-fly knockout stage statistics. Read-only."""

    # ═══════════════════════════════════════════════════════
    # PUBLIC
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_knockout_match_statistics(db: Session, template_match_id: int) -> Dict[str, Any]:
        """Server decides pre/post based on result existence."""
        predictions = DBReader.get_knockout_predictions_by_match(db, template_match_id)
        if not predictions:
            return {"template_match_id": template_match_id, "total_predictions": 0}

        result = DBReader.get_knockout_result(db, template_match_id)

        if result and result.winner_team_id:
            return KnockoutStatisticsService._post_result_stats(
                db, template_match_id, predictions, result
            )
        else:
            return KnockoutStatisticsService._pre_result_stats(
                db, template_match_id, predictions
            )

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre/Post
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(db, template_match_id, predictions) -> Dict[str, Any]:
        # Only count predictions with both teams filled (complete matchups)
        answered = [
            p for p in predictions
            if p.team1_id is not None and p.team2_id is not None
        ]
        total = len(answered)

        if total == 0:
            return {"template_match_id": template_match_id, "has_result": False, "total_predictions": 0}

        return {
            "template_match_id": template_match_id,
            "has_result": False,
            "total_predictions": total,
            "top_matchups": KnockoutStatisticsService._calc_top_matchups(db, answered, total),
        }

    @staticmethod
    def _post_result_stats(db, template_match_id, predictions, result) -> Dict[str, Any]:
        # Filter to only predictions with at least one field filled
        answered = [
            p for p in predictions
            if p.winner_team_id is not None
            or p.team1_id is not None
            or p.team2_id is not None
        ]
        total = len(answered)

        if total == 0:
            return {"template_match_id": template_match_id, "has_result": True, "total_predictions": 0}

        winner_id = result.winner_team_id
        stage = predictions[0].stage

        exact = DBReader.count_knockout_exact_winners(db, template_match_id, winner_id)
        partial = DBReader.count_knockout_winner_in_stage_excluding_match(
            db, stage, winner_id, template_match_id
        )
        matchup = KnockoutStatisticsService._count_correct_matchups(answered, result)

        team1 = DBReader.get_team(db, result.team_1) if result.team_1 else None
        team2 = DBReader.get_team(db, result.team_2) if result.team_2 else None
        winner_team = DBReader.get_team(db, winner_id) if winner_id else None

        return {
            "template_match_id": template_match_id,
            "has_result": True,
            "total_predictions": total,
            "winner_name": winner_team.name if winner_team else None,
            "winner_flag": winner_team.flag_url if winner_team else None,
            "team1_name": team1.name if team1 else None,
            "team1_flag": team1.flag_url if team1 else None,
            "team2_name": team2.name if team2 else None,
            "team2_flag": team2.flag_url if team2 else None,
            "exact_winner_pct": KnockoutStatisticsService._pct(exact, total),
            "partial_winner_pct": KnockoutStatisticsService._pct(partial, total),
            "correct_matchup_pct": KnockoutStatisticsService._pct(matchup, total),
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Post Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _count_correct_matchups(predictions, result) -> int:
        """Users who predicted both teams (regardless of order or winner)."""
        if not result.team_1 or not result.team_2:
            return 0
        actual_pair = frozenset([result.team_1, result.team_2])
        return sum(
            1 for p in predictions
            if p.team1_id and p.team2_id
            and frozenset([p.team1_id, p.team2_id]) == actual_pair
        )

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre Helpers
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _calc_top_matchups(db, predictions, total: int, top_n: int = 3) -> List[Dict[str, Any]]:
        """Top N matchups (unordered) with winner distribution per matchup."""
        matchup_counts, matchup_winners = KnockoutStatisticsService._aggregate_matchups(predictions)
        top_pairs = matchup_counts.most_common(top_n)

        # Collect all team IDs needed, fetch in a single query
        all_team_ids = set()
        for pair, _ in top_pairs:
            all_team_ids.update(pair)
        teams_dict = (
            {t.id: t for t in db.query(Team).filter(Team.id.in_(all_team_ids)).all()}
            if all_team_ids
            else {}
        )

        return [
            KnockoutStatisticsService._build_matchup_entry(teams_dict, pair, count, matchup_winners, total)
            for pair, count in top_pairs
        ]

    @staticmethod
    def _aggregate_matchups(predictions):
        """Count matchups and track winner picks per matchup."""
        counts: Counter = Counter()
        winners: Dict = {}

        for p in predictions:
            if not p.team1_id or not p.team2_id:
                continue
            pair = frozenset([p.team1_id, p.team2_id])
            counts[pair] += 1
            if pair not in winners:
                winners[pair] = Counter()
            if p.winner_team_id:
                winners[pair][p.winner_team_id] += 1

        return counts, winners

    @staticmethod
    def _build_matchup_entry(teams_dict: dict, pair, count, matchup_winners, total) -> Dict[str, Any]:
        """Build a single matchup entry for the response."""
        team_ids = list(pair)
        team_a = teams_dict.get(team_ids[0])
        team_b = teams_dict.get(team_ids[1])
        winners = matchup_winners.get(pair, Counter())
        winner_a = winners.get(team_ids[0], 0)
        winner_b = winners.get(team_ids[1], 0)
        decided = winner_a + winner_b  # only predictions with a winner set

        return {
            "team_a": {
                "id": team_ids[0],
                "name": team_a.name if team_a else "Unknown",
                "flag_url": team_a.flag_url if team_a else None,
            },
            "team_b": {
                "id": team_ids[1],
                "name": team_b.name if team_b else "Unknown",
                "flag_url": team_b.flag_url if team_b else None,
            },
            "matchup_pct": KnockoutStatisticsService._pct(count, total),
            "team_a_winner_pct": 50.0 if decided == 0 else KnockoutStatisticsService._pct(winner_a, decided),
            "team_b_winner_pct": 50.0 if decided == 0 else KnockoutStatisticsService._pct(winner_b, decided),
            "winner_decided_pct": KnockoutStatisticsService._pct(decided, count),
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Shared
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pct(count: int, total: int) -> float:
        return round(count / total * 100, 1) if total else 0
