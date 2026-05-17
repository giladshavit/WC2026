"""
Temptation feature: users who pick statistically rare predicted outcomes get 2x points if correct.
"""
from typing import List, Dict, Optional
import random
from sqlalchemy.orm import Session
from collections import Counter

from services.database import DBReader

MIN_PREDICTIONS_FOR_TEMPTATION = 100  # Feature only active when >= 100 predictions exist
LOW_POPULARITY_THRESHOLD = 0.25  # Below 25% is "rare"

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


def _is_draw_prediction(predicted_winner, _match) -> bool:
    """True if prediction is for a draw (predicted_winner is None or 0)."""
    return predicted_winner is None or predicted_winner == 0


def get_temptation_suggestions(db: Session, match_id: int) -> Optional[List[Dict[str, int]]]:
    """
    Returns a list of up to 3 suggested (home_score, away_score) tuples as dicts,
    or None if feature is not available.
    """
    match = DBReader.get_match(db, match_id)
    if not match or not match.home_team_id or not match.away_team_id:
        return None

    predictions = DBReader.get_match_predictions_by_match(db, match_id)
    # Only consider predictions that were actually filled by users
    predictions = [
        p for p in predictions
        if p.home_score is not None and p.away_score is not None
    ]
    total_count = len(predictions)
    if total_count < MIN_PREDICTIONS_FOR_TEMPTATION:
        return None

    # Count predictions per outcome direction
    home_wins = sum(1 for p in predictions if p.predicted_winner == match.home_team_id)
    away_wins = sum(1 for p in predictions if p.predicted_winner == match.away_team_id)
    draws = sum(1 for p in predictions if _is_draw_prediction(p.predicted_winner, match))
    outcome_total = home_wins + away_wins + draws

    if outcome_total == 0:
        return None

    # Compute percentage for each outcome (0% if 0 predictions)
    home_pct = home_wins / outcome_total if outcome_total else 0
    away_pct = away_wins / outcome_total if outcome_total else 0
    draw_pct = draws / outcome_total if outcome_total else 0

    # Build all three outcomes with their data
    def home_filter(p, _hid=match.home_team_id): return p.predicted_winner == _hid
    def away_filter(p, _aid=match.away_team_id): return p.predicted_winner == _aid
    def draw_filter(p): return _is_draw_prediction(p.predicted_winner, None)

    all_outcomes = [
        ("home", home_filter, HOME_WIN_SCORES, home_pct),
        ("away", away_filter, AWAY_WIN_SCORES, away_pct),
        ("draw", draw_filter, DRAW_SCORES, draw_pct),
    ]

    # Sort by percentage ascending (rarest first)
    all_outcomes.sort(key=lambda x: x[3])

    # Always take the rarest outcome (index 0)
    # Take the second rarest (index 1) only if it's also below LOW_POPULARITY_THRESHOLD
    rare_outcomes = [all_outcomes[0]]
    if all_outcomes[1][3] < LOW_POPULARITY_THRESHOLD:
        rare_outcomes.append(all_outcomes[1])
    # Never take index 2 (the most popular outcome)

    # Strip the pct field — loop only uses (name, filter_fn, possible_scores)
    rare_outcomes = [(name, fn, scores) for name, fn, scores, _ in rare_outcomes]

    candidates: List[Dict[str, int]] = []

    for _name, filter_fn, possible_scores in rare_outcomes:
        outcome_predictions = [p for p in predictions if filter_fn(p)]
        outcome_count = len(outcome_predictions)

        if outcome_count == 0:
            # Outcome has 0 predictions: add ALL its possible scores to candidates
            for h, a in possible_scores:
                candidates.append({"home_score": h, "away_score": a})
        else:
            # Among outcome predictions, count each specific score
            score_counts = Counter(
                (p.home_score, p.away_score)
                for p in outcome_predictions
                if p.home_score is not None and p.away_score is not None
            )
            for h, a in possible_scores:
                count = score_counts.get((h, a), 0)
                pct = count / outcome_count
                if pct < LOW_POPULARITY_THRESHOLD:
                    candidates.append({"home_score": h, "away_score": a})

    if not candidates:
        return None

    n = min(3, len(candidates))
    selected = random.sample(candidates, n)
    return selected


def apply_temptation_flag(db: Session, prediction, is_tempted: bool) -> None:
    """Sets prediction.is_tempted = is_tempted and flushes. No commit (caller commits)."""
    prediction.is_tempted = is_tempted
    db.flush()
