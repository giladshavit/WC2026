"""
Fill knockout_result_id for existing MatchTemplate records.
Uses SQLAlchemy ORM directly to avoid circular imports.
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult


def fill_knockout_result_ids() -> int:
    """
    Fill knockout_result_id for existing MatchTemplate records.
    Returns count of updated records.
    """
    db = SessionLocal()
    try:
        templates = db.query(MatchTemplate).filter(
            MatchTemplate.stage.in_(
                ["round32", "round16", "quarter", "semi", "final", "third_place"]
            )
        ).all()

        updated = 0
        for template in templates:
            if template.knockout_result_id:
                continue
            result = db.query(KnockoutStageResult).filter(
                KnockoutStageResult.match_id == template.id
            ).first()
            if result:
                template.knockout_result_id = result.id
                updated += 1

        db.commit()
        print(f"✅ Updated {updated} match templates with knockout_result_id.")
        return updated
    except Exception as exc:
        db.rollback()
        print(f"❌ Error: {exc}")
        raise
    finally:
        db.close()


def main() -> None:
    fill_knockout_result_ids()


if __name__ == "__main__":
    main()
