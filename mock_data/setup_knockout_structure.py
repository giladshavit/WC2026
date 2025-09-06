import requests
import json
from typing import List, Dict, Any
from itertools import combinations

BASE_URL = "http://127.0.0.1:8000/api"

def create_third_place_combinations():
    """
    יוצר את כל 495 הקומבינציות האפשריות של 8 קבוצות מתוך 12 בתים
    """
    print("יוצר קומבינציות של מקומות 3...")
    
    # 12 הבתים האפשריים
    all_groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    
    # כל הקומבינציות האפשריות של 8 בתים
    group_combinations = list(combinations(all_groups, 8))
    
    print(f"סה\"כ {len(group_combinations)} קומבינציות אפשריות")
    
    combinations_created = []
    
    for i, combo in enumerate(group_combinations, 1):
        group_letters = ''.join(combo)
        
        try:
            response = requests.post(f"{BASE_URL}/admin/third-place-combinations", json={
                "group_letters": group_letters,
                "combination_number": i
            })
            
            if response.status_code == 200:
                result = response.json()
                combinations_created.append(result)
                print(f"נוצרה קומבינציה {i}: {group_letters}")
            else:
                print(f"שגיאה ביצירת קומבינציה {i}: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"שגיאה ביצירת קומבינציה {i}: {e}")
    
    print(f"נוצרו {len(combinations_created)} קומבינציות")
    return combinations_created

def create_match_templates():
    """
    יוצר תבניות למשחקי נוקאאוט לפי המסמך הרשמי של FIFA
    """
    print("יוצר תבניות למשחקי נוקאאוט...")
    
    # תבניות למשחקי round32 לפי המסמך הרשמי
    round32_templates = [
        # משחקים קבועים - מקומות 1 ו-2
        {"match_number": 1, "home_team_source": "A1", "away_team_source": "B2", "description": "A1 vs B2"},
        {"match_number": 2, "home_team_source": "C1", "away_team_source": "D2", "description": "C1 vs D2"},
        {"match_number": 3, "home_team_source": "E1", "away_team_source": "F2", "description": "E1 vs F2"},
        {"match_number": 4, "home_team_source": "G1", "away_team_source": "H2", "description": "G1 vs H2"},
        {"match_number": 5, "home_team_source": "I1", "away_team_source": "J2", "description": "I1 vs J2"},
        {"match_number": 6, "home_team_source": "K1", "away_team_source": "L2", "description": "K1 vs L2"},
        
        # משחקים קבועים - מקומות 2 ו-1
        {"match_number": 7, "home_team_source": "B1", "away_team_source": "A2", "description": "B1 vs A2"},
        {"match_number": 8, "home_team_source": "D1", "away_team_source": "C2", "description": "D1 vs C2"},
        {"match_number": 9, "home_team_source": "F1", "away_team_source": "E2", "description": "F1 vs E2"},
        {"match_number": 10, "home_team_source": "H1", "away_team_source": "G2", "description": "H1 vs G2"},
        {"match_number": 11, "home_team_source": "J1", "away_team_source": "I2", "description": "J1 vs I2"},
        {"match_number": 12, "home_team_source": "L1", "away_team_source": "K2", "description": "L1 vs K2"},
        
        # משחקים דינמיים - מקומות 3 (יוצרו לפי קומבינציה)
        {"match_number": 13, "home_team_source": "3rd_combination_1", "away_team_source": "3rd_combination_2", "description": "3rd Place 1 vs 3rd Place 2"},
        {"match_number": 14, "home_team_source": "3rd_combination_3", "away_team_source": "3rd_combination_4", "description": "3rd Place 3 vs 3rd Place 4"},
        {"match_number": 15, "home_team_source": "3rd_combination_5", "away_team_source": "3rd_combination_6", "description": "3rd Place 5 vs 3rd Place 6"},
        {"match_number": 16, "home_team_source": "3rd_combination_7", "away_team_source": "3rd_combination_8", "description": "3rd Place 7 vs 3rd Place 8"},
    ]
    
    templates_created = []
    
    for template in round32_templates:
        try:
            response = requests.post(f"{BASE_URL}/admin/match-templates", json={
                "stage": "round32",
                "match_number": template["match_number"],
                "home_team_source": template["home_team_source"],
                "away_team_source": template["away_team_source"],
                "description": template["description"]
            })
            
            if response.status_code == 200:
                result = response.json()
                templates_created.append(result)
                print(f"נוצרה תבנית למשחק {template['match_number']}: {template['description']}")
            else:
                print(f"שגיאה ביצירת תבנית למשחק {template['match_number']}: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"שגיאה ביצירת תבנית למשחק {template['match_number']}: {e}")
    
    print(f"נוצרו {len(templates_created)} תבניות למשחקים")
    return templates_created

def main():
    """הפונקציה הראשית"""
    print("=== יצירת מבנה הנוקאאוט למונדיאל 2026 ===")
    
    # יוצר קומבינציות
    combinations = create_third_place_combinations()
    
    # יוצר תבניות למשחקים
    templates = create_match_templates()
    
    print("\n=== סיום יצירת מבנה הנוקאאוט ===")
    print(f"קומבינציות שנוצרו: {len(combinations)}")
    print(f"תבניות למשחקים שנוצרו: {len(templates)}")

if __name__ == "__main__":
    main()


