#!/usr/bin/env python3
"""
Script to create group matches (matches) based on matches_template
+ knockout matches
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from models.matches import Match
from models.matches_template import MatchTemplate
from models.team import Team
from sqlalchemy.orm import sessionmaker

def create_group_matches():
    """Create group matches based on matches_template"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create the table if it does not exist
        Match.__table__.create(engine, checkfirst=True)
        
        # Delete all existing matches
        session.query(Match).delete()
        
        # Fetch all group-stage matches from matches_template
        group_templates = session.query(MatchTemplate).filter(MatchTemplate.stage == "group").all()
        
        print(f"Found {len(group_templates)} group-stage matches in template")
        
        # Create mapping of teams by group and position
        teams_mapping = {}
        teams = session.query(Team).all()
        
        # Create mapping: "A1" -> team_id
        for team in teams:
            key = f"{team.group_letter}{team.group_position}"
            teams_mapping[key] = team.id
        
        print(f"Created mapping for {len(teams_mapping)} teams")
        
        # Create group matches
        matches_created = 0
        for template in group_templates:
            # Resolve team IDs for team_1 and team_2
            team_1_id = teams_mapping.get(template.team_1)
            team_2_id = teams_mapping.get(template.team_2)
            
            if team_1_id and team_2_id:
                match = Match(
                    id=template.id,  # keep same ID as template
                    stage=template.stage,
                    home_team_id=team_1_id,
                    away_team_id=team_2_id,
                    status=template.status,
                    date=template.date,
                    group=template.group,
                    match_number=template.id  # use ID as match number
                )
                session.add(match)
                matches_created += 1
            else:
                print(f"Error: Teams not found for {template.team_1} or {template.team_2}")
                # Create a match even if teams were not found (data safety)
                match = Match(
                    id=template.id,
                    stage=template.stage,
                    home_team_id=None,
                    away_team_id=None,
                    status="not_scheduled",
                    date=template.date,
                    group=template.group,
                    match_number=template.id
                )
                session.add(match)
                matches_created += 1
        
        session.commit()
        print(f"Created {matches_created} group matches successfully!")
        
        # Summary
        print("\nSummary of created group matches:")
        print("=" * 50)
        
        # Show by groups
        for group in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            group_matches = session.query(Match).filter(Match.group == group).order_by(Match.id).all()
            print(f"\nGroup {group}:")
            for match in group_matches:
                home_team = session.query(Team).filter(Team.id == match.home_team_id).first()
                away_team = session.query(Team).filter(Team.id == match.away_team_id).first()
                print(f"  ID {match.id}: {home_team.name} vs {away_team.name}")
        
        # Show some examples
        print("\nExamples:")
        sample_matches = session.query(Match).limit(6).all()
        for match in sample_matches:
            home_team = session.query(Team).filter(Team.id == match.home_team_id).first()
            away_team = session.query(Team).filter(Team.id == match.away_team_id).first()
            print(f"ID {match.id}: {home_team.name} vs {away_team.name} (Group {match.group})")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating group matches: {e}")
    finally:
        session.close()

def create_knockout_matches():
    """Create knockout matches (ID 73-104)"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Fetch all knockout matches from matches_template
        knockout_templates = session.query(MatchTemplate).filter(
            MatchTemplate.stage.in_(["round32", "round16", "quarter", "semi", "final", "third_place"])
        ).order_by(MatchTemplate.id).all()
        
        print(f"Found {len(knockout_templates)} knockout matches in template")
        
        # Create knockout matches
        matches_created = 0
        for template in knockout_templates:
            match = Match(
                id=template.id,  # keep same ID as template
                stage=template.stage,
                home_team_id=None,  # not set yet
                away_team_id=None,  # not set yet
                status="not_scheduled",  # initial status
                date=template.date,
                group=None,  # no groups in knockout stage
                match_number=template.id
            )
            session.add(match)
            matches_created += 1
        
        session.commit()
        print(f"Created {matches_created} knockout matches successfully!")
        
        # Summary by stages
        print("\nSummary of created knockout matches:")
        print("=" * 50)
        
        stages = ["round32", "round16", "quarter", "semi", "final", "third_place"]
        for stage in stages:
            stage_matches = session.query(Match).filter(Match.stage == stage).order_by(Match.id).all()
            if stage_matches:
                print(f"\n{stage.upper()}:")
                for match in stage_matches:
                    print(f"  ID {match.id}: {match.stage} - not set yet")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating knockout matches: {e}")
    finally:
        session.close()


def create_all_matches():
    """Create all matches - group and knockout"""
    print("🚀 Starting to create all matches...")
    print("=" * 60)
    
    # Create group matches
    print("\n🏠 Creating group matches...")
    create_group_matches()
    
    # Create knockout matches
    print("\n⚽ Creating knockout matches...")
    create_knockout_matches()
    
    print("\n✅ Done! All matches created successfully!")
    print("💡 Note: To create knockout results, run create_knockout_results.py")

if __name__ == "__main__":
    create_all_matches()
