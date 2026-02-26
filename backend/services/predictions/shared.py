from dataclasses import dataclass

# Alias for backward compatibility during transition
from .enums import KnockoutPredictionStatus
PredictionStatus = KnockoutPredictionStatus

@dataclass
class PlacesPredictions:
    first_place: int
    second_place: int
    third_place: int
    fourth_place: int

