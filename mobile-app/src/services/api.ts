// Use localhost for emulator/web, network IP for physical device
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Change this to your Mac's IP address when testing on physical device
const DEVICE_IP = '10.100.102.108';

// For web: localhost. For iOS Simulator: localhost. For Android Emulator: 10.0.2.2. For physical device: network IP
function getApiBaseUrl(): string {
  if (Platform.OS === 'web') return 'http://localhost:8000';
  if (!Device.isDevice) {
    // Simulator/Emulator
    return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
  }
  return `http://${DEVICE_IP}:8000`;
}
const API_BASE_URL = getApiBaseUrl();

export interface Team {
  id: number;
  name: string;
  flag_url?: string;
}

export interface UserPrediction {
  home_score: number | null;
  away_score: number | null;
  predicted_winner: number | null;
  points: number | null;
  is_editable: boolean | null;
  is_tempted?: boolean;
}

export interface MatchesResponse {
  matches: Match[];
  matches_score: number | null;
}

export interface GroupsResponse {
  groups: GroupPrediction[];
  groups_score: number | null;
  groups_penalty?: number;
}

export interface KnockoutResponse {
  predictions: KnockoutPrediction[];
  knockout_score: number | null;
  knockout_penalty?: number;
  can_edit_drafts?: boolean;
}

export interface AppConfig {
  current_stage: string;
  penalty_per_change: number;
}

export interface User {
  user_id: number;
  username: string;
  name: string;
  total_points: number;
  created_at: string;
  last_login: string | null;
  is_admin?: boolean;
}

export interface AuthResponse {
  user_id: number;
  username: string;
  name: string;
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
}

export interface Match {
  id: number;
  stage: string;
  home_team: Team;
  away_team: Team;
  date: string;
  status: string;
  user_prediction: UserPrediction;
  can_edit: boolean;
  actual_result?: {
    home_score: number;
    away_score: number;
    winner_team_id: number | null;
    current_winner?: 'home' | 'away' | 'draw' | null;
  } | null;
  group?: string;
  match_number?: number;
  home_team_source?: string;
  away_team_source?: string;
}

export interface GroupPrediction {
  id: number | null;
  group_id: number;
  group_name: string;
  teams: Team[];
  first_place: number | null;
  second_place: number | null;
  third_place: number | null;
  fourth_place: number | null;
  points: number;
  penalty_points?: number;
  is_editable: boolean;
  created_at: string | null;
  updated_at: string | null;
  result?: {
    id: number;
    first_place: number;
    second_place: number;
    third_place: number;
    fourth_place: number;
  } | null;
}

export interface ThirdPlaceTeam {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
  flag_url?: string;
  is_selected: boolean;
}

export interface ThirdPlacePredictionData {
  eligible_teams: ThirdPlaceTeam[];
  prediction: {
    id: number | null;
    points: number;
    is_editable: boolean;
    changed_groups: string[];
    created_at: string | null;
    updated_at: string | null;
  };
  third_place_score: number | null;
  third_place_penalty?: number;
  result?: {
    first_team_qualifying: number;
    second_team_qualifying: number;
    third_team_qualifying: number;
    fourth_team_qualifying: number;
    fifth_team_qualifying: number;
    sixth_team_qualifying: number;
    seventh_team_qualifying: number;
    eighth_team_qualifying: number;
    result_groups: (string | null)[];
  } | null;
  error?: string; // Optional error field for API errors
}

export interface KnockoutPrediction {
  id: number;
  user_id: number;
  knockout_result_id: number;
  template_match_id: number;
  stage: string;
  team1_id: number;
  team2_id: number;
  winner_team_id: number | null;
  status: string;
  points: number;
  penalty_points?: number;
  is_editable: boolean;
  created_at: string;
  updated_at: string;
  team1_name: string | null;
  team2_name: string | null;
  winner_team_name: string | null;
  team1_short_name: string | null;
  team2_short_name: string | null;
  winner_team_short_name: string | null;
  team1_flag: string | null;
  team2_flag: string | null;
  winner_team_flag: string | null;
  // Validation fields
  is_correct?: boolean | null; // True if prediction is correct (match finished)
  team1_is_valid?: boolean | null; // True if team1 can reach this match (match not finished)
  team2_is_valid?: boolean | null; // True if team2 can reach this match (match not finished)
  team1_is_eliminated?: boolean | null; // True if team1 has been eliminated
  team2_is_eliminated?: boolean | null; // True if team2 has been eliminated
}

