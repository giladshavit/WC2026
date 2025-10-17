#!/usr/bin/env python3
"""
Script to add short_name column to teams table and populate it with 3-letter abbreviations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.team import Team
from sqlalchemy.orm import Session

# Mapping of team names to their 3-letter abbreviations
TEAM_SHORT_NAMES = {
    # Group A
    "Germany": "GER",
    "Scotland": "SCO", 
    "Hungary": "HUN",
    "Switzerland": "SUI",
    
    # Group B
    "Spain": "ESP",
    "Croatia": "CRO",
    "Italy": "ITA",
    "Albania": "ALB",
    
    # Group C
    "Slovenia": "SVN",
    "Denmark": "DEN",
    "Serbia": "SRB",
    "England": "ENG",
    
    # Group D
    "Poland": "POL",
    "Netherlands": "NED",
    "Austria": "AUT",
    "France": "FRA",
    
    # Group E
    "Belgium": "BEL",
    "Slovakia": "SVK",
    "Romania": "ROU",
    "Ukraine": "UKR",
    
    # Group F
    "Turkey": "TUR",
    "Georgia": "GEO",
    "Portugal": "POR",
    "Czech Republic": "CZE",
    
    # Group G
    "Egypt": "EGY",
    "Ghana": "GHA",
    "Morocco": "MAR",
    "Senegal": "SEN",
    
    # Group H
    "Argentina": "ARG",
    "Brazil": "BRA",
    "Chile": "CHI",
    "Colombia": "COL",
    
    # Group I
    "Mexico": "MEX",
    "United States": "USA",
    "Canada": "CAN",
    "Jamaica": "JAM",
    
    # Group J
    "Japan": "JPN",
    "South Korea": "KOR",
    "Australia": "AUS",
    "Saudi Arabia": "KSA",
    
    # Group K
    "Iran": "IRN",
    "Uzbekistan": "UZB",
    "Iraq": "IRQ",
    "Qatar": "QAT",
    
    # Group L
    "Ivory Coast": "CIV",
    "Nigeria": "NGA",
    "Tunisia": "TUN",
    "Algeria": "ALG",
    
    # Additional teams that might be in the database
    "Bolivia": "BOL",
    "Venezuela": "VEN",
    "Peru": "PER",
    "Ecuador": "ECU",
    "Paraguay": "PAR",
    "Uruguay": "URU",
    "Sweden": "SWE",
    "Norway": "NOR",
    "Finland": "FIN",
    "Iceland": "ISL",
    "Wales": "WAL",
    "Ireland": "IRL",
    "Northern Ireland": "NIR",
    "Israel": "ISR",
    "Palestine": "PLE",
    "Jordan": "JOR",
    "Lebanon": "LBN",
    "Syria": "SYR",
    "Kuwait": "KUW",
    "Oman": "OMA",
    "UAE": "UAE",
    "Bahrain": "BHR",
    "Yemen": "YEM",
    "Afghanistan": "AFG",
    "India": "IND",
    "Pakistan": "PAK",
    "Bangladesh": "BAN",
    "Sri Lanka": "SRI",
    "Nepal": "NEP",
    "Bhutan": "BHU",
    "Maldives": "MDV",
    "Myanmar": "MYA",
    "Thailand": "THA",
    "Vietnam": "VIE",
    "Laos": "LAO",
    "Cambodia": "CAM",
    "Malaysia": "MAS",
    "Singapore": "SIN",
    "Indonesia": "IDN",
    "Philippines": "PHI",
    "Brunei": "BRU",
    "East Timor": "TLS",
    "Papua New Guinea": "PNG",
    "Solomon Islands": "SOL",
    "Vanuatu": "VAN",
    "New Caledonia": "NCL",
    "Fiji": "FIJ",
    "Tahiti": "TAH",
    "New Zealand": "NZL",
    "Tonga": "TGA",
    "Samoa": "SAM",
    "American Samoa": "ASA",
    "Cook Islands": "COK",
    "Tuvalu": "TUV",
    "Kiribati": "KIR",
    "Nauru": "NRU",
    "Marshall Islands": "MHL",
    "Micronesia": "FSM",
    "Palau": "PLW",
    "Guam": "GUM",
    "Northern Mariana Islands": "MNP",
    "Marshall Islands": "MHL",
    "Micronesia": "FSM",
    "Palau": "PLW",
    "Guam": "GUM",
    "Northern Mariana Islands": "MNP"
}

def add_short_names():
    """Add short_name column and populate it with 3-letter abbreviations"""
    db = next(get_db())
    
    try:
        # Update each team with its short name
        for team_name, short_name in TEAM_SHORT_NAMES.items():
            team = db.query(Team).filter(Team.name == team_name).first()
            if team:
                team.short_name = short_name
                print(f"Updated {team_name} -> {short_name}")
            else:
                print(f"Team not found: {team_name}")
        
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

