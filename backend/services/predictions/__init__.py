"""
Prediction services module - refactored from single prediction_service.py

This module contains specialized services for different types of predictions:
- MatchPredictionService: Group stage match predictions
- GroupPredictionService: Group stage standings predictions
- ThirdPlacePredictionService: Third place qualifying teams predictions
- KnockPredRefactorService: Knockout stage predictions

All services use DBReader/DBWriter/DBUtils for database operations.
"""

from .match_prediction_service import MatchPredictionService
from .group_prediction_service import GroupPredictionService
from .third_place_prediction_service import ThirdPlacePredictionService
from .knock_pred_refactor_service import KnockPredRefactorService
from services.database import DBWriter
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
    get_knockout_predictions = staticmethod(KnockPredRefactorService.get_knockout_predictions)
    update_knockout_prediction_winner = staticmethod(KnockPredRefactorService.update_knockout_prediction_by_id)
    update_batch_knockout_predictions = staticmethod(KnockPredRefactorService.update_batch_knockout_predictions)
    create_draft_from_prediction = staticmethod(KnockPredRefactorService.create_draft_from_prediction)
    create_all_drafts_from_predictions = staticmethod(KnockPredRefactorService.create_all_drafts_from_predictions)
    delete_all_drafts_for_user = staticmethod(KnockPredRefactorService.delete_all_drafts_for_user)
    delete_all_knockout_predictions_for_user = staticmethod(KnockPredRefactorService.delete_all_knockout_predictions_for_user)
    
    # Status management
    set_status = staticmethod(DBWriter.set_prediction_status)

__all__ = [
    'PredictionService',
    'MatchPredictionService',
    'GroupPredictionService',
    'ThirdPlacePredictionService',
    'PredictionStatus',
    'PlacesPredictions',
]

