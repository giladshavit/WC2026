from dataclasses import dataclass
from enum import Enum

class PredictionStatus(Enum):
    # ── Pre-result statuses (match not yet played) ──
    VALID = "valid"  # Normal — winner predicted, reachable
    INVALID = "invalid"  # No winner selected or eliminated — must choose
    UNREACHABLE = "unreachable"  # Winner in tournament but via different path

    # ── Post-result statuses (match has been played) ──
    CORRECT_FULL = "correct_full"  # Correct winner + correct path (100% points)
    CORRECT_PARTIAL = "correct_partial"  # Correct winner + wrong path (50% points)
    INCORRECT = "incorrect"  # Wrong winner (0 points)

    PENDING_RESULT = "pending_result"  # Result exists but status not finalized

@dataclass
class PlacesPredictions:
    first_place: int
    second_place: int
    third_place: int
    fourth_place: int

