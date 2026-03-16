"""Bonus prediction service - handles get/create, update, settle, and answer checking."""
import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
from fastapi import HTTPException

from services.database import DBReader, DBWriter, DBUtils
from services.scoring_service import ScoringService
from services.predictions.enums import (
    PredictionType,
    BonusSectionStatus,
)
from models.predictions import BonusPrediction
from models.user_scores import UserScores

POINTS_PER_CORRECT_ANSWER = 8

BONUS_POINTS_PER_QUESTION = 8


@dataclass
class BonusGroupActual:
    total_goals_group: int
    top_group_id: int
    top_team_id: int
    perfect_teams_count: int
    clean_sheet_teams_count: int
    scoreless_draws_group: int | None = None


@dataclass
class BonusKnockoutActual:
    total_goals_knockout: int
    penalty_shootouts: int
    third_place_quarters: int


@dataclass
class BonusTournamentActual:
    total_goals_tournament: int
    scoreless_draws: int


def _parse_range(enum_val: str) -> tuple:
    """Parse enum value like 'under_30', '30_39', '80_plus', '5_plus', '0' into (min, max) or (None, max) or (min, None)."""
    if not enum_val:
        return (None, None)
    if enum_val.startswith("under_"):
        try:
            x = int(enum_val.split("_")[1])
            return (None, x - 1)  # actual < x
        except (IndexError, ValueError):
            return (None, None)
    if "_plus" in enum_val or enum_val.endswith("_plus"):
        try:
            x = int(enum_val.replace("_plus", "").split("_")[0])
            return (x, None)  # actual >= x
        except (ValueError, IndexError):
            return (None, None)
    parts = enum_val.split("_")
    if len(parts) >= 2:
        try:
            lo = int(parts[0])
            hi = int(parts[1])
            return (lo, hi)
        except ValueError:
            pass
    if len(parts) == 1 and parts[0].isdigit():
        try:
            v = int(parts[0])
            return (v, v)  # exact match
        except ValueError:
            pass
    return (None, None)


