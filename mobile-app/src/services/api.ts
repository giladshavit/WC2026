const API_BASE_URL = 'http://127.0.0.1:8000';

export interface Team {
  id: number;
  name: string;
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
      const response = await fetch(`${this.baseUrl}/api/matches?user_id=${userId}`);
      
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
}

export const apiService = new ApiService();
