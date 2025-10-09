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
}

export const apiService = new ApiService();
