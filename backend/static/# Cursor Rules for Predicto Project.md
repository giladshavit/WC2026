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