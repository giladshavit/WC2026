// Use localhost for emulator, local network IP for physical device
const API_BASE_URL = 'http://192.168.1.236:8000';

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
}

export interface MatchesResponse {
  matches: Match[];
  matches_score: number | null;
}

export interface GroupsResponse {
  groups: GroupPrediction[];
  groups_score: number | null;
}

export interface KnockoutResponse {
  predictions: KnockoutPrediction[];
  knockout_score: number | null;
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
  joined_at?: string;
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
  } | null;
  standings: LeagueStanding[];
}

export interface CreateLeagueRequest {
  name: string;
  description?: string;
}

export interface JoinLeagueRequest {
  invite_code: string;
}

class ApiService {
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

  async updateBatchMatchPredictions(
    userId: number,
    predictions: Array<{
      match_id: number;
      home_score: number | null;
      away_score: number | null;
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
  async getKnockoutPredictions(userId: number = 1, stage?: string): Promise<KnockoutResponse> {
    try {
      const timestamp = new Date().getTime();
      const stageParam = stage ? `&stage=${stage}` : '';
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout?user_id=${userId}${stageParam}&_t=${timestamp}`);
      
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

  async updateKnockoutPrediction(
    predictionId: number,
    winnerTeamNumber: number,
    winnerTeamName: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/predictions/knockout/${predictionId}`, {
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
        throw new Error(`HTTP error! status: ${response.status}`);
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
      console.error('Error creating league:', error);
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
      console.error('Error joining league:', error);
      throw error;
    }
  }

  async getGlobalStandings(): Promise<LeagueStandingsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/leagues/global`);

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

  async getLeagueStandings(leagueId: number): Promise<LeagueStandingsResponse> {
    try {
      const headers: HeadersInit = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/leagues/${leagueId}/standings`, {
        headers,
      });

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

}

export const apiService = new ApiService();
