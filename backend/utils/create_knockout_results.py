#!/usr/bin/env python3
"""
סקריפט ליצירת KnockoutStageResult (ID 1-32) מקושרים ל-matches (ID 73-104)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from models.matches import Match
from models.results import KnockoutStageResult
from models.matches_template import MatchTemplate
from sqlalchemy.orm import sessionmaker

def create_knockout_results():
    """יוצר את KnockoutStageResult (ID 1-32) מקושרים ל-matches (ID 73-104)"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # יוצר את הטבלה אם היא לא קיימת
        KnockoutStageResult.__table__.create(engine, checkfirst=True)
        
        # מוחק את כל התוצאות הקיימות
        session.query(KnockoutStageResult).delete()
        
        # מביא את כל משחקי הנוקאאוט
        knockout_matches = session.query(Match).filter(
            Match.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])
        ).order_by(Match.id).all()
        
        print(f"נמצאו {len(knockout_matches)} משחקי נוקאאוט")
        
        # יוצר את KnockoutStageResult
        results_created = 0
        for i, match in enumerate(knockout_matches, 1):
            result = KnockoutStageResult(
                id=i,  # ID 1-32
                match_id=match.id,  # מקושר ל-match (ID 73-104)
                team_1=None,  # עדיין לא נקבע
                team_2=None,  # עדיין לא נקבע
                winner_team_id=None  # עדיין לא נקבע
            )
            session.add(result)
            results_created += 1
        
        session.commit()
        print(f"נוצרו {results_created} תוצאות נוקאאוט בהצלחה!")
        
        # מציג סיכום
        print("\nסיכום תוצאות נוקאאוט שנוצרו:")
        print("=" * 50)
        
        results = session.query(KnockoutStageResult).order_by(KnockoutStageResult.id).all()
        for result in results:
            match = session.query(Match).filter(Match.id == result.match_id).first()
            print(f"Result ID {result.id} -> Match ID {result.match_id} ({match.stage})")
        
    except Exception as e:
        session.rollback()
        print(f"שגיאה ביצירת תוצאות נוקאאוט: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_knockout_results()
