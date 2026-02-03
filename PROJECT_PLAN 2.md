# World Cup 2026 - Cleanup & Enhancement Plan

## Phase 1: Backend Cleanup & Organization

### 1.1 API Endpoint Cleanup
**Target files**: `backend/api/predictions.py`, `backend/api/groups.py`, `backend/api/matches.py`, `backend/api/knockout.py`

**Actions**:
- Remove unused endpoints from `predictions.py` (lines 285-452):
  - Legacy group endpoints (duplicated in `groups.py`)
  - Deprecated prediction endpoints
  - Keep only: group predictions CRUD, third-place predictions, match predictions with stage validation
- Clean `groups.py`: verify endpoints are actually used by frontend/mobile
- Clean `knockout.py`: remove Hebrew comments, consolidate helper functions
- Delete `matches.py` (already empty except comment)

### 1.2 Services Cleanup
**Target directory**: `backend/services/`

**Actions**:
- Audit each service for unused methods (derived from API cleanup)
- Remove deprecated methods from:
  - `prediction_service.py`
  - `group_service.py`
  - `match_service.py`
- Keep: `scoring_service.py`, `stage_manager.py`, `results_service.py`, `team_service.py`

### 1.3 Backend Refactoring
**All backend files**

**Actions**:
- Consistent naming conventions (English only)
- Remove all Hebrew strings/comments (replace with English)
- Standardize error responses across all APIs
- Add proper typing hints throughout
- Consolidate database session management
- Improve code documentation

---

## Phase 2: Frontend Reorganization

### 2.1 Navigation Structure Redesign
**Target**: `frontend/src/App.tsx`, navigation components

**Current issue**: Nested tabs within tabs for knockout stages

**New structure**:
- Main navigation: Home, Predictions, Results, Leaderboard
- Predictions submenu (side navigation or dropdown):
  - Group Stage
  - Match Predictions
  - Third Place
  - Knockout Bracket (unified view)
- Replace nested tabs with single bracket visualization

### 2.2 Prediction Screens Refactor
**Target files**: 
- `GroupPredictionsPage.tsx`
- `PredictionsPage.tsx` 
- `ThirdPlacePredictionsPage.tsx`

**Actions**:
- Extract reusable components (TeamSelector, ScoreInput, PredictionCard)
- Consistent state management pattern
- Improve readability with better variable names
- Add loading states and error handling
- Standardize API call patterns

---

## Phase 3: Multi-User Authentication System

### 3.1 Backend Authentication
**New files**: `backend/api/auth.py`, `backend/services/auth_service.py`, `backend/models/session.py`

**Actions**:
- Implement JWT-based authentication
- Add password hashing (bcrypt)
- Create endpoints:
  - POST `/auth/register` (email + password)
  - POST `/auth/login` (returns JWT token)
  - POST `/auth/refresh` (refresh token)
  - GET `/auth/me` (current user info)
- Update `User` model: add `password_hash`, `created_at`, `last_login`
- Support "remember me" via refresh tokens

### 3.2 Database Migration
**New file**: `backend/utils/migrations/add_auth_fields.py`

**Actions**:
- Keep existing data under default user (user_id=1)
- Add password field to users table
- Create sessions table for token management
- No data loss - preserve all existing predictions

### 3.3 Frontend Authentication
**New files**: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`

**Actions**:
- AuthContext with JWT storage (localStorage)
- Auto-login on app start if token valid
- Login/Register screens with form validation
- Protected routes requiring authentication
- Update all API calls to include auth headers

### 3.4 Mobile Authentication
**New files**: `mobile-app/src/screens/auth/LoginScreen.tsx`, `mobile-app/src/screens/auth/RegisterScreen.tsx`

**Actions**:
- Use SecureStore for token storage (more secure than AsyncStorage)
- Auto-login on app launch
- Update API service to include auth headers
- Add logout functionality

### 3.5 OAuth Support (Future-Ready)
**Preparation**:
- Structure auth service to support multiple strategies
- Document OAuth integration points
- Implementation deferred to later phase

---

## Phase 4: Results Entry & Display System

### 4.1 Admin Results Interface
**Existing**: `backend/static/admin_results.html`

**Actions**:
- Keep admin-only results entry (current approach works)
- Ensure it covers all match types: group, knockout, third-place
- Add visual feedback after submission
- Show current tournament stage

### 4.2 Results Display in User UI
**All prediction screens**

**Actions**:
- Add result indicators next to predictions:
  - ✅ Correct prediction (green)
  - ❌ Incorrect prediction (red)
  - ⏳ Pending (gray)
- Show actual vs predicted scores
- Display points earned per prediction
- Update both frontend and mobile apps

### 4.3 Backend Results API
**Target**: `backend/api/results.py` (if exists, or create new)

**Actions**:
- GET `/results/matches/{match_id}` - single match result
- GET `/results/groups/{group_id}` - group final standings
- GET `/results/knockout` - all knockout results
- Integrate with scoring service to auto-calculate points

---

## Phase 5: Leaderboard & Leagues System

### 5.1 Database Schema
**New models**: `backend/models/league.py`

**Structure**:
```python
League:
  - id, name, invite_code (unique), created_by_user_id
  - is_public, created_at

LeagueMembership:
  - id, league_id, user_id, joined_at
