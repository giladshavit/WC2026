# Production Setup — Predicto

## Railway Backend

**URL:** `https://wc2026-production-73ee.up.railway.app`

**Health check:** `GET /health` → `{"status": "healthy"}`

### Services
- **Backend:** FastAPI (Python 3.11) — auto-deploy on `git push` to master
- **Database:** PostgreSQL (Railway managed)

### Environment Variables (WC2026 service)
```
DATABASE_URL=postgresql://postgres:***@caboose.proxy.rlwy.net:10657/railway
SECRET_KEY=***
ADMIN_USER_IDS=1
CORS_ORIGINS=*
FOOTBALL_DATA_API_KEY=***
```

### Files added to project
- `backend/Procfile` — defines how Railway runs the server:
```
  web: uvicorn main:app --host 0.0.0.0 --port $PORT
```
- `backend/.python-version` — sets Python 3.11 (required for Railway)

---

## Database — Initialized Data

| Table / Data | Count | Script |
|---|---|---|
| Match templates | 104 | `create_templates/create_matches_template.py` |
| Group templates | 12 | `create_templates/create_group_template.py` |
| Third place combinations | 495 | `create_templates/load_combinations_from_google_sheet.py` |
| Column mappings | 8 | `create_templates/create_column_mapping.py` |
| BonusResults singleton | 1 | `create_templates/create_bonus_results.py` |
| ThirdPlaceGroupCounts | 1 | `create_templates/create_third_place_group_counts.py` |
| TournamentConfig | 1 (PRE_TOURNAMENT) | `create_templates/create_tournament_config.py` |
| Teams | 48 | `start_game/create_teams.py` |
| Groups | 12 | `start_game/create_groups.py` |
| Matches | 104 | `start_game/create_matches.py` |
| Knockout results | 32 | `start_game/create_knockout_results.py` |
| Global league | 1 (id=2, code=GLOBAL00) | `start_game/create_global_league.py` |
| Admin user | 1 (id=1, username=admin) | curl /api/auth/register |

### Full initialization order (if re-initializing)
```bash
# Step 1 — templates
DATABASE_URL=postgresql://... python utils/create_templates/create_all_templates.py

# Step 2 — game data
DATABASE_URL=postgresql://... python utils/start_game/start_game.py

# Step 3 — admin user
curl -X POST https://wc2026-production-73ee.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "name": "Gilad", "password": "YOUR_PASSWORD"}'
```

---

## Mobile App — API Configuration

**File:** `mobile-app/src/services/api.ts`
```typescript
const PRODUCTION_URL = 'https://wc2026-production-73ee.up.railway.app';
const DEVICE_IP = 'wc2026-production-73ee.up.railway.app';

function getApiBaseUrl(): string {
  if (!__DEV__) return PRODUCTION_URL;
  if (Platform.OS === 'web') return 'http://localhost:8000';
  if (!Device.isDevice) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
  }
  return `https://${DEVICE_IP}`;
}
```

### Modes
| Mode | URL | How |
|---|---|---|
| Development — computer | `http://localhost:8000` | iOS simulator |
| Development — physical device | `http://10.100.102.108:8000` | Change DEVICE_IP to computer IP |
| Simulation / testing | Railway | Replace function body with `return PRODUCTION_URL` |
| Production build (EAS) | Railway | Automatic (`__DEV__ = false`) |

---

## Railway — Useful Commands

### Deploy
Every `git push` to master → automatic deploy.
Check status: Railway → WC2026 service → Deployments

### Real-time logs
Railway → WC2026 service → View Logs

### Run script on production DB
```bash
npm install -g @railway/cli
railway login
railway link
railway run python utils/start_game/start_game.py
```

### Query DB directly
Railway → Postgres service → Database → Run SQL

---

## Costs
- **Railway Hobby Plan:** $5/month
- **PostgreSQL:** included (up to 1GB)
- **Currently on Trial** — upgrade to Hobby before trial ends

---

## App Store Reviewer Account

| Field | Value |
|---|---|
| Username | reviewer |
| Password | Review2026! |
| Email | reviewer@predicto.app |
| User ID | 2 |
| League | Global (GLOBAL00) |

> Add these credentials to "Notes for reviewer" in App Store Connect during submission.
