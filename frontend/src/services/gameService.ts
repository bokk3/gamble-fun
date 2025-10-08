// Game service for API communications
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  private balanceRefreshCallback: (() => Promise<void>) | null = null;

  // Allow setting a callback for balance refresh
  setBalanceRefreshCallback(callback: () => Promise<void>) {
    this.balanceRefreshCallback = callback;
  }

  private getAuthHeaders() {
    const token = localStorage.getItem('casino_token');
    console.log('Token from localStorage:', token ? 'Present' : 'Missing');
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
      const headers = this.getAuthHeaders();
      console.log('Placing bet with headers:', headers);
      console.log('Token from localStorage:', localStorage.getItem('casino_token') ? 'EXISTS' : 'MISSING');
      
      const response = await fetch(`${API_BASE_URL}/bet/place`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gameId,
          betAmount,
          gameData,
        }),
      });
      
      console.log('Bet response status:', response.status);
      
      if (response.status === 401) {
        console.error('Unauthorized - token may be invalid or expired');
        // Clear invalid token
        localStorage.removeItem('casino_token');
        localStorage.removeItem('casino_user');
        return {
          success: false,
          message: 'Session expired. Please log in again.',
        };
      }
      
      const result = await response.json();
      console.log('Bet response data:', result);
      
      // Automatically refresh balance after successful bet
      if (result.success && this.balanceRefreshCallback) {
        try {
          await this.balanceRefreshCallback();
        } catch (error) {
          console.error('Failed to refresh balance after bet:', error);
        }
      }
      
      return result;
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

  async testAuth(): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      console.log('Testing auth with headers:', headers);
      
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        headers,
      });
      
      console.log('Auth test response status:', response.status);
      const result = await response.json();
      console.log('Auth test response:', result);
      
      return response.status === 200 && result.success;
    } catch (error) {
      console.error('Auth test failed:', error);
      return false;
    }
  }
}

export const gameService = new GameService();