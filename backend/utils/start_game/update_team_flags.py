#!/usr/bin/env python3
"""
Script to update flag URLs for all teams
"""

import sys
import os
import unicodedata
# Point to backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from database import SessionLocal
from models.team import Team

def normalize_team_name(name: str) -> str:
    cleaned = name.strip().replace("Ã§", "c").replace("ç", "c")
    normalized = unicodedata.normalize("NFKD", cleaned)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_name.lower()


# Mapping of normalized team names to their flag codes
flag_mapping = {
    # Group A
    "mexico": "mx",
    "south africa": "za",
    "south korea": "kr",
    "denmark": "dk",
    # Group B
    "canada": "ca",
    "italy": "it",
    "qatar": "qa",
    "switzerland": "ch",
    # Group C
    "brazil": "br",
    "morocco": "ma",
    "haiti": "ht",
    "scotland": "gb-sct",
    # Group D
    "united states": "us",
    "paraguay": "py",
    "australia": "au",
    "turkey": "tr",
    # Group E
    "germany": "de",
    "curacao": "cw",
    "ivory coast": "ci",
    "ecuador": "ec",
    # Group F
    "netherlands": "nl",
    "japan": "jp",
    "sweden": "se",
    "tunisia": "tn",
    # Group G
    "belgium": "be",
    "egypt": "eg",
    "iran": "ir",
    "new zealand": "nz",
    # Group H
    "spain": "es",
    "cape verde": "cv",
    "saudi arabia": "sa",
    "uruguay": "uy",
    # Group I
    "france": "fr",
    "senegal": "sn",
    "bolivia": "bo",
    "norway": "no",
    # Group J
    "argentina": "ar",
    "algeria": "dz",
    "austria": "at",
    "jordan": "jo",
    # Group K
    "portugal": "pt",
    "jamaica": "jm",
    "uzbekistan": "uz",
    "colombia": "co",
    # Group L
    "england": "gb-eng",
    "croatia": "hr",
    "ghana": "gh",
    "panama": "pa",
}

def update_team_flags():
    """Update flag URLs for all teams in the database"""
    db: Session = SessionLocal()
    updated_count = 0
    no_flag_count = 0
    
    try:
        teams = db.query(Team).all()
        for team in teams:
            flag_code = flag_mapping.get(normalize_team_name(team.name))
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

