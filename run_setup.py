#!/usr/bin/env python3
"""
סקריפט להרצת הגדרת מונדיאל 2026
"""

import sys
import os

# מוסיף את תיקיית backend ל-Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# מריץ את הסקריפט הראשי
from mock_data.setup_world_cup import main

if __name__ == "__main__":
    print("=== הגדרת מונדיאל 2026 ===")
    print("וודא שהשרת רץ על http://localhost:8000")
    print()
    
    try:
        main()
    except KeyboardInterrupt:
        print("\nהפעולה בוטלה על ידי המשתמש")
    except Exception as e:
        print(f"\nשגיאה: {e}")
        print("וודא שהשרת רץ ונסה שוב")
