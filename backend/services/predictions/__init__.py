"""
Prediction services module - refactored from single prediction_service.py

This module contains specialized services for different types of predictions:
- MatchPredictionService: Group stage match predictions
- GroupPredictionService: Group stage standings predictions
- ThirdPlacePredictionService: Third place qualifying teams predictions
- KnockoutPredictionService: Knockout stage predictions

All services use PredictionRepository for database operations.
"""

from .match_prediction_service import MatchPredictionService
from .group_prediction_service import GroupPredictionService
from .third_place_prediction_service import ThirdPlacePredictionService
from .knockout_prediction_service import KnockoutPredictionService
from .prediction_repository import PredictionRepository
from .shared import PredictionStatus, PlacesPredictions

# Backward compatibility - create a unified interface
class PredictionService:
    """
    Unified interface for backward compatibility.
    Delegates to specialized services.
    """
    
    # Match predictions
    create_or_update_match_prediction = staticmethod(MatchPredictionService.create_or_update_match_prediction)
    create_or_update_batch_predictions = staticmethod(MatchPredictionService.create_or_update_batch_predictions)
    
    # Group predictions
    create_or_update_group_prediction = staticmethod(GroupPredictionService.create_or_update_group_prediction)
    get_group_predictions = staticmethod(GroupPredictionService.get_group_predictions)
    create_or_update_batch_group_predictions = staticmethod(GroupPredictionService.create_or_update_batch_group_predictions)
    
    # Third place predictions
    create_or_update_third_place_prediction = staticmethod(ThirdPlacePredictionService.create_or_update_third_place_prediction)
    get_third_place_predictions_data = staticmethod(ThirdPlacePredictionService.get_third_place_predictions_data)
    
    # Knockout predictions
    get_knockout_predictions = staticmethod(KnockoutPredictionService.get_knockout_predictions)
    update_knockout_prediction_winner = staticmethod(KnockoutPredictionService.update_knockout_prediction_winner)
    update_batch_knockout_predictions = staticmethod(KnockoutPredictionService.update_batch_knockout_predictions)
    create_draft_from_prediction = staticmethod(KnockoutPredictionService.create_draft_from_prediction)
    create_all_drafts_from_predictions = staticmethod(KnockoutPredictionService.create_all_drafts_from_predictions)
    
    # Status management
    set_status = staticmethod(PredictionRepository.set_prediction_status)

__all__ = [
    'PredictionService',
    'MatchPredictionService',
    'GroupPredictionService',
    'ThirdPlacePredictionService',
    'KnockoutPredictionService',
    'PredictionRepository',
    'PredictionStatus',
    'PlacesPredictions',
]

