import requests
import json
from typing import List, Dict, Any

BASE_URL = "http://127.0.0.1:8000/api"

def create_groups():
    """יוצר את 12 הבתים (A עד L)"""
    print("יוצר בתים...")
    
    groups_created = []
    for i in range(12):
        group_name = chr(65 + i)  # A, B, C, ..., L
        
        try:
            response = requests.post(f"{BASE_URL}/admin/groups", params={"group_name": group_name})
            response.raise_for_status()
            result = response.json()
            groups_created.append(result)
            print(f"נוצר בית {group_name}: {result}")
            
        except requests.exceptions.RequestException as e:
            print(f"שגיאה ביצירת בית {group_name}: {e}")
    
    print(f"נוצרו {len(groups_created)} בתים")
    return groups_created

def get_groups_with_teams():
    """מביא את כל הבתים עם הקבוצות שלהם"""
    print("מביא בתים עם קבוצות...")
    
    try:
        response = requests.get(f"{BASE_URL}/groups")
        response.raise_for_status()
        groups = response.json()
        
        for group in groups:
            print(f"בית {group['name']}: {[team['name'] for team in group['teams']]}")
        
        return groups
        
    except requests.exceptions.RequestException as e:
        print(f"שגיאה בקבלת בתים: {e}")
        return []

def populate_groups_with_teams():
    """ממלא את הבתים עם הקבוצות מהטבלה teams"""
    print("ממלא בתים עם קבוצות...")

    try:
        # מביא את כל הקבוצות
        response = requests.get(f"{BASE_URL}/admin/teams")
        response.raise_for_status()
        teams = response.json()
        
        # מקבל את הקבוצות לפי בתים
        teams_by_group = {}
        for team in teams:
            if team.get('group_letter') and team.get('group_position'):
                group_letter = team['group_letter']
                position = team['group_position']
                
                if group_letter not in teams_by_group:
                    teams_by_group[group_letter] = {}
                teams_by_group[group_letter][position] = team['id']
        
        # מעדכן כל בית עם הקבוצות שלו
        for group_letter, teams_dict in teams_by_group.items():
            if len(teams_dict) == 4:  # וודא שיש 4 קבוצות בבית
                update_data = {
                    "team_1": teams_dict[1],
                    "team_2": teams_dict[2], 
                    "team_3": teams_dict[3],
                    "team_4": teams_dict[4]
                }
                
                response = requests.put(f"{BASE_URL}/admin/groups/{group_letter}", json=update_data)
                response.raise_for_status()
                
                print(f"עודכן בית {group_letter}: {teams_dict[1]}, {teams_dict[2]}, {teams_dict[3]}, {teams_dict[4]}")
        
        print(f"עודכנו {len(teams_by_group)} בתים")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"שגיאה במילוי בתים: {e}")
        return False

def main():
    """הפונקציה הראשית"""
    print("=== יצירת בתים למונדיאל 2026 ===")
    
    # 1. יוצר את הבתים
    groups = create_groups()
    
    # 2. ממלא את הבתים עם הקבוצות
    populate_success = populate_groups_with_teams()
    if not populate_success:
        print("שגיאה במילוי בתים")
        return
    
    # 3. מביא את הבתים עם הקבוצות
    groups_with_teams = get_groups_with_teams()
    
    print("\n=== סיום יצירת בתים ===")
    print(f"בתים שנוצרו: {len(groups)}")
    print(f"בתים עם קבוצות: {len(groups_with_teams)}")

if __name__ == "__main__":
    main()
