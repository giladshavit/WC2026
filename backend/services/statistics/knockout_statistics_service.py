from typing import Dict, Any
from sqlalchemy.orm import Session

from services.database import DBReader


class KnockoutStatisticsService:
    """On-the-fly knockout stage statistics. Read-only."""

    # ═══════════════════════════════════════════════════════
    # PUBLIC
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def get_knockout_match_statistics(db: Session, template_match_id: int) -> Dict[str, Any]:
        total = DBReader.count_knockout_predictions_for_match(db, template_match_id)
        if total == 0:
            return {"template_match_id": template_match_id, "total_predictions": 0}

        result = DBReader.get_knockout_result(db, template_match_id)

        if result and result.winner_team_id:
            return KnockoutStatisticsService._post_result_stats(db, template_match_id, total, result)
        else:
            return KnockoutStatisticsService._pre_result_stats(db, template_match_id, total)

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Pre/Post
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pre_result_stats(db: Session, template_match_id: int, total: int) -> Dict[str, Any]:
        rows = DBReader.get_knockout_top_matchups(db, template_match_id)
        if not rows:
            return {"template_match_id": template_match_id, "has_result": False, "total_predictions": total}

        top_matchups = []
        for r in rows:
            decided = r.decided or 0
            top_matchups.append({
                "team_a": {"id": r.team_a_id, "name": r.team_a_name, "flag_url": r.team_a_flag},
                "team_b": {"id": r.team_b_id, "name": r.team_b_name, "flag_url": r.team_b_flag},
                "matchup_pct":      KnockoutStatisticsService._pct(r.pair_count, total),
                "team_a_winner_pct": 50.0 if decided == 0 else KnockoutStatisticsService._pct(r.winner_a, decided),
                "team_b_winner_pct": 50.0 if decided == 0 else KnockoutStatisticsService._pct(r.winner_b, decided),
                "winner_decided_pct": KnockoutStatisticsService._pct(decided, r.pair_count),
            })

        return {
            "template_match_id": template_match_id,
            "has_result": False,
            "total_predictions": total,
            "top_matchups": top_matchups,
        }

    @staticmethod
    def _post_result_stats(db: Session, template_match_id: int, total: int, result) -> Dict[str, Any]:
        winner_id = result.winner_team_id
        match_obj = DBReader.get_match(db, result.match_id)
        stage_str = match_obj.stage if match_obj else None

        exact   = DBReader.count_knockout_exact_winners(db, template_match_id, winner_id)
        partial = DBReader.count_knockout_winner_in_stage_excluding_match(
            db, stage_str, winner_id, template_match_id
        ) if stage_str else 0
        matchup = DBReader.get_knockout_correct_matchup_count(
            db, template_match_id, result.team_1, result.team_2
        ) if result.team_1 and result.team_2 else 0

        team1        = DBReader.get_team(db, result.team_1)   if result.team_1  else None
        team2        = DBReader.get_team(db, result.team_2)   if result.team_2  else None
        winner_team  = DBReader.get_team(db, winner_id)       if winner_id      else None

        return {
            "template_match_id": template_match_id,
            "has_result": True,
            "total_predictions": total,
            "winner_name":  winner_team.name     if winner_team else None,
            "winner_flag":  winner_team.flag_url if winner_team else None,
            "team1_name":   team1.name           if team1       else None,
            "team1_flag":   team1.flag_url       if team1       else None,
            "team2_name":   team2.name           if team2       else None,
            "team2_flag":   team2.flag_url       if team2       else None,
            "exact_winner_pct":   KnockoutStatisticsService._pct(exact,   total),
            "partial_winner_pct": KnockoutStatisticsService._pct(partial, total),
            "correct_matchup_pct": KnockoutStatisticsService._pct(matchup, total),
        }

    # ═══════════════════════════════════════════════════════
    # PRIVATE - Shared
    # ═══════════════════════════════════════════════════════

    @staticmethod
    def _pct(count: int, total: int) -> float:
        return round(count / total * 100, 1) if total else 0
