// Game service for API communications
const API_BASE_URL = 'http://localhost:5000/api';

export interface Game {
  id: number;
  name: string;
  type: string;
  minBet: number;
  maxBet: number;
  houseEdge: number;
  isActive: boolean;
}

export interface BetResult {
  success: boolean;
  data?: {
    result: any;
    hash: string;
    isWin: boolean;
    multiplier: number;
    winAmount: number;
    newBalance: number;
  };
  message?: string;
}

class GameService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async getGames(): Promise<Game[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/games`, {
        headers: this.getAuthHeaders(),
      });
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch games:', error);
      return [];
    }
  }

  async getGame(id: number): Promise<Game | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/games/${id}`, {
        headers: this.getAuthHeaders(),
      });
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('Failed to fetch game:', error);
      return null;
    }
  }

  async placeBet(gameId: number, betAmount: number, gameData: any = {}): Promise<BetResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/bet/place`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          gameId,
          betAmount,
          gameData,
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to place bet:', error);
      return {
        success: false,
        message: 'Failed to place bet. Please try again.',
      };
    }
  }

  async getUserBalance(): Promise<number> {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: this.getAuthHeaders(),
      });
      const data = await response.json();
      return data.success ? data.data.balance : 0;
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return 0;
    }
  }
}

export const gameService = new GameService();