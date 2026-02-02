#!/usr/bin/env python3
"""
Script to add short_name column to teams table and populate it with 3-letter abbreviations
"""

import sys
import os
import unicodedata
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.team import Team
from sqlalchemy.orm import Session

def normalize_team_name(name: str) -> str:
    cleaned = name.strip().replace("Ã§", "c").replace("ç", "c")
    normalized = unicodedata.normalize("NFKD", cleaned)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_name.lower()


# Mapping of normalized team names to their 3-letter abbreviations
TEAM_SHORT_NAMES = {
    # Group A
    "mexico": "MEX",
    "south africa": "RSA",
    "south korea": "KOR",
    "denmark": "DEN",
    # Group B
    "canada": "CAN",
    "italy": "ITA",
    "qatar": "QAT",
    "switzerland": "SUI",
    # Group C
    "brazil": "BRA",
    "morocco": "MAR",
    "haiti": "HAI",
    "scotland": "SCO",
    # Group D
    "united states": "USA",
    "paraguay": "PAR",
    "australia": "AUS",
    "turkey": "TUR",
    # Group E
    "germany": "GER",
    "curacao": "CUW",
    "ivory coast": "CIV",
    "ecuador": "ECU",
    # Group F
    "netherlands": "NED",
    "japan": "JPN",
    "sweden": "SWE",
    "tunisia": "TUN",
    # Group G
    "belgium": "BEL",
    "egypt": "EGY",
    "iran": "IRN",
    "new zealand": "NZL",
    # Group H
    "spain": "ESP",
    "cape verde": "CPV",
    "saudi arabia": "KSA",
    "uruguay": "URU",
    # Group I
    "france": "FRA",
    "senegal": "SEN",
    "bolivia": "BOL",
    "norway": "NOR",
    # Group J
    "argentina": "ARG",
    "algeria": "ALG",
    "austria": "AUT",
    "jordan": "JOR",
    # Group K
    "portugal": "POR",
    "jamaica": "JAM",
    "uzbekistan": "UZB",
    "colombia": "COL",
    # Group L
    "england": "ENG",
    "croatia": "CRO",
    "ghana": "GHA",
    "panama": "PAN",
}

def add_short_names():
    """Add short_name column and populate it with 3-letter abbreviations"""
    db = next(get_db())
    
    try:
        # Update each team with its short name
        teams = db.query(Team).all()
        for team in teams:
            normalized_name = normalize_team_name(team.name)
            short_name = TEAM_SHORT_NAMES.get(normalized_name)
            if short_name:
                team.short_name = short_name
                print(f"Updated {team.name} -> {short_name}")
            else:
                print(f"Team not found: {team.name}")
        
        # Commit the changes
        db.commit()
        print("✅ Successfully updated all team short names!")
        
    except Exception as e:
        print(f"❌ Error updating team short names: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_short_names()