export interface BracketResetPreview {
  invalid_count: number;
  unreachable_count: number;
  penalty: number;
  has_used_reset: boolean;
}

export interface BracketResetResult {
  success: boolean;
  penalty_applied: number;
  invalid_count: number;
  unreachable_count: number;
}

// League interfaces
export interface League {
  id: number;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: number;
  created_at: string;
  member_count: number;
  joined_at?: string;
  score_mode?: 'multi' | 'classic';
}

export interface BonusOptions {
  g1: Array<{ value: string; label: string }>;
  g2: Array<{ value: string; label: string }>;
  g3: Array<{ value: string; label: string }>;
  g4: Array<{ value: string; label: string }>;
  g5: Array<{ value: string; label: string }>;
  g6: Array<{ value: string; label: string }>;
  k1: Array<{ value: string; label: string }>;
  k2: Array<{ value: string; label: string }>;
  k3: Array<{ value: string; label: string }>;
  t1: Array<{ value: string; label: string }>;
  t2: Array<{ value: string; label: string }>;
  t3: Array<{ value: string; label: string }>;
}

export interface BonusOutcomeStatsResponse {
  field_key: string;
  settled: boolean;
  correct: number;
  incorrect: number;
  total_answered: number;
  correct_pct: number;
  incorrect_pct: number;
}

export interface BonusPrediction {
  id: number;
  user_id: number;
  g1_total_goals_group: string | null;
  g2_top_group_id: number | null;
  g3_top_team_id: number | null;
  g4_perfect_teams: string | null;
  g5_clean_sheet_teams: string | null;
  g6_scoreless_draws_group: string | null;
  k1_total_goals_knockout: string | null;
  k2_penalty_shootouts: string | null;
  k3_third_place_quarters: string | null;
  t1_total_goals_tournament: string | null;
  t2_champion_team_id: number | null;
  t3_top_scorer: string | null;
  bonus_score: number;
  penalty_points: number;
  changes_count: number;
  groups_is_editable: boolean;
  knockout_is_editable: boolean;
  tournament_is_editable: boolean;
  groups_status: string;
  knockout_status: string;
  tournament_status: string;
  q_g1_status?: string;
  q_g2_status?: string;
  q_g3_status?: string;
  q_g4_status?: string;
  q_g5_status?: string;
  q_g6_status?: string;
  q_k1_status?: string;
  q_k2_status?: string;
  q_k3_status?: string;
  q_t1_status?: string;
  q_t2_status?: string;
  q_t3_status?: string;
  correct_values?: Record<string, string | null>;
  interim_values?: Record<string, string | null>;
}

export interface LeagueStanding {
  rank: number;
  user_id: number;
  username: string;
  name: string;
  total_points: number;
  matches_points: number;
  groups_points: number;
  third_place_points: number;
  knockout_points: number;
  bonus_points?: number;
  joined_at?: string;
  matches_exact_count?: number;
  matches_correct_count?: number;
  matches_wrong_count?: number;
}

export interface LeagueStandingsResponse {
  league_info: {
    id: number;
    name: string;
    description: string | null;
    invite_code: string;
    created_by: number;
    created_at: string;
    member_count: number;
    score_mode?: 'multi' | 'classic';
  } | null;
  standings: LeagueStanding[];
  total_count: number;
  page: number;
  page_size: number;
  current_user_entry: LeagueStanding | null;
}

export interface CreateLeagueRequest {
  name: string;
  description?: string;
  score_mode?: 'multi' | 'classic';
}

export interface JoinLeagueRequest {
  invite_code: string;
}

export interface MemberMatchPrediction {
  user_id: number;
  username: string;
  name: string | null;
  home_score: number | null;
  away_score: number | null;
  points: number;
  prediction_status: 'exact' | 'correct_outcome' | 'wrong' | null;
  is_tempted?: boolean;
}

export interface LeagueMatchPredictionsResponse {
  match_id: number;
  match_status: string;
  actual_result: { home_score: number; away_score: number } | null;
  predictions: MemberMatchPrediction[];
}

export interface MatchStats {
  match_id?: number;
  total_predictions: number;
  has_result: boolean;
  winner_distribution?: {
    home_pct: number;
    draw_pct: number;
    away_pct: number;
  };
  popular_scores?: Array<{ home: number; away: number; count: number }>;
  accuracy?: {
    exact_pct: number;
    correct_pct: number;
    wrong_pct: number;
  };
  error?: string;
}

