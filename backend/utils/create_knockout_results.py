#!/usr/bin/env python3
"""
Script to create KnockoutStageResult (ID 1-32) linked to matches (ID 73-104)
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
    """Create KnockoutStageResult (ID 1-32) linked to matches (ID 73-104)"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create the table if it does not exist
        KnockoutStageResult.__table__.create(engine, checkfirst=True)
        
        # Delete all existing results
        session.query(KnockoutStageResult).delete()
        
        # Fetch all knockout matches
        knockout_matches = session.query(Match).filter(
            Match.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])
        ).order_by(Match.id).all()
        
        print(f"Found {len(knockout_matches)} knockout matches")
        
        # Create KnockoutStageResult entries
        results_created = 0
        for i, match in enumerate(knockout_matches, 1):
            result = KnockoutStageResult(
                id=i,  # ID 1-32
                match_id=match.id,  # linked to match (ID 73-104)
                team_1=None,  # not set yet
                team_2=None,  # not set yet
                winner_team_id=None  # not set yet
            )
            session.add(result)
            results_created += 1
        
        session.commit()
        print(f"Created {results_created} knockout results successfully!")
        
        # Summary
        print("\nSummary of created knockout results:")
        print("=" * 50)
        
        results = session.query(KnockoutStageResult).order_by(KnockoutStageResult.id).all()
        for result in results:
            match = session.query(Match).filter(Match.id == result.match_id).first()
            print(f"Result ID {result.id} -> Match ID {result.match_id} ({match.stage})")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating knockout results: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_knockout_results()
