from dataclasses import dataclass
from enum import Enum

class PredictionStatus(Enum):
    PREDICTED = "predicted"  # User predicted and prediction is valid
    MIGHT_CHANGE_PREDICT = "might_change_predict"  # Teams changed, user might want to re-evaluate
    MUST_CHANGE_PREDICT = "must_change_predict"  # Must determine winner because prediction is invalid/missing

@dataclass
class PlacesPredictions:
    first_place: int
    second_place: int
    third_place: int
    fourth_place: int