export interface ThirdPlaceStats {
  total_predictions: number;
  has_result: boolean;
  group_pick_pct?: Record<string, number>;
  group_accuracy?: Record<string, number>;
  accuracy_distribution?: Record<string, number>;
}

export interface KnockoutStats {
  template_match_id?: number;
  total_predictions: number;
  has_result: boolean;
  winner_name?: string;
  winner_flag?: string;
  team1_name?: string;
  team1_flag?: string;
  team2_name?: string;
  team2_flag?: string;
  top_matchups?: Array<{
    team_a: { id: number; name: string; flag_url?: string };
    team_b: { id: number; name: string; flag_url?: string };
    matchup_pct: number;
    team_a_winner_pct: number;
    team_b_winner_pct: number;
  }>;
  exact_winner_pct?: number;
  partial_winner_pct?: number;
  correct_matchup_pct?: number;
  error?: string;
}

export class ApiService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Authentication methods
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get current user');
      }

      return await response.json();
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  logout(): void {
    this.accessToken = null;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async getMatches(userId: number = 1): Promise<MatchesResponse> {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/predictions/matches?user_id=${userId}&_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw error;
    }
  }

  async updateMatchPrediction(
    userId: number,
    matchId: number,
    homeScore: number | null,
    awayScore: number | null
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating match prediction:', error);
      throw error;
    }
  }

  async getTemptationSuggestions(
    matchId: number,
    userId: number
  ): Promise<{
    available: boolean;
    suggestions: Array<{ home_score: number; away_score: number }>;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/predictions/matches/${matchId}/temptation-suggestions?user_id=${userId}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching temptation suggestions:', error);
      throw error;
    }
  }

  async updateBatchMatchPredictions(
    userId: number,
    predictions: Array<{
      match_id: number;
      home_score: number | null;
      away_score: number | null;
      is_tempted?: boolean;
    }>
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/matches/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          predictions: predictions.map(p => ({
            match_id: p.match_id,
            home_score: p.home_score,
            away_score: p.away_score,
            is_tempted: p.is_tempted ?? false,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating batch match predictions:', error);
      throw error;
    }
  }

  async getGroupPredictions(userId: number = 1): Promise<GroupsResponse> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/predictions/groups?user_id=${userId}&_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching group predictions:', error);
      throw error;
    }
  }

  /** Get groups with teams (for bonus g2/g3). Uses getGroupPredictions. */
  async getGroups(userId: number = 1): Promise<GroupPrediction[]> {
    const data = await this.getGroupPredictions(userId);
    return data.groups || [];
  }

    async updateBatchGroupPredictions(
      userId: number,
      predictions: Array<{
        group_id: number;
        first_place: number;
        second_place: number;
        third_place: number;
        fourth_place: number;
      }>
    ): Promise<any> {
      try {
        const response = await fetch(`${this.baseUrl}/api/predictions/groups/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          predictions: predictions,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating batch group predictions:', error);
      throw error;
    }
  }

  async getThirdPlacePredictionsData(userId: number = 1): Promise<ThirdPlacePredictionData> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/predictions/third-place?user_id=${userId}&_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching third place predictions data:', error);
      throw error;
    }
  }

  async updateThirdPlacePrediction(
    userId: number,
    advancingTeamIds: number[]
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/third-place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          team_ids: advancingTeamIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating third place prediction:', error);
      throw error;
    }
  }

  // Knockout Predictions
  async getKnockoutPredictions(userId: number = 1, stage?: string, isDraft: boolean = false): Promise<KnockoutResponse> {
    try {
      const timestamp = new Date().getTime();
      const stageParam = stage ? `&stage=${stage}` : '';
      const draftParam = isDraft ? `&is_draft=true` : '';
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout?user_id=${userId}${stageParam}${draftParam}&_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching knockout predictions:', error);
      throw error;
    }
  }

  async getDraftChangesCount(userId: number = 1): Promise<any> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/draft-changes-count?user_id=${userId}&_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching draft changes count:', error);
      throw error;
    }
  }

  async createAllDrafts(userId: number = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/create-all-drafts?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating drafts:', error);
      throw error;
    }
  }

  async deleteAllDrafts(userId: number = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/delete-all-drafts?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting drafts:', error);
      throw error;
    }
  }

  async resetDrafts(userId: number = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/reset-drafts?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error resetting drafts:', error);
      throw error;
    }
  }

  async commitDrafts(userId: number = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/commit-drafts?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error committing drafts:', error);
      throw error;
    }
  }

  async getBracketResetPreview(userId: number): Promise<BracketResetPreview> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(
        `${this.baseUrl}/api/knockout/bracket-reset/preview?user_id=${userId}&_t=${timestamp}`,
        { method: 'GET' }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching bracket reset preview:', error);
      throw error;
    }
  }

  async applyBracketReset(userId: number): Promise<BracketResetResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/knockout/bracket-reset/apply?user_id=${userId}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error applying bracket reset:', error);
      throw error;
    }
  }

  async updateKnockoutPrediction(
    predictionId: number,
    winnerTeamNumber: number,
    winnerTeamName: string,
    isDraft: boolean = false
  ): Promise<any> {
    try {
      const draftParam = isDraft ? '?is_draft=true' : '';
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/${predictionId}${draftParam}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          winner_team_number: winnerTeamNumber,
          winner_team_name: winnerTeamName,
        }),
      });

      if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody?.detail) {
            detail = errBody.detail;
          }
        } catch (_) {}
        const err: any = new Error(detail);
        err.detail = detail;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating knockout prediction:', error);
      throw error;
    }
  }

  async updateBatchKnockoutPredictions(
    userId: number,
    predictions: Array<{
      prediction_id: number;
      winner_team_number: number; // 1 or 2
      winner_team_name: string;
    }>
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          predictions: predictions,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating batch knockout predictions:', error);
      throw error;
    }
  }

  // App Configuration
  async getAppConfig(): Promise<AppConfig> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/app/config?_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching app config:', error);
      throw error;
    }
  }

  async getAppVersion(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/app/version`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching app version:', error);
      throw error;
    }
  }

  async getAppStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/app/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching app status:', error);
      throw error;
    }
  }

  async getCurrentStage(): Promise<any> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/admin/stage/current?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching current stage:', error);
      throw error;
    }
  }

  async advanceStage(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/stage/advance`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error advancing stage:', error);
      throw error;
    }
  }

  async updateStage(stageName: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/stage/update?stage=${encodeURIComponent(stageName)}`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating stage:', error);
      throw error;
    }
  }

  async resetStage(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/stage/reset`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error resetting stage:', error);
      throw error;
    }
  }

  async getAdminMatches(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/matches/results`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching admin matches:', error);
      throw error;
    }
  }

  async updateMatchResult(matchId: number, scores: {
    home_team_score?: number;
    away_team_score?: number;
    home_score?: number;
    away_score?: number;
    home_team_score_120?: number;
    away_team_score_120?: number;
    home_team_penalties?: number;
    away_team_penalties?: number;
    outcome_type?: string;
  }): Promise<any> {
    try {
      const body = {
        home_team_score: scores.home_team_score ?? scores.home_score ?? 0,
        away_team_score: scores.away_team_score ?? scores.away_score ?? 0,
        home_team_score_120: scores.home_team_score_120,
        away_team_score_120: scores.away_team_score_120,
        home_team_penalties: scores.home_team_penalties,
        away_team_penalties: scores.away_team_penalties,
        outcome_type: scores.outcome_type ?? 'regular',
      };
      const response = await fetch(`${this.baseUrl}/api/admin/matches/${matchId}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating match result:', error);
      throw error;
    }
  }

  async updateMatchStatus(matchId: number, status: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/matches/${matchId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, outcome_type: 'regular' }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating match status:', error);
      throw error;
    }
  }

  async getAdminGroups(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/groups/results`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching admin groups:', error);
      throw error;
    }
  }

  async updateGroupResult(groupId: number, result: {
    first_place: number;
    second_place: number;
    third_place: number;
    fourth_place: number;
  }): Promise<any> {
    try {
      const body = {
        first_place_team_id: result.first_place,
        second_place_team_id: result.second_place,
        third_place_team_id: result.third_place,
        fourth_place_team_id: result.fourth_place,
      };
      const response = await fetch(`${this.baseUrl}/api/admin/groups/${groupId}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating group result:', error);
      throw error;
    }
  }

  async getAdminKnockoutMatches(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/knockout/results`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching admin knockout matches:', error);
      throw error;
    }
  }

  async deleteAllKnockoutResults(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/delete-all-knockout-results`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error deleting knockout results:', error);
      throw error;
    }
  }

  async rebuildRound32Bracket(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/bracket/rebuild-round32`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error rebuilding Round 32 bracket:', error);
      throw error;
    }
  }

  async getAdminThirdPlaceResults(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/third-place/results`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching admin third place results:', error);
      throw error;
    }
  }

  async updateAdminThirdPlaceResult(result: {
    first_team_qualifying: number;
    second_team_qualifying: number;
    third_team_qualifying: number;
    fourth_team_qualifying: number;
    fifth_team_qualifying: number;
    sixth_team_qualifying: number;
    seventh_team_qualifying: number;
    eighth_team_qualifying: number;
  }): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/third-place/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating third place result:', error);
      throw error;
    }
  }

  async getAdminBonusResults(): Promise<Record<string, string | null>> {
    const response = await fetch(`${this.baseUrl}/api/admin/bonus/results`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async updateBonusInterim(payload: Record<string, string | null>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/admin/bonus/interim`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  async updateBonusResults(
    results: Partial<Record<'g1_correct' | 'g2_correct' | 'g3_correct' | 'g4_correct' |
      'g5_correct' | 'g6_correct' | 'k1_correct' | 'k2_correct' | 'k3_correct' |
      't1_correct' | 't2_correct' | 't3_correct',
      string | null>>
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/admin/bonus/results`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async createRandomGroupAndThirdPlaceResults(updateExisting: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/create-random-group-and-third-place-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_existing: updateExisting }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error creating random results:', error);
      throw error;
    }
  }

  async settleBonusQuestion(
    fieldKey: string,
    correctValues: string | string[],
  ): Promise<{ correct: number; incorrect: number; skipped_already_settled: number }> {
    const values = Array.isArray(correctValues) ? correctValues : [correctValues];
    const response = await fetch(`${this.baseUrl}/api/admin/bonus/settle-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_key: fieldKey, correct_values: values }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async generateTestUsers(count: number = 50): Promise<{ created: number; predictions_filled: number; errors: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/generate-test-users?count=${count}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error generating test users:', error);
      throw error;
    }
  }

  async generateTestUsersDraws(count: number = 50): Promise<{ created: number; predictions_filled: number; errors: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/create-test-users-draws?count=${count}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error generating draw test users:', error);
      throw error;
    }
  }

  async deleteAllResults(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/delete-all-results`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error deleting all results:', error);
      throw error;
    }
  }

  // League methods
  async getUserLeagues(): Promise<League[]> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user leagues:', error);
      throw error;
    }
  }

  async createLeague(leagueData: CreateLeagueRequest): Promise<League> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(leagueData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('createLeague failed (handled by caller):', error);
      throw error;
    }
  }

  async joinLeague(inviteCode: string): Promise<any> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ invite_code: inviteCode }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('joinLeague failed (handled by caller):', error);
      throw error;
    }
  }

  async getGlobalStandings(params?: {
    sort_by?: string;
    page?: number;
    page_size?: number;
  }): Promise<LeagueStandingsResponse> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      const searchParams = new URLSearchParams();
      if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params?.page != null) searchParams.set('page', String(params.page));
      if (params?.page_size != null) searchParams.set('page_size', String(params.page_size));
      const qs = searchParams.toString();
      const url = `${this.baseUrl}/api/leagues/global${qs ? `?${qs}` : ''}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching global standings:', error);
      throw error;
    }
  }

  async getLeagueStandings(
    leagueId: number,
    params?: { sort_by?: string; page?: number; page_size?: number }
  ): Promise<LeagueStandingsResponse> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      const searchParams = new URLSearchParams();
      if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params?.page != null) searchParams.set('page', String(params.page));
      if (params?.page_size != null) searchParams.set('page_size', String(params.page_size));
      const qs = searchParams.toString();
      const url = `${this.baseUrl}/api/leagues/${leagueId}/standings${qs ? `?${qs}` : ''}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching league standings:', error);
      throw error;
    }
  }

  async getLeagueInfo(leagueId: number): Promise<League> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues/${leagueId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching league info:', error);
      throw error;
    }
  }

  async getLeagueMatchPredictions(
    leagueId: number,
    matchId: number
  ): Promise<LeagueMatchPredictionsResponse> {
    const headers: HeadersInit = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(
      `${this.baseUrl}/api/leagues/${leagueId}/match/${matchId}/predictions`,
      { headers }
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  async getGlobalMatchPredictions(matchId: number): Promise<LeagueMatchPredictionsResponse> {
    const headers: HeadersInit = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(
      `${this.baseUrl}/api/leagues/global/match/${matchId}/predictions`,
      { headers }
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  async leaveLeague(leagueId: number): Promise<void> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues/${leagueId}/leave`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error leaving league:', error);
      throw error;
    }
  }

  // Statistics methods
  async getUserFullProfile(userId: number): Promise<any> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/user/${userId}/profile?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  async getMatchStatistics(matchId: number): Promise<MatchStats> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/matches/${matchId}?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching match statistics:', error);
      throw error;
    }
  }

  async getGroupStatistics(groupId: number): Promise<any> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/groups/${groupId}?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching group statistics:', error);
      throw error;
    }
  }

  async getThirdPlaceStatistics(): Promise<ThirdPlaceStats> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/third-place?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching third place statistics:', error);
      throw error;
    }
  }

  async getKnockoutMatchStatistics(templateMatchId: number): Promise<KnockoutStats> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/knockout/${templateMatchId}?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching knockout match statistics:', error);
      throw error;
    }
  }

  async getUserMatchProfile(userId: number): Promise<any> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${this.baseUrl}/api/stats/user/${userId}/matches?_t=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching user match profile:', error);
      throw error;
    }
  }

  // Stats aliases (used by modals)
  async getMatchStats(matchId: number): Promise<MatchStats> {
    return this.getMatchStatistics(matchId);
  }

  async getGroupStats(groupId: number): Promise<any> {
    return this.getGroupStatistics(groupId);
  }

  async getThirdPlaceStats(): Promise<ThirdPlaceStats> {
    return this.getThirdPlaceStatistics();
  }

  async getKnockoutMatchStats(templateMatchId: number): Promise<KnockoutStats> {
    return this.getKnockoutMatchStatistics(templateMatchId);
  }

  // Bonus predictions
  async getBonusPrediction(): Promise<BonusPrediction> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${this.baseUrl}/api/predictions/bonus`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getBonusOptions(): Promise<BonusOptions> {
    const headers: HeadersInit = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${this.baseUrl}/api/predictions/bonus/options`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async updateBonusPrediction(updates: Partial<BonusPrediction>): Promise<BonusPrediction> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${this.baseUrl}/api/predictions/bonus`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getBonusStatistics(fieldKey: string): Promise<{
    field_key: string;
    total_answered: number;
    distribution: Array<{ value: string; count: number; pct: number }>;
  }> {
    const response = await fetch(`${this.baseUrl}/api/predictions/bonus/statistics/${fieldKey}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getBonusOutcomeStats(fieldKey: string): Promise<BonusOutcomeStatsResponse> {
    const response = await fetch(`${this.baseUrl}/api/predictions/bonus/statistics/${fieldKey}/outcomes`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

}

export const apiService = new ApiService();

// ===== User View (other user's predictions) =====

export interface UserProfileView {
  user_id: number;
  username: string;
  name: string | null;
  total_points: number;
  matches_score: number;
  groups_score: number;
  third_place_score: number;
  knockout_score: number;
  penalty: number;
}

export interface UserMatchPredictionsView {
  matches: Match[];
  matches_score: number | null;
}

export interface UserGroupPredictionsView {
  groups: GroupPrediction[];
  groups_score: number | null;
  groups_penalty: number;
}

export interface UserThirdPlacePredictionsView {
  available: boolean;
  eligible_teams?: any[];
  prediction?: any;
  third_place_score?: number | null;
  third_place_penalty?: number;
  result?: any;
}

export interface UserKnockoutPredictionsView {
  predictions: KnockoutPrediction[];
  knockout_score: number | null;
  knockout_penalty: number;
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export const getUserProfile = (userId: number): Promise<UserProfileView> =>
  apiRequest(`/users/${userId}/profile`);

export const getUserMatchPredictions = (userId: number): Promise<UserMatchPredictionsView> =>
  apiRequest(`/users/${userId}/predictions/matches`);

export const getUserGroupPredictions = (userId: number): Promise<UserGroupPredictionsView> =>
  apiRequest(`/users/${userId}/predictions/groups`);

export const getUserThirdPlacePredictions = (userId: number): Promise<UserThirdPlacePredictionsView> =>
  apiRequest(`/users/${userId}/predictions/third-place`);

export const getUserKnockoutPredictions = (userId: number): Promise<UserKnockoutPredictionsView> =>
  apiRequest(`/users/${userId}/predictions/knockout`);
