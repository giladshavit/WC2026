"""
Prediction services module.

Contains specialized services for different types of predictions:
- MatchPredictionService: Group stage match predictions
- GroupPredictionService: Group stage standings predictions
- ThirdPlacePredictionService: Third place qualifying teams predictions
- KnockoutService: Knockout stage predictions

All services use DBReader/DBWriter/DBUtils for database operations.
"""

from .shared import PlacesPredictions
from .enums import KnockoutPredictionStatus, PredictionType


def __getattr__(name: str):
    """Lazy-load services that depend on database to avoid circular imports."""
    if name == "MatchPredictionService":
        from .match_prediction_service import MatchPredictionService
        return MatchPredictionService
    if name == "GroupPredictionService":
        from .group_prediction_service import GroupPredictionService
        return GroupPredictionService
    if name == "ThirdPlacePredictionService":
        from .third_place_prediction_service import ThirdPlacePredictionService
        return ThirdPlacePredictionService
    if name == "KnockoutService":
        from .knockout_service import KnockoutService
        return KnockoutService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def _get_prediction_services():
    """Load all prediction services (used by PredictionService)."""
    from .match_prediction_service import MatchPredictionService
    from .group_prediction_service import GroupPredictionService
    from .third_place_prediction_service import ThirdPlacePredictionService
    from .knockout_service import KnockoutService
    from services.database import DBWriter
    return MatchPredictionService, GroupPredictionService, ThirdPlacePredictionService, KnockoutService, DBWriter


# Backward compatibility - create a unified interface
class PredictionService:
    """
    Unified interface for backward compatibility.
    Delegates to specialized services. Loads services lazily to avoid circular imports.
    """
    _services = None

    @classmethod
    def _load(cls):
        if cls._services is None:
            cls._services = _get_prediction_services()
        return cls._services

    @classmethod
    def create_or_update_match_prediction(cls, *args, **kwargs):
        return cls._load()[0].create_or_update_match_prediction(*args, **kwargs)

    @classmethod
    def create_or_update_batch_predictions(cls, *args, **kwargs):
        return cls._load()[0].create_or_update_batch_predictions(*args, **kwargs)

    @classmethod
    def update_group_prediction_places(cls, *args, **kwargs):
        return cls._load()[1].update_group_prediction_places(*args, **kwargs)

    @classmethod
    def get_group_predictions(cls, *args, **kwargs):
        return cls._load()[1].get_group_predictions(*args, **kwargs)

    @classmethod
    def create_or_update_batch_group_predictions(cls, *args, **kwargs):
        return cls._load()[1].create_or_update_batch_group_predictions(*args, **kwargs)

    @classmethod
    def create_or_update_third_place_prediction(cls, *args, **kwargs):
        return cls._load()[2].create_or_update_third_place_prediction(*args, **kwargs)

    @classmethod
    def get_third_place_predictions_data(cls, *args, **kwargs):
        return cls._load()[2].get_third_place_predictions_data(*args, **kwargs)

    @classmethod
    def get_knockout_predictions(cls, *args, **kwargs):
        return cls._load()[3].get_knockout_predictions(*args, **kwargs)

    @classmethod
    def update_knockout_prediction_winner(cls, *args, **kwargs):
        return cls._load()[3].update_knockout_prediction_by_id(*args, **kwargs)

    @classmethod
    def update_batch_knockout_predictions(cls, *args, **kwargs):
        return cls._load()[3].update_batch_knockout_predictions(*args, **kwargs)

    @classmethod
    def create_draft_from_prediction(cls, *args, **kwargs):
        return cls._load()[3].create_draft_from_prediction(*args, **kwargs)

    @classmethod
    def create_all_drafts_from_predictions(cls, *args, **kwargs):
        return cls._load()[3].create_all_drafts_from_predictions(*args, **kwargs)

    @classmethod
    def delete_all_drafts_for_user(cls, *args, **kwargs):
        return cls._load()[3].delete_all_drafts_for_user(*args, **kwargs)

    @classmethod
    def count_draft_changes(cls, *args, **kwargs):
        return cls._load()[3].count_draft_changes(*args, **kwargs)

    @classmethod
    def commit_drafts(cls, *args, **kwargs):
        return cls._load()[3].commit_drafts(*args, **kwargs)

    @classmethod
    def reset_drafts(cls, *args, **kwargs):
        return cls._load()[3].reset_drafts(*args, **kwargs)

    @classmethod
    def _copy_draft_to_prediction(cls, *args, **kwargs):
        return cls._load()[3]._copy_draft_to_prediction(*args, **kwargs)

    @classmethod
    def set_status(cls, *args, **kwargs):
        return cls._load()[4].set_prediction_status(*args, **kwargs)

__all__ = [
    'PredictionService',
    'MatchPredictionService',
    'GroupPredictionService',
    'ThirdPlacePredictionService',
    'KnockoutService',
    'KnockoutPredictionStatus',
    'PredictionType',
    'PlacesPredictions',
]

