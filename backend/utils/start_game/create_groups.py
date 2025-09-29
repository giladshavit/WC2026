#!/usr/bin/env python3
"""
Script to create groups
"""

import sys
import os
# Point to backend root: utils/start_game -> utils -> backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import engine
from models.groups import Group
from models.team import Team
from sqlalchemy.orm import sessionmaker


def create_groups():
    """Create all groups"""
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create the table if it does not exist
        Group.__table__.create(engine, checkfirst=True)
        
        # Delete all existing groups
        session.query(Group).delete()
        
        # Fetch all teams
        teams = session.query(Team).all()
        print(f"Found {len(teams)} teams")
        
        # Create groups with their teams
        for group_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            # Fetch the 4 teams for this group
            group_teams = [team for team in teams if team.group_letter == group_letter]
            group_teams.sort(key=lambda x: x.group_position)  # sort by position
            
            if len(group_teams) == 4:
                group = Group(
                    id=ord(group_letter) - ord('A') + 1,  # A=1, B=2, etc.
                    name=group_letter,
                    team_1=group_teams[0].id,
                    team_2=group_teams[1].id,
                    team_3=group_teams[2].id,
                    team_4=group_teams[3].id
                )
                session.add(group)
                print(f"Group {group_letter}: {group_teams[0].name}, {group_teams[1].name}, {group_teams[2].name}, {group_teams[3].name}")
            else:
                print(f"Error: Group {group_letter} contains {len(group_teams)} teams instead of 4")
        
        session.commit()
        print(f"12 groups created successfully!")
        
        # Summary
        print("\nGroups summary:")
        print("=" * 30)
        for group_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
            group_id = ord(group_letter) - ord('A') + 1
            print(f"Group {group_letter} (ID: {group_id})")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating groups: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    create_groups()
