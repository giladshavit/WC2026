"""
test_data_service.py
Generates fake users with randomized predictions for load/UI testing.
"""
import random
import string
from typing import List
from sqlalchemy.orm import Session

from services.auth_service import AuthService
from services.database import DBReader, DBWriter, DBUtils

# ── Score Distribution ──────────────────────────────────────────
# Goals scored per team per match, weighted distribution:
# 0→25%, 1→20%, 2→15%, 3→13%, 4→10%, 5→7%, 6→6%, 7→4%
GOAL_WEIGHTS = [25, 20, 15, 13, 10, 7, 6, 4]
GOAL_VALUES = [0, 1, 2, 3, 4, 5, 6, 7]


def _random_goals() -> int:
    """Return a random goals count using the weighted distribution."""
    return random.choices(GOAL_VALUES, weights=GOAL_WEIGHTS, k=1)[0]


# ── User Creation ────────────────────────────────────────────────

def _generate_username() -> str:
    """Generate a unique-ish test username like 'bot_x7k2'."""
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"bot_{suffix}"


def _create_single_user(db: Session) -> int:
    """
    Register one test user via AuthService.register_user().
    AuthService.register_user() already handles:
      - user row creation
      - group predictions (empty)
      - third place predictions (empty)
      - knockout predictions (empty, 63 rows)
    Returns user_id.
    """
    username = _generate_username()
    password = "testpass123"
    name = f"Test User {username}"
    result = AuthService.register_user(db, username, password, name)
    return result["user_id"]


def create_test_users(db: Session, count: int = 50) -> List[int]:
    """Create `count` test users. Returns list of user_ids."""
    user_ids: List[int] = []
    max_attempts = count * 3
    attempts = 0
    while len(user_ids) < count and attempts < max_attempts:
        attempts += 1
        try:
            user_id = _create_single_user(db)
            user_ids.append(user_id)
        except Exception:
            continue
    return user_ids


# ── Match Predictions ────────────────────────────────────────────

DRAW_SCORES = [(0, 0), (1, 1), (2, 2), (3, 3)]


def _fill_match_predictions_draws_only_for_user(db: Session, user_id: int) -> None:
    """
    For every group-stage match, set a draw prediction:
    predicted_winner = None (draw), scores randomly from [(0,0), (1,1), (2,2), (3,3)].
    """
    predictions = DBReader.get_match_predictions_by_user(db, user_id)
    for pred in predictions:
        match = pred.match
        if not match or not match.home_team_id or not match.away_team_id:
            continue
        home_score, away_score = random.choice(DRAW_SCORES)
        DBWriter.update_match_prediction(
            db, pred,
            home_score=home_score,
            away_score=away_score,
            predicted_winner=0  # draw: 0 means draw, None means no prediction
        )
    DBUtils.commit(db)


def _fill_match_predictions_for_user(db: Session, user_id: int) -> None:
    """
    For every group-stage match, set a random score for each team
    using _random_goals(). Use DBWriter directly.
    """
    predictions = DBReader.get_match_predictions_by_user(db, user_id)
    for pred in predictions:
        match = pred.match
        if not match or not match.home_team_id or not match.away_team_id:
            continue
        home_score = _random_goals()
        away_score = _random_goals()
        predicted_winner = (
            match.home_team_id if home_score > away_score
            else match.away_team_id if away_score > home_score
            else None
        )
        DBWriter.update_match_prediction(
            db, pred,
            home_score=home_score,
            away_score=away_score,
            predicted_winner=predicted_winner
        )
    DBUtils.commit(db)


# ── Group Predictions ────────────────────────────────────────────

def _fill_group_predictions_for_user(db: Session, user_id: int) -> None:
    """
    For every group, randomly shuffle the 4 teams and assign positions
    1st/2nd/3rd/4th. Uses GroupPredictionService.update_group_prediction_places
    so cascade into knockout slots fires correctly.
    """
    from services.predictions.group_prediction_service import GroupPredictionService
    from services.predictions.shared import PlacesPredictions

    groups = DBReader.get_groups_ordered(db)
    for group in groups:
        teams = [group.team_1, group.team_2, group.team_3, group.team_4]
        teams = [t for t in teams if t is not None]
        if len(teams) != 4:
            continue
        shuffled = teams.copy()
        random.shuffle(shuffled)
        places = PlacesPredictions(
            first_place=shuffled[0],
            second_place=shuffled[1],
            third_place=shuffled[2],
            fourth_place=shuffled[3]
        )
        GroupPredictionService.update_group_prediction_places(
            db, user_id, group.id, places
        )


