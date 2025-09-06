# World Cup 2026 Prediction System

A comprehensive prediction system for the 2026 FIFA World Cup, built with FastAPI backend and React frontend.

## Features

- **User Management**: User registration, authentication, and profile management
- **Team Management**: Complete team database with country information
- **Match Predictions**: Predict scores for all World Cup matches
- **Group Stage Predictions**: Predict final group standings
- **Third Place Predictions**: Predict which third-place teams advance
- **Knockout Predictions**: Predict knockout stage winners
- **Real-time Scoring**: Automatic point calculation based on predictions vs actual results
- **Leaderboard**: Track user performance and rankings

## Technology Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: SQL toolkit and Object-Relational Mapping (ORM)
- **PostgreSQL**: Robust, open-source relational database
- **Pydantic**: Data validation using Python type annotations
- **Python 3.9+**: Core programming language

### Frontend
- **React 18**: Modern JavaScript library for building user interfaces
- **TypeScript**: Typed superset of JavaScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Declarative routing for React

## Project Structure

```
WC 2026/
├── backend/                 # FastAPI backend
│   ├── api/                # API endpoints
│   ├── models/             # Database models
│   ├── services/           # Business logic
│   ├── database.py         # Database configuration
│   └── main.py            # FastAPI application
├── frontend/               # React frontend
│   ├── src/               # Source code
│   ├── public/            # Static assets
│   └── package.json       # Dependencies
├── mock_data/             # Database seeding scripts
└── README.md              # This file
```

## Database Schema

### Core Tables

1. **users** - User accounts and profiles
2. **teams** - World Cup participating teams
3. **groups** - Group stage groups (A, B, C, etc.)
4. **matches** - All World Cup matches (group stage and knockout)
5. **match_predictions** - User predictions for individual matches
6. **group_stage_predictions** - User predictions for group standings
7. **third_place_predictions** - User predictions for advancing third-place teams
8. **knockout_stage_predictions** - User predictions for knockout stage winners

### Key Relationships

- Users can make multiple predictions
- Matches can have multiple predictions (one per user)
- Teams belong to groups in the group stage
- Knockout matches reference group stage results

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Predictions
- `GET /predictions/{user_id}` - Get user predictions
- `POST /predictions/match` - Create/update match prediction
- `POST /predictions/group` - Create/update group prediction
- `POST /predictions/third-place` - Create/update third-place prediction
- `POST /predictions/knockout` - Create/update knockout prediction

### Admin
- `POST /admin/teams` - Create team
- `POST /admin/matches/group-stage` - Create group stage match
- `POST /admin/matches/knockout` - Create knockout match
- `GET /admin/teams` - Get all teams
- `GET /admin/matches` - Get all matches

## Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Database Setup
1. Create PostgreSQL database
2. Update database connection in `backend/database.py`
3. Run database migrations
4. Seed with initial data using scripts in `mock_data/`

## Development

### Running the Backend
```bash
cd backend
uvicorn main:app --reload
```

### Running the Frontend
```bash
cd frontend
npm run dev
```

## Core Entities

1. **User** - משתמש
2. **Team** - קבוצה
3. **Match** - משחק (unified model for all match types)
4. **Prediction** - ניחוש (MatchPrediction, GroupStagePrediction, KnockoutStagePrediction)

## Prediction System

### Scoring System
- **Match Predictions**: Points based on exact score, correct winner, or correct result
- **Group Predictions**: Points for correct team positions
- **Third Place Predictions**: Points for correct advancing teams
- **Knockout Predictions**: Points for correct match winners

### Match Types
- **Group Stage**: Round-robin matches within groups
- **Round of 32**: First knockout round (48 teams → 32 teams)
- **Round of 16**: Second knockout round (32 teams → 16 teams)
- **Quarter Finals**: Third knockout round (16 teams → 8 teams)
- **Semi Finals**: Fourth knockout round (8 teams → 4 teams)
- **Final**: Championship match (4 teams → 2 teams, then 1 winner)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.