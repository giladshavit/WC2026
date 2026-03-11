"""
BonusService — backward-compatibility re-export.
All logic lives in BonusPredictionService.
"""
from services.predictions.bonus_prediction_service import BonusPredictionService

# Alias — all callers can use BonusService.X or BonusPredictionService.X interchangeably
BonusService = BonusPredictionService

BONUS_FIELD_MAP = {
    k: (v[0], v[1])
    for k, v in BonusPredictionService.QUESTION_FIELD_MAP.items()
}