# ── Third Place Predictions ──────────────────────────────────────

def _pick_third_place_advancing(db: Session, user_id: int) -> None:
    """
    After group predictions are filled, the user has 12 third-place teams.
    Randomly select 8 of them as advancing.
    Uses ThirdPlacePredictionService.create_or_update_third_place_prediction.
    """
    from services.predictions.third_place_prediction_service import ThirdPlacePredictionService

    group_preds = DBReader.get_group_predictions_by_user(db, user_id)
    third_place_teams = [p.third_place for p in group_preds if p.third_place]
    if len(third_place_teams) < 8:
        return
    advancing = random.sample(third_place_teams, 8)
    ThirdPlacePredictionService.create_or_update_third_place_prediction(
        db, user_id, advancing
    )


# ── Knockout Predictions ─────────────────────────────────────────

def _fill_knockout_predictions_for_user(db: Session, user_id: int) -> None:
    """
    Walk through knockout stages in order:
      round32 → round16 → quarter → semi → final
    For each match, randomly pick one of the two available teams as winner.
    Uses KnockoutService.update_knockout_prediction so cascade fires correctly.
    """
    from services.predictions.knockout_service import KnockoutService

    stages = ["round32", "round16", "quarter", "semi", "final"]
    for stage in stages:
        predictions = DBReader.get_knockout_predictions_by_user(
            db, user_id, stage=stage, is_draft=False
        )
        for pred in predictions:
            team1_id = pred.team1_id if pred.team1_id else 0
            team2_id = pred.team2_id if pred.team2_id else 0
            if not team1_id and not team2_id:
                continue
            if team1_id and team2_id:
                winner_id = random.choice([team1_id, team2_id])
            else:
                winner_id = team1_id or team2_id
            KnockoutService.update_knockout_prediction(
                db, pred, winner_team_id=winner_id
            )
        DBUtils.commit(db)


# ── Orchestrator ─────────────────────────────────────────────────

def fill_draw_predictions_for_user(db: Session, user_id: int) -> None:
    """
    Fill all predictions for a single user with DRAW match predictions only.
    Match predictions: draws only (scores from 0-0, 1-1, 2-2, 3-3).
    Group, third place, knockout: same as random (unchanged).
    """
    try:
        _fill_match_predictions_draws_only_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _fill_group_predictions_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _pick_third_place_advancing(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _fill_knockout_predictions_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)


def fill_random_predictions_for_user(db: Session, user_id: int) -> None:
    """
    Fill all predictions for a single user in the correct order:
    1. Match predictions (independent)
    2. Group predictions (triggers knockout cascade)
    3. Third place picks (triggers knockout cascade)
    4. Knockout winners (stage by stage)
    Wrap each step in try/except so one failure doesn't abort others.
    """
    try:
        _fill_match_predictions_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _fill_group_predictions_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _pick_third_place_advancing(db, user_id)
    except Exception:
        DBUtils.rollback(db)
    try:
        _fill_knockout_predictions_for_user(db, user_id)
    except Exception:
        DBUtils.rollback(db)


def generate_test_users_with_predictions(db: Session, count: int = 50) -> dict:
    """
    Main entry point. Creates users + fills their predictions.
    Returns a summary dict: {created, predictions_filled, errors}
    """
    created = 0
    predictions_filled = 0
    errors = 0

    user_ids = create_test_users(db, count)
    created = len(user_ids)

    for user_id in user_ids:
        try:
            fill_random_predictions_for_user(db, user_id)
            predictions_filled += 1
        except Exception:
            errors += 1
            DBUtils.rollback(db)
            continue

    return {
        "created": created,
        "predictions_filled": predictions_filled,
        "errors": errors,
    }


def generate_test_users_with_draw_predictions(db: Session, count: int = 50) -> dict:
    """
    Creates users + fills their match predictions with draws only.
    Match predictions: all draws (0-0, 1-1, 2-2, 3-3).
    Group, third place, knockout: same as random variant.
    Returns a summary dict: {created, predictions_filled, errors}
    """
    created = 0
    predictions_filled = 0
    errors = 0

    user_ids = create_test_users(db, count)
    created = len(user_ids)

    for user_id in user_ids:
        try:
            fill_draw_predictions_for_user(db, user_id)
            predictions_filled += 1
        except Exception:
            errors += 1
            DBUtils.rollback(db)
            continue

    return {
        "created": created,
        "predictions_filled": predictions_filled,
        "errors": errors,
    }
