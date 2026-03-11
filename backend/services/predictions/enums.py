from enum import Enum


class PredictionType(str, Enum):
    GROUPS = "groups"
    THIRD_PLACE = "third_place"
    KNOCKOUT = "knockout"
    BONUS = "bonus"


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


class GroupPredictionStatus(str, Enum):
    """Status of a group stage prediction."""
    PENDING = "pending"    # No result yet for this group
    SETTLED = "settled"    # Group result has been entered


class ThirdPlacePredictionStatus(str, Enum):
    """Status of a third place prediction."""
    PENDING = "pending"    # No third place result yet
    SETTLED = "settled"    # Third place result has been entered


class BonusSectionStatus(str, Enum):
    """Section-level status — controls editability lock."""
    PENDING = "pending"
    SETTLED = "settled"


class BonusQuestionStatus(str, Enum):
    """Per-question status — used for scoring display."""
    PENDING = "pending"
    CORRECT = "correct"
    WRONG = "wrong"  # was INCORRECT = "incorrect" — BREAKING CHANGE, fix DB data too


class BonusQuestionField(str, Enum):
    """
    Each member = one bonus question.
    Provides typed access to all field names needed for settling and scoring.
    """
    G1 = "g1"
    G2 = "g2"
    G3 = "g3"
    G4 = "g4"
    G5 = "g5"
    K1 = "k1"
    K2 = "k2"
    K3 = "k3"
    T1 = "t1"
    T2 = "t2"

    @property
    def prediction_field(self) -> str:
        """Column name on BonusPrediction that holds the user's answer."""
        return {
            BonusQuestionField.G1: "g1_total_goals_group",
            BonusQuestionField.G2: "g2_top_group_id",
            BonusQuestionField.G3: "g3_top_team_id",
            BonusQuestionField.G4: "g4_perfect_teams",
            BonusQuestionField.G5: "g5_clean_sheet_teams",
            BonusQuestionField.K1: "k1_total_goals_knockout",
            BonusQuestionField.K2: "k2_penalty_shootouts",
            BonusQuestionField.K3: "k3_third_place_quarters",
            BonusQuestionField.T1: "t1_total_goals_tournament",
            BonusQuestionField.T2: "t2_scoreless_draws",
        }[self]

    @property
    def result_field(self) -> str:
        """Column name on BonusResults that holds the correct answer string."""
        return f"{self.value}_correct"

    @property
    def status_field(self) -> str:
        """Column name on BonusPrediction that holds the per-question status."""
        return f"q_{self.value}_status"

    @property
    def is_int_fk(self) -> bool:
        """True if the prediction field stores an Integer FK (needs str() before compare)."""
        return self in (BonusQuestionField.G2, BonusQuestionField.G3)

    @classmethod
    def from_key(cls, key: str) -> "BonusQuestionField":
        """Lookup by string key, e.g. 'g1' → BonusQuestionField.G1. Raises ValueError if unknown."""
        try:
            return cls(key)
        except ValueError:
            raise ValueError(f"Unknown bonus question key: {key!r}")
