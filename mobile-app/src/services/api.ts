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

export interface Match {
  id: number;
  stage: string;
  home_team: Team;
  away_team: Team;
  date: string;
  status: string;
  user_prediction: UserPrediction;
  can_edit: boolean;
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
  team1_flag: string | null;
  team2_flag: string | null;
  winner_team_flag: string | null;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getMatches(userId: number = 1): Promise<Match[]> {
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

    async getGroupPredictions(userId: number = 1): Promise<GroupPrediction[]> {
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
  async getKnockoutPredictions(userId: number = 1, stage?: string): Promise<KnockoutPrediction[]> {
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
}

export const apiService = new ApiService();
