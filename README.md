# World Cup 2026 Predictions Game

משחק ניחושים למונדיאל 2026 עם ניחושי משחקים ומסלול מלא.

## התקנה

### Backend (Python FastAPI)

1. התקן את התלויות:
```bash
cd backend
pip install -r requirements.txt
```

2. הפעל את השרת:
```bash
cd backend
uvicorn main:app --reload
```

השרת יעבוד על: http://localhost:8000

## API Endpoints

### ניחושים
- `GET /api/users/{user_id}/predictions` - קבל את כל הניחושים של המשתמש

## מבנה הפרויקט

```
backend/
├── models/           # מחלקות הנתונים
│   ├── base.py      # מחלקות בסיס אבסטרקטיות
│   ├── user.py      # משתמש
│   ├── matches.py   # משחקים
│   └── predictions.py # ניחושים
├── services/        # לוגיקה עסקית
│   └── prediction_service.py
├── api/            # API endpoints
│   └── predictions.py
├── database.py     # הגדרות בסיס נתונים
├── main.py         # אפליקציה ראשית
└── requirements.txt
```

## Core Entities

1. **User** - משתמש
2. **Match** - משחק (GroupStageMatch, KnockoutMatch)
3. **Prediction** - ניחוש (MatchPrediction, GroupStagePrediction, KnockoutStagePrediction)