```

### 5.2 Backend Leagues API
**New file**: `backend/api/leagues.py`

**Endpoints**:
- POST `/leagues` - create new league
- POST `/leagues/join` - join league with invite code
- GET `/leagues/{league_id}/members` - list members
- GET `/leagues/{league_id}/leaderboard` - league-specific leaderboard
- GET `/users/{user_id}/leagues` - user's leagues

### 5.3 Scoring Breakdown
**Update**: `backend/services/scoring_service.py`

**Actions**:
- Calculate separate point categories:
  - Group stage points
  - Match prediction points
  - Third place points
  - Knockout points (by round: R32, R16, QF, SF, Final)
- Add filters to leaderboard API:
  - `?category=all|groups|matches|knockout`
  - `?league_id=123`

### 5.4 Frontend Leaderboard
**New file**: `frontend/src/pages/LeaderboardPage.tsx`

**Features**:
- Overall leaderboard (all users)
- League-specific leaderboards
- Category filters (dropdown)
- User search/filter
- Current user highlight

### 5.5 Mobile Leaderboard
**New file**: `mobile-app/src/screens/LeaderboardScreen.tsx`

**Features**:
- Same as frontend (responsive mobile design)
- Pull-to-refresh
- League switcher

### 5.6 League Management UI
**New files**: 
- `frontend/src/pages/LeaguesPage.tsx`
- `mobile-app/src/screens/LeaguesScreen.tsx`

**Features**:
- Create league (generate invite code)
- Share invite code (copy/share functionality)
- View joined leagues
- Leave league option

---

## Phase 6: Android Support Verification

### 6.1 Configuration Check
**Target**: `mobile-app/app.json`, `mobile-app/package.json`

**Actions**:
- Verify Expo SDK version supports Android
- Check all dependencies for Android compatibility
- Review app.json for Android-specific settings

### 6.2 UI Testing on Android
**Manual testing checklist**:
- Install Expo Go on Android device
- Test all screens for layout issues
- Verify navigation works properly
- Check keyboard behavior
- Test API connectivity
- Validate token storage (SecureStore)

### 6.3 Android-Specific Adjustments
**If issues found**:
- Fix SafeArea issues (Android notches/navigation)
- Adjust keyboard avoiding view
- Fix any Android-specific styling issues

---

## Implementation Order

1. **Phase 1** (Backend Cleanup) - Foundation work
2. **Phase 3.1-3.2** (Backend Auth) - Enable multi-user
3. **Phase 2** (Frontend Reorganization) - Better UX
4. **Phase 3.3-3.4** (Frontend/Mobile Auth) - Connect to backend
5. **Phase 4** (Results Display) - Show predictions vs actuals
6. **Phase 5** (Leaderboard & Leagues) - Competition features
7. **Phase 6** (Android Verification) - Cross-platform validation

---

## Key Technical Decisions

- **Authentication**: JWT tokens with refresh tokens, no OAuth initially
- **Data preservation**: Existing predictions kept under user_id=1
- **League creation**: User-generated with invite codes
- **Results entry**: Admin-only via existing interface
- **Android**: Verify existing Expo setup works, minimal config changes
- **Language**: All code/comments in English going forward

---

## Task Checklist

### Phase 1: Backend Cleanup
- [ ] Remove unused API endpoints from predictions.py, groups.py, knockout.py; delete matches.py
- [ ] Audit and remove unused methods from services based on API cleanup
- [ ] Refactor backend code: English only, consistent naming, proper typing, better documentation

### Phase 3: Authentication
- [ ] Implement JWT authentication backend: auth.py, auth_service.py, session model, register/login/refresh endpoints
- [ ] Create migration to add password_hash to users table and sessions table
- [ ] Implement frontend authentication: AuthContext, Login/Register pages, protected routes, API headers
- [ ] Implement mobile authentication: Login/Register screens, SecureStore for tokens, auto-login

### Phase 2: Frontend Reorganization
- [ ] Redesign frontend navigation structure to remove nested tabs, create unified knockout bracket view
- [ ] Refactor prediction screens: extract reusable components, improve readability, standardize patterns

### Phase 4: Results Display
- [ ] Add result indicators to all prediction screens showing correct/incorrect/pending with visual feedback
- [ ] Create/enhance results API endpoints and integrate with scoring service for auto-calculation

### Phase 5: Leaderboard & Leagues
- [ ] Create League and LeagueMembership models with invite code system
- [ ] Implement leagues API: create, join, list members, leaderboard endpoints
- [ ] Update scoring service to calculate separate point categories with filtering capability
- [ ] Create leaderboard page with overall/league-specific views and category filters
- [ ] Create leagues management page for creating/joining/managing leagues
- [ ] Create mobile leaderboard screen with same features as frontend
- [ ] Create mobile leagues management screen with share functionality

### Phase 6: Android Support
- [ ] Verify Android support: check configs, test on Android device, fix any platform-specific issues

### Phase 7: Bracket Screenshot Feature
- [x] Add screenshot functionality to bracket screen with capture button
- [x] Install react-native-view-shot and expo-media-library dependencies
- [x] Implement captureBracket function with media library permissions
- [x] Add floating capture button with Hebrew text
- [x] Add sharing functionality for captured bracket images
- [x] Fix capture to include entire bracket (all scrolled content) not just visible area
- [x] Add onLayout handler to ensure bracket is ready before capture
- [x] Add proper error handling and logging for capture process

---

## Notes

- This plan was created on: January 2025
- Total estimated tasks: 19
- Approach: Work topic by topic, not all at once
- Language preference: English for all new code and comments
- User preference: Keep existing data, add multi-user support gradually
