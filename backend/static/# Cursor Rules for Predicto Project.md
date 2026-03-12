# Cursor Rules for Predicto Project

## Tech Stack & Style
- **Backend:** Python (FastAPI or Flask - detect from context), SQLAlchemy, Pydantic.
- **Frontend:** React Native (Expo), TypeScript.
- **Styling:** StyleSheet (React Native standard).

## Coding Principles
1. **Clean Architecture:** Maintain strict separation between Services (Logic), Models (DB), and Routers (API).
2. **Type Safety:** Always use Type Hints in Python (`def func(a: int) -> str:`) and Interfaces in TypeScript.
3. **Error Handling:** Never swallow errors. Use try/catch blocks and return meaningful HTTP error codes.
4. **Comments:** Add docstrings to complex logic (especially Scoring and Cascade logic).
5. **Naming:** Use snake_case for Python and camelCase for JavaScript/TypeScript.

## Project Specifics
- **Database:** Always use migrations (Alembic) for DB schema changes.
- **Time:** All backend times must be UTC.
- **Testing:** When writing new logic, suggest unit tests for edge cases (e.g., penalties, tie-breakers).

## Penalties & Fines

### Bracket Reset (One-Time Option — PRE_ROUND32 Stage Only)

Before the Round of 32 begins (stage = `PRE_ROUND32`), users have a **one-time option** to fully
reset their entire knockout bracket. This is tracked via `has_used_bracket_reset` (boolean) on
the `UserScores` model.

**What reset does:**
- `round32` predictions: teams are filled from the actual Round of 32 match results (real teams),
  winner is cleared → user picks fresh.
- All other stages (round16, quarter, semi, final): all team fields AND winner are cleared → blank.
- ALL prediction statuses are set to `invalid`, points = 0, is_editable = True.

**Penalty formula:**
penalty = (invalid_count × 2) + (unreachable_count × 1)
Where `invalid_count` and `unreachable_count` are counted from the user's predictions
**before** the reset is applied.

**Why this can be more cost-effective than manual editing:**
At the `PRE_ROUND32` stage, each manual bracket change costs **4 points per change**.
A user with many invalid/unreachable predictions might pay far less by resetting (e.g., 20 pts
via reset) than by fixing predictions one-by-one (e.g., 15 changes × 4 pts = 60 pts).
This makes the reset a strategic tool, not just a convenience.

**Implementation rules:**
- Penalty is applied DIRECTLY to `UserScores` fields (`penalty`, `knockout_penalty`, `total_points`)
  using simple arithmetic (`+= penalty`, `-= penalty`) — NO calls to `ScoringService` helpers.
- The reset and penalty must happen atomically in a single `DBUtils.commit()`.
- `has_used_bracket_reset` is set to `True` in the same commit — it cannot be used again.
- The preview endpoint (`GET /knockout/bracket-reset/preview`) is safe to call multiple times
  and does NOT modify any data.