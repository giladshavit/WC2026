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

### הגדרת נתוני מונדיאל

לאחר שהשרת רץ, הרץ את הסקריפט להגדרת נתונים:

```bash
python run_setup.py
```

זה יוסיף:
- 48 קבוצות מכל היבשות
- 12 בתים עם 4 קבוצות בכל בית
- 72 משחקי בתים (6 משחקים בכל בית)

## API Endpoints

### ניחושים
- `GET /api/users/{user_id}/predictions` - קבל את כל הניחושים של המשתמש
- `PUT /api/matches/{match_id}/predictions` - עדכן ניחוש למשחק בודד
- `POST /api/predictions/batch` - עדכן ניחושים מרובים

### Admin
- `GET /api/admin/teams` - קבל את כל הקבוצות
- `POST /api/admin/teams` - הוסף קבוצה חדשה
- `POST /api/admin/teams/batch` - הוסף קבוצות מרובות
- `POST /api/admin/matches/group-stage` - צור משחק בתים
- `POST /api/admin/matches/knockout` - צור משחק נוקאאוט

## מבנה הפרויקט

```
WC 2026/
├── backend/              # Python FastAPI
│   ├── models/          # מחלקות הנתונים
│   ├── services/        # לוגיקה עסקית
│   ├── api/            # API endpoints
│   ├── database.py     # הגדרות בסיס נתונים
│   ├── main.py         # אפליקציה ראשית
│   └── requirements.txt
├── mock_data/           # נתוני בדיקה
│   ├── world_cup_teams.json
│   └── setup_world_cup.py
└── run_setup.py        # סקריפט הרצה
```

## Core Entities

1. **User** - משתמש
2. **Team** - קבוצה
3. **Match** - משחק (GroupStageMatch, KnockoutMatch)
4. **Prediction** - ניחוש (MatchPrediction, GroupStagePrediction, KnockoutStagePrediction)
