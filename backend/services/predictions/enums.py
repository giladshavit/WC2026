from enum import Enum


class MatchPredictionStatus(Enum):
    """Status of a match prediction after result is entered."""
    PENDING = "pending"              # No result yet
    EXACT = "exact"                  # Exact score predicted
    CORRECT_OUTCOME = "correct_outcome"  # Correct winner/draw, wrong score
    WRONG = "wrong"                  # Wrong prediction


class KnockoutPredictionStatus(Enum):
    """Status of a knockout prediction. Pre-result and post-result."""
    # Pre-result
    VALID = "valid"
    INVALID = "invalid"
    UNREACHABLE = "unreachable"
    # Post-result
    CORRECT_FULL = "correct_full"
    CORRECT_PARTIAL = "correct_partial"
    INCORRECT = "incorrect"
    # Special
    PENDING_RESULT = "pending_result"
