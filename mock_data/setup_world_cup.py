import json
import random
from datetime import datetime, timedelta
import requests
from typing import List, Dict, Any

# Base URL for the API
BASE_URL = "http://localhost:8000/api"

def load_teams_from_json() -> List[Dict[str, Any]]:
    """טוען את הקבוצות מקובץ JSON"""
    with open('mock_data/world_cup_teams.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        return data['teams']

def add_teams_to_database(teams: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """מוסיף את הקבוצות לבסיס הנתונים"""
    print("מוסיף קבוצות לבסיס הנתונים...")
    
    url = f"{BASE_URL}/admin/teams/batch"
    payload = {"teams": teams}
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        print(f"נוספו {result['total_created']} קבוצות")
        if result['errors']:
            print(f"שגיאות: {result['errors']}")
        
        return result['created_teams']
    except requests.exceptions.RequestException as e:
        print(f"שגיאה בהוספת קבוצות: {e}")
        return []

def get_all_teams() -> List[Dict[str, Any]]:
    """מביא את כל הקבוצות מהבסיס נתונים"""
    url = f"{BASE_URL}/admin/teams"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"שגיאה בקבלת קבוצות: {e}")
        return []

def create_groups(teams: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """יוצר 12 בתים עם 4 קבוצות בכל בית"""
    print("יוצר בתים...")
    
    # מערבב את הקבוצות
    shuffled_teams = teams.copy()
    random.shuffle(shuffled_teams)
    
    groups = {}
    for i in range(12):
        group_name = chr(65 + i)  # A, B, C, ..., L
        start_idx = i * 4
        end_idx = start_idx + 4
        groups[group_name] = shuffled_teams[start_idx:end_idx]
        
        print(f"בית {group_name}: {[team['name'] for team in groups[group_name]]}")
    
    return groups

def generate_group_matches(groups: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """יוצר את כל המשחקים בשלב הבתים במחזורים"""
    print("יוצר משחקי בתים...")
    
    matches = []
    base_date = datetime(2026, 6, 15, 20, 0)  # 15 ביוני 2026, 20:00
    
    for group_name, teams in groups.items():
        print(f"\nבית {group_name}:")
        
        # עם 4 קבוצות, יש 6 משחקים ב-3 מחזורים
        # מחזור 1: משחקים 1-2
        # מחזור 2: משחקים 3-4  
        # מחזור 3: משחקים 5-6
        
        # מחזור 1: ברזיל-ארגנטינה, צרפת-ספרד
        match1 = {
            "home_team_id": teams[0]['id'],
            "away_team_id": teams[1]['id'],
            "group": group_name,
            "date": base_date.isoformat()
        }
        matches.append(match1)
        print(f"  מחזור 1: {teams[0]['name']} vs {teams[1]['name']}")
        
        match2 = {
            "home_team_id": teams[2]['id'],
            "away_team_id": teams[3]['id'],
            "group": group_name,
            "date": (base_date + timedelta(days=1)).isoformat()
        }
        matches.append(match2)
        print(f"  מחזור 1: {teams[2]['name']} vs {teams[3]['name']}")
        
        # מחזור 2: ברזיל-צרפת, ארגנטינה-ספרד
        match3 = {
            "home_team_id": teams[0]['id'],
            "away_team_id": teams[2]['id'],
            "group": group_name,
            "date": (base_date + timedelta(days=3)).isoformat()
        }
        matches.append(match3)
        print(f"  מחזור 2: {teams[0]['name']} vs {teams[2]['name']}")
        
        match4 = {
            "home_team_id": teams[1]['id'],
            "away_team_id": teams[3]['id'],
            "group": group_name,
            "date": (base_date + timedelta(days=4)).isoformat()
        }
        matches.append(match4)
        print(f"  מחזור 2: {teams[1]['name']} vs {teams[3]['name']}")
        
        # מחזור 3: ברזיל-ספרד, ארגנטינה-צרפת
        match5 = {
            "home_team_id": teams[0]['id'],
            "away_team_id": teams[3]['id'],
            "group": group_name,
            "date": (base_date + timedelta(days=6)).isoformat()
        }
        matches.append(match5)
        print(f"  מחזור 3: {teams[0]['name']} vs {teams[3]['name']}")
        
        match6 = {
            "home_team_id": teams[1]['id'],
            "away_team_id": teams[2]['id'],
            "group": group_name,
            "date": (base_date + timedelta(days=7)).isoformat()
        }
        matches.append(match6)
        print(f"  מחזור 3: {teams[1]['name']} vs {teams[2]['name']}")
        
        # מעביר לתאריך הבא לבית הבא
        base_date += timedelta(days=10)
    
    print(f"\nנוצרו {len(matches)} משחקי בתים")
    return matches

def add_matches_to_database(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """מוסיף את המשחקים לבסיס הנתונים"""
    print("מוסיף משחקים לבסיס הנתונים...")
    
    created_matches = []
    url = f"{BASE_URL}/admin/matches/group-stage"
    
    for i, match in enumerate(matches):
        try:
            response = requests.post(url, json=match)
            response.raise_for_status()
            created_match = response.json()
            created_matches.append(created_match)
            
            if (i + 1) % 10 == 0:
                print(f"נוספו {i + 1} משחקים...")
                
        except requests.exceptions.RequestException as e:
            print(f"שגיאה בהוספת משחק {i + 1}: {e}")
    
    print(f"נוספו {len(created_matches)} משחקים לבסיס הנתונים")
    return created_matches

def main():
    """הפונקציה הראשית"""
    print("מתחיל הגדרת מונדיאל 2026...")
    
    # 1. טוען קבוצות מקובץ JSON
    teams_data = load_teams_from_json()
    print(f"נטענו {len(teams_data)} קבוצות מקובץ JSON")
    
    # 2. מוסיף קבוצות לבסיס הנתונים
    created_teams = add_teams_to_database(teams_data)
    if not created_teams:
        print("לא הצלחנו להוסיף קבוצות. בודק אם הן כבר קיימות...")
        created_teams = get_all_teams()
    
    # 3. יוצר בתים
    groups = create_groups(created_teams)
    
    # 4. יוצר משחקי בתים
    matches = generate_group_matches(groups)
    
    # 5. מוסיף משחקים לבסיס הנתונים
    created_matches = add_matches_to_database(matches)
    
    print("\nהגדרת מונדיאל 2026 הושלמה!")
    print(f"קבוצות: {len(created_teams)}")
    print(f"בתים: {len(groups)}")
    print(f"משחקי בתים: {len(created_matches)}")

if __name__ == "__main__":
    main()
