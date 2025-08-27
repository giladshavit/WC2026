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

def main():
    """הפונקציה הראשית"""
    print("=== יצירת בתים למונדיאל 2026 ===")
    
    # 1. יוצר את הבתים
    groups = create_groups()
    
    # 2. מביא את הבתים עם הקבוצות
    groups_with_teams = get_groups_with_teams()
    
    print("\n=== סיום יצירת בתים ===")
    print(f"בתים שנוצרו: {len(groups)}")
    print(f"בתים עם קבוצות: {len(groups_with_teams)}")

if __name__ == "__main__":
    main()
