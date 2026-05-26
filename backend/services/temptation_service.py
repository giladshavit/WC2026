"""
Temptation feature: users who pick statistically rare predicted outcomes get 2x points if correct.
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from services.database import DBReader

MIN_PREDICTIONS_FOR_TEMPTATION = 100  # Feature only active when >= 100 predictions exist
LOW_POPULARITY_THRESHOLD = 0.25  # Below 25% is "rare"
EXCLUDED_SCORES = {(0, 0), (1, 0), (0, 1), (1, 1)}

# All possible exact scores per outcome type
DRAW_SCORES = [(0, 0), (1, 1), (2, 2), (3, 3)]
# home_win scores: (home, away) where home > away
HOME_WIN_SCORES = [
    (1, 0), (2, 0), (3, 0), (4, 0),
    (2, 1), (3, 1), (4, 1),
    (3, 2), (4, 2),
    (4, 3),
]
# away_win scores: (home, away) where away > home
AWAY_WIN_SCORES = [
    (0, 1), (0, 2), (0, 3), (0, 4),
    (1, 2), (1, 3), (1, 4),
    (2, 3), (2, 4),
    (3, 4),
]


def get_temptation_suggestions(db: Session, match_id: int) -> Optional[List[Dict[str, int]]]:
    """
    Returns a list of up to 3 suggested (home_score, away_score) tuples as dicts,
    or None if feature is not available.
    """
    match = DBReader.get_match(db, match_id)
    if not match or not match.home_team_id or not match.away_team_id:
        return None

    stats = DBReader.get_match_prediction_outcome_stats(
        db, match_id, match.home_team_id, match.away_team_id
    )
    if stats is None or stats["total"] < MIN_PREDICTIONS_FOR_TEMPTATION:
        return None

    all_outcomes = [
        ("home", stats["per_score_home"], HOME_WIN_SCORES, stats["home_pct"], stats["home_wins"]),
        ("away", stats["per_score_away"], AWAY_WIN_SCORES, stats["away_pct"], stats["away_wins"]),
        ("draw", stats["per_score_draw"], DRAW_SCORES, stats["draw_pct"], stats["draws"]),
    ]

    # Sort by percentage ascending (rarest first)
    all_outcomes.sort(key=lambda x: x[3])

    rare_outcomes = [all_outcomes[0]]
    if all_outcomes[1][3] < LOW_POPULARITY_THRESHOLD:
        rare_outcomes.append(all_outcomes[1])

    candidates: List[Tuple[float, Dict[str, int]]] = []
    total = stats["total"]

    for _name, score_counter, possible_scores, _pct, outcome_count in rare_outcomes:
        if outcome_count == 0:
            for h, a in possible_scores:
                if (h, a) in EXCLUDED_SCORES:
                    continue
                count = score_counter.get((h, a), 0)
                probability = count / total
                candidates.append((probability, {"home_score": h, "away_score": a}))
        else:
            for h, a in possible_scores:
                if (h, a) in EXCLUDED_SCORES:
                    continue
                count = score_counter.get((h, a), 0)
                pct = count / outcome_count
                if pct < LOW_POPULARITY_THRESHOLD:
                    probability = count / total
                    candidates.append((probability, {"home_score": h, "away_score": a}))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    return [score for _, score in candidates[:3]]


def apply_temptation_flag(db: Session, prediction, is_tempted: bool) -> None:
    """Sets prediction.is_tempted = is_tempted and flushes. No commit (caller commits)."""
    prediction.is_tempted = is_tempted
    db.flush()
