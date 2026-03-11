"""
BonusService — compatibility shim.
All logic has moved to BonusPredictionService.
This file exists only to avoid breaking existing imports.
"""
from sqlalchemy.orm import Session

from services.predictions.bonus_prediction_service import BonusPredictionService

# Re-export for api/bonus.py (field_key → (prediction_field, status_field))
BONUS_FIELD_MAP = {
    k: (v[0], v[1])
    for k, v in BonusPredictionService.QUESTION_FIELD_MAP.items()
}


class BonusService(BonusPredictionService):
    """Alias for backward compatibility. Use BonusPredictionService directly."""

    @staticmethod
    def settle_bonus_question(db: Session, field_key: str, correct_values: list[str], force: bool = False) -> dict:
        """Delegate to ResultsService for consistency with other result flows."""
        from services.results_service import ResultsService
        return ResultsService.settle_bonus_question(db, field_key, correct_values, force)