class BonusPredictionService:
    # Maps field_key → (prediction_answer_field, status_field, is_int_fk)
    # is_int_fk=True means the prediction stores an Integer FK (must str() before comparing)
    QUESTION_FIELD_MAP: dict[str, tuple[str, str, bool]] = {
        "g1": ("g1_total_goals_group", "q_g1_status", False),
        "g2": ("g2_top_group_id", "q_g2_status", True),
        "g3": ("g3_top_team_id", "q_g3_status", True),
        "g4": ("g4_perfect_teams", "q_g4_status", False),
        "g5": ("g5_clean_sheet_teams", "q_g5_status", False),
        "g6": ("g6_scoreless_draws_group", "q_g6_status", False),
        "k1": ("k1_total_goals_knockout", "q_k1_status", False),
        "k2": ("k2_penalty_shootouts", "q_k2_status", False),
        "k3": ("k3_third_place_quarters", "q_k3_status", False),
        "t1": ("t1_total_goals_tournament", "q_t1_status", False),
        "t2": ("t2_champion_team_id", "q_t2_status", True),
        "t3": ("t3_top_scorer", "q_t3_status", False),
    }

    # field_key → (prediction_field, status_field) for api/bonus.py
    BONUS_FIELD_MAP = {k: (v[0], v[1]) for k, v in QUESTION_FIELD_MAP.items()}

    @staticmethod
    def get_or_create_bonus_prediction(db: Session, user_id: int) -> BonusPrediction:
        pred = DBReader.get_bonus_prediction(db, user_id)
        if pred:
            return pred
        pred = DBWriter.create_bonus_prediction(db, user_id)
        DBUtils.commit(db)
        return pred

    @staticmethod
    def _check_range_answer(user_answer: Optional[str], actual_value: int) -> bool:
        """Check if actual_value falls within the user's chosen range bucket."""
        if not user_answer:
            return False
        lo, hi = _parse_range(user_answer)
        if lo is not None and hi is not None:
            return lo <= actual_value <= hi
        if lo is not None:
            return actual_value >= lo
        if hi is not None:
            return actual_value <= hi
        return False

    @staticmethod
    def _check_exact_answer(user_answer: Optional[str], actual_value: int) -> bool:
        """For K3 and similar: compare str(actual_value) == user_answer."""
        if not user_answer:
            return False
        return str(actual_value) == str(user_answer)

    @staticmethod
    def set_correct_value(db: Session, field_key: str, values: list[str]) -> None:
        """Persist correct answer for a field to bonus_results table."""
        from models.results import BonusResults
        row = db.query(BonusResults).filter_by(id=1).first()
        if not row:
            row = BonusResults(id=1)
            db.add(row)
        col = f"{field_key}_correct"
        setattr(row, col, ",".join(str(v) for v in values))
        db.flush()

    @staticmethod
    def get_correct_values_dict(db: Session) -> dict[str, str | None]:
        """Read all correct answers from bonus_results table."""
        from models.results import BonusResults
        fields = ["g1", "g2", "g3", "g4", "g5", "g6", "k1", "k2", "k3", "t1", "t2", "t3"]
        row = db.query(BonusResults).filter_by(id=1).first()
        if not row:
            return {f: None for f in fields}
        return {f: getattr(row, f"{f}_correct", None) for f in fields}

    @staticmethod
    def _field_to_section(field: str) -> str:
        if field.startswith("g"):
            return "groups"
        if field.startswith("k"):
            return "knockout"
        if field.startswith("t"):
            return "tournament"
        return "groups"

    @staticmethod
    def update_bonus_prediction(
        db: Session,
        user_id: int,
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        pred = DBReader.get_bonus_prediction(db, user_id)
        if not pred:
            pred = BonusPredictionService.get_or_create_bonus_prediction(db, user_id)

        section_editable = {
            "groups": pred.groups_is_editable,
            "knockout": pred.knockout_is_editable,
            "tournament": pred.tournament_is_editable,
        }

        for field, value in updates.items():
            section = BonusPredictionService._field_to_section(field)
            if not section_editable.get(section, True):
                raise HTTPException(
                    status_code=403,
                    detail=f"Section {section} is no longer editable",
                )

        n_changes = 0
        for field, value in updates.items():
            old = getattr(pred, field, None)
            if old != value:
                n_changes += 1

        if n_changes == 0:
            return BonusPredictionService._to_response(pred, db)

        penalty = 0
        if n_changes > 0:
            penalty = ScoringService.record_prediction_penalty(
                db,
                user_id=user_id,
                prediction_id=pred.id,
                prediction_type=PredictionType.BONUS,
                n_changes=n_changes,
            )

        # Coerce types for FK fields (client may send strings from dropdowns)
        int_fields = {"g2_top_group_id", "g3_top_team_id", "t2_champion_team_id"}
        update_kwargs = {}
        for k, v in updates.items():
            if not hasattr(pred, k):
                continue
            if k in int_fields and v is not None:
                try:
                    update_kwargs[k] = int(v) if v != "" else None
                except (ValueError, TypeError):
                    update_kwargs[k] = v
            else:
                update_kwargs[k] = v
        if update_kwargs:
            DBWriter.update_bonus_prediction(db, pred, **update_kwargs)

        DBUtils.commit(db)
        DBUtils.refresh(db, pred)
        result = BonusPredictionService._to_response(pred, db)
        result["penalty_applied"] = penalty
        return result

    BONUS_FIELD_KEYS = ["g1", "g2", "g3", "g4", "g5", "g6", "k1", "k2", "k3", "t1", "t2", "t3"]

    @staticmethod
    def _to_response(pred: BonusPrediction, db: Session) -> Dict[str, Any]:
        correct_values = BonusPredictionService.get_correct_values_dict(db)
        interim_values = DBReader.get_bonus_interim_values_dict(db)
        return {
            "id": pred.id,
            "user_id": pred.user_id,
            "g1_total_goals_group": pred.g1_total_goals_group,
            "g2_top_group_id": pred.g2_top_group_id,
            "g3_top_team_id": pred.g3_top_team_id,
            "g4_perfect_teams": pred.g4_perfect_teams,
            "g5_clean_sheet_teams": pred.g5_clean_sheet_teams,
            "g6_scoreless_draws_group": pred.g6_scoreless_draws_group,
            "k1_total_goals_knockout": pred.k1_total_goals_knockout,
            "k2_penalty_shootouts": pred.k2_penalty_shootouts,
            "k3_third_place_quarters": pred.k3_third_place_quarters,
            "t1_total_goals_tournament": pred.t1_total_goals_tournament,
            # Deprecated legacy field kept for backward compatibility
            "t2_scoreless_draws": pred.t2_scoreless_draws,
            "t2_champion_team_id": pred.t2_champion_team_id,
            "t3_top_scorer": pred.t3_top_scorer,
            "penalty_points": pred.penalty_points or 0,
            "changes_count": pred.changes_count or 0,
            "groups_is_editable": pred.groups_is_editable,
            "knockout_is_editable": pred.knockout_is_editable,
            "tournament_is_editable": pred.tournament_is_editable,
            "groups_status": pred.groups_status or "pending",
            "knockout_status": pred.knockout_status or "pending",
            "tournament_status": pred.tournament_status or "pending",
            "bonus_score": getattr(pred, "bonus_score", 0) or 0,
            "q_g1_status": getattr(pred, "q_g1_status", "pending") or "pending",
            "q_g2_status": getattr(pred, "q_g2_status", "pending") or "pending",
            "q_g3_status": getattr(pred, "q_g3_status", "pending") or "pending",
            "q_g4_status": getattr(pred, "q_g4_status", "pending") or "pending",
            "q_g5_status": getattr(pred, "q_g5_status", "pending") or "pending",
            "q_g6_status": getattr(pred, "q_g6_status", "pending") or "pending",
            "q_k1_status": getattr(pred, "q_k1_status", "pending") or "pending",
            "q_k2_status": getattr(pred, "q_k2_status", "pending") or "pending",
            "q_k3_status": getattr(pred, "q_k3_status", "pending") or "pending",
            "q_t1_status": getattr(pred, "q_t1_status", "pending") or "pending",
            "q_t2_status": getattr(pred, "q_t2_status", "pending") or "pending",
            "q_t3_status": getattr(pred, "q_t3_status", "pending") or "pending",
            "correct_values": correct_values,
            "interim_values": interim_values,
        }

    @staticmethod
    def settle_bonus_question(
        db: Session,
        field_key: str,
        correct_values: list[str],
        force: bool = False,
    ) -> dict:
        """
        Grade all users' BonusPrediction rows for one bonus question.
        Updates every prediction that has a non-null answer for this field.
        No skipping based on current status — always re-grades everyone.
        """
        POINTS = 8
        CORRECT = "correct"
        WRONG = "wrong"
        PENDING = "pending"

        ALL_STATUS_FIELDS = [
            "q_g1_status", "q_g2_status", "q_g3_status", "q_g4_status", "q_g5_status", "q_g6_status",
            "q_k1_status", "q_k2_status", "q_k3_status",
            "q_t1_status", "q_t2_status", "q_t3_status",
        ]

        entry = BonusPredictionService.QUESTION_FIELD_MAP.get(field_key)
        if not entry:
            logger.warning("settle_bonus_question: unknown field_key=%s", field_key)
            return {
                "field_key": field_key,
                "correct_value": ",".join(str(v) for v in correct_values),
                "correct": 0, "incorrect": 0,
            }

        answer_field, status_field, _is_int_fk = entry
        correct_set = {str(v) for v in correct_values}

        predictions = db.query(BonusPrediction).all()

        correct_count = 0
        wrong_count = 0

        for pred in predictions:
            user_answer = getattr(pred, answer_field, None)

            # No answer → set to pending, skip scoring
            if user_answer is None:
                setattr(pred, status_field, PENDING)
                continue

            # Determine correct/wrong
            new_status = CORRECT if str(user_answer) in correct_set else WRONG

            # Calculate delta vs current status (normalize legacy "incorrect" → "wrong")
            raw_current = getattr(pred, status_field, None) or PENDING
            current = WRONG if raw_current == "incorrect" else raw_current
            old_points = POINTS if current == CORRECT else 0
            new_points = POINTS if new_status == CORRECT else 0
            delta = new_points - old_points

            # Write new status
            setattr(pred, status_field, new_status)

            # Recompute absolute bonus_score AFTER setting new status
            new_bonus_score = sum(
                POINTS
                for sf in ALL_STATUS_FIELDS
                if (getattr(pred, sf, None) or "") == CORRECT
            )
            pred.bonus_score = new_bonus_score

            # Apply delta to UserScores only if changed
            if delta != 0:
                ScoringService._apply_score_delta(db, pred.user_id, "bonus_score", delta)

            if new_status == CORRECT:
                correct_count += 1
            else:
                wrong_count += 1

        # Flush all status + bonus_score changes at once
        db.flush()

        # Save correct answer to BonusResults table
        BonusPredictionService.set_correct_value(db, field_key, correct_values)

        DBUtils.commit(db)

        return {
            "field_key": field_key,
            "correct_value": ",".join(str(v) for v in correct_values),
            "correct": correct_count,
            "incorrect": wrong_count,
            "skipped_already_settled": 0,  # Always re-grades; kept for API compatibility
        }

    @staticmethod
    def settle_group_questions(db: Session, actual: BonusGroupActual) -> Dict[str, Any]:
        predictions = DBReader.get_all_bonus_predictions(db)
        updated = 0
        for pred in predictions:
            correct = 0
            if BonusPredictionService._check_range_answer(
                pred.g1_total_goals_group, actual.total_goals_group
            ):
                correct += 1
            if pred.g2_top_group_id == actual.top_group_id:
                correct += 1
            if pred.g3_top_team_id == actual.top_group_id:
                correct += 1
            if BonusPredictionService._check_range_answer(
                pred.g4_perfect_teams, actual.perfect_teams_count
            ):
                correct += 1
            if BonusPredictionService._check_range_answer(
                pred.g5_clean_sheet_teams, actual.clean_sheet_teams_count
            ):
                correct += 1
            if actual.scoreless_draws_group is not None and BonusPredictionService._check_range_answer(
                pred.g6_scoreless_draws_group, actual.scoreless_draws_group
            ):
                correct += 1
            if correct > 0:
                points = correct * POINTS_PER_CORRECT_ANSWER
                ScoringService._apply_score_delta(db, pred.user_id, "bonus_score", points)
                updated += 1
            DBWriter.update_bonus_prediction(
                db, pred,
                points=(pred.points or 0) + correct * POINTS_PER_CORRECT_ANSWER,
                groups_status=BonusSectionStatus.SETTLED.value,
                groups_is_editable=False,
            )
        DBUtils.commit(db)
        return {"updated_users": updated, "message": "Group bonus questions settled"}

    @staticmethod
    def settle_knockout_questions(db: Session, actual: BonusKnockoutActual) -> Dict[str, Any]:
        predictions = DBReader.get_all_bonus_predictions(db)
        updated = 0
        for pred in predictions:
            correct = 0
            if BonusPredictionService._check_range_answer(
                pred.k1_total_goals_knockout, actual.total_goals_knockout
            ):
                correct += 1
            if BonusPredictionService._check_range_answer(
                pred.k2_penalty_shootouts, actual.penalty_shootouts
            ):
                correct += 1
            if BonusPredictionService._check_exact_answer(
                pred.k3_third_place_quarters, actual.third_place_quarters
            ):
                correct += 1
            if correct > 0:
                points = correct * POINTS_PER_CORRECT_ANSWER
                ScoringService._apply_score_delta(db, pred.user_id, "bonus_score", points)
                updated += 1
            DBWriter.update_bonus_prediction(
                db, pred,
                points=(pred.points or 0) + correct * POINTS_PER_CORRECT_ANSWER,
                knockout_status=BonusSectionStatus.SETTLED.value,
                knockout_is_editable=False,
            )
        DBUtils.commit(db)
        return {"updated_users": updated, "message": "Knockout bonus questions settled"}

    @staticmethod
    def settle_tournament_questions(db: Session, actual: BonusTournamentActual) -> Dict[str, Any]:
        predictions = DBReader.get_all_bonus_predictions(db)
        updated = 0
        for pred in predictions:
            correct = 0
            if BonusPredictionService._check_range_answer(
                pred.t1_total_goals_tournament, actual.total_goals_tournament
            ):
                correct += 1
            if BonusPredictionService._check_range_answer(
                pred.t2_scoreless_draws, actual.scoreless_draws
            ):
                correct += 1
            if correct > 0:
                points = correct * POINTS_PER_CORRECT_ANSWER
                ScoringService._apply_score_delta(db, pred.user_id, "bonus_score", points)
                updated += 1
            DBWriter.update_bonus_prediction(
                db, pred,
                points=(pred.points or 0) + correct * POINTS_PER_CORRECT_ANSWER,
                tournament_status=BonusSectionStatus.SETTLED.value,
                tournament_is_editable=False,
            )
        DBUtils.commit(db)
        return {"updated_users": updated, "message": "Tournament bonus questions settled"}

    @staticmethod
    def get_options(db: Session) -> Dict[str, List[Dict[str, str]]]:
        """Return all enum options for UI dropdowns. G2/G3 need DB data."""
        groups = DBReader.get_all_groups(db)
        teams = DBReader.get_all_teams(db)

        def g1_labels():
            return [
                {"value": "under_120", "label": "0–119"},
                {"value": "120_139", "label": "120–139"},
                {"value": "140_159", "label": "140–159"},
                {"value": "160_179", "label": "160–179"},
                {"value": "180_199", "label": "180–199"},
                {"value": "200_plus", "label": "200+"},
            ]

        def g2_labels():
            return [{"value": str(g.id), "label": f"Group {g.name}"} for g in groups]

        def g3_labels():
            return [{"value": str(t.id), "label": t.name} for t in teams]

        return {
            "g1": g1_labels(),
            "g2": g2_labels(),
            "g3": g3_labels(),
            "g4": [
                {"value": "0", "label": "0"},
                {"value": "1", "label": "1"},
                {"value": "2", "label": "2"},
                {"value": "3", "label": "3"},
                {"value": "4", "label": "4"},
                {"value": "5_plus", "label": "5+"},
            ],
            "g5": [
                {"value": "0", "label": "0"},
                {"value": "1", "label": "1"},
                {"value": "2", "label": "2"},
                {"value": "3", "label": "3"},
                {"value": "4", "label": "4"},
                {"value": "5_plus", "label": "5+"},
            ],
            "g6": [
                {"value": "0_2", "label": "0–2"},
                {"value": "3_4", "label": "3–4"},
                {"value": "5_6", "label": "5–6"},
                {"value": "7_8", "label": "7–8"},
                {"value": "9_10", "label": "9–10"},
                {"value": "11_plus", "label": "11+"},
            ],
            "k1": [
                {"value": "under_30", "label": "0-29"},
                {"value": "30_39", "label": "30–39"},
                {"value": "40_49", "label": "40–49"},
                {"value": "50_59", "label": "50–59"},
                {"value": "60_69", "label": "60–69"},
                {"value": "70_79", "label": "70–79"},
                {"value": "80_plus", "label": "80+"},
            ],
            "k2": [
                {"value": "0_3", "label": "0–3"},
                {"value": "4_5", "label": "4–5"},
                {"value": "6_7", "label": "6–7"},
                {"value": "8_9", "label": "8–9"},
                {"value": "10_11", "label": "10–11"},
                {"value": "12_plus", "label": "12+"},
            ],
            "k3": [{"value": str(i), "label": str(i)} for i in range(9)],
            "t1": [
                {"value": "under_160", "label": "0-159"},
                {"value": "160_189", "label": "160–189"},
                {"value": "190_219", "label": "190–219"},
                {"value": "220_249", "label": "220–249"},
                {"value": "250_280", "label": "250–280"},
                {"value": "280_plus", "label": "280+"},
            ],
            # t2 (champion) options are dynamic team list, similar to g3
            "t2": [{"value": str(t.id), "label": t.name} for t in teams],
            "t3": [
                {"value": "messi", "label": "Lionel Messi", "flag": "ar"},
                {"value": "ronaldo", "label": "Cristiano Ronaldo", "flag": "pt"},
                {"value": "mbappe", "label": "Kylian Mbappé", "flag": "fr"},
                {"value": "haaland", "label": "Erling Haaland", "flag": "no"},
                {"value": "neymar", "label": "Neymar Jr.", "flag": "br"},
                {"value": "kane", "label": "Harry Kane", "flag": "gb-eng"},
                {"value": "vinicius", "label": "Vinícius Jr.", "flag": "br"},
                {"value": "salah", "label": "Mohamed Salah", "flag": "eg"},
                {"value": "bellingham", "label": "Jude Bellingham", "flag": "gb-eng"},
                {"value": "pedri", "label": "Pedri", "flag": "es"},
                {"value": "other", "label": "Other", "flag": None},
            ],
        }
