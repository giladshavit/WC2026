#!/usr/bin/env python3
"""
Script to update flag URLs for all teams
"""

import sys
import os
# Point to backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from database import SessionLocal
from models.team import Team

# Mapping of team names to their flag codes
flag_mapping = {
    "Albania": "al", "Argentina": "ar", "Cameroon": "cm", "Belgium": "be",
    "Bolivia": "bo", "Senegal": "sn", "Brazil": "br", "Bulgaria": "bg",
    "Canada": "ca", "Chile": "cl", "Colombia": "co", "Croatia": "hr",
    "Czech Republic": "cz", "Denmark": "dk", "Ecuador": "ec", "England": "gb-eng",
    "France": "fr", "Germany": "de", "Japan": "jp", "Hungary": "hu",
    "Nigeria": "ng", "Italy": "it", "Ghana": "gh", "Ivory Coast": "ci",
    "Lithuania": "lt", "Mexico": "mx", "South Korea": "kr", "Netherlands": "nl",
    "North Macedonia": "mk", "Norway": "no", "Paraguay": "py", "Peru": "pe",
    "Poland": "pl", "Portugal": "pt", "Saudi Arabia": "sa", "Egypt": "eg",
    "Serbia": "rs", "Iraq": "iq", "Qatar": "qa", "Spain": "es",
    "Sweden": "se", "Switzerland": "ch", "Australia": "au", "Ukraine": "ua",
    "United States": "us", "Uruguay": "uy", "Venezuela": "ve", "Morocco": "ma"
}

def update_team_flags():
    """Update flag URLs for all teams in the database"""
    db: Session = SessionLocal()
    updated_count = 0
    no_flag_count = 0
    
    try:
        teams = db.query(Team).all()
        for team in teams:
            flag_code = flag_mapping.get(team.name)
            if flag_code:
                flag_url = f"https://flagcdn.com/w40/{flag_code}.png"
                team.flag_url = flag_url
                print(f"✅ Updated {team.name} with flag: {flag_url}")
                updated_count += 1
            else:
                print(f"⚠️ No flag found for: {team.name}")
                no_flag_count += 1
        
        db.commit()
        print(f"\n🎉 Successfully updated {updated_count} teams with flags")
        if no_flag_count > 0:
            print(f"⚠️  {no_flag_count} teams without flags")
    except Exception as e:
        db.rollback()
        print(f"Error updating team flags: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_team_flags()

