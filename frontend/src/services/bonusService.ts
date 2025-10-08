const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface BonusStats {
  bonusTokens: number;
  totalBonusEarned: number;
  totalBonusSpent: number;
  accountLevel: number;
  totalXp: number;
  globalMultiplier: number;
  currentWinStreak: number;
  longestWinStreak: number;
  totalGamesPlayed: number;
  totalAutoSpins: number;
  perfectSessions: number;
  jackpotHits: number;
  megaWinCount: number;
  epicWinCount: number;
  legendaryWinCount: number;
}

export interface GameSpecificStats {
  gameLevel: number;
  gameXp: number;
  gameMultiplier: number;
  autoSpinSessions: number;
  totalAutoSpins: number;
  autoSpinProfit: number;
  bestAutoSpinStreak: number;
  perfectGames: number;
  bonusRoundsTriggered: number;
  jackpotsWon: number;
}

export interface BonusTransaction {
  id: number;
  transactionType: string;
  bonusAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  triggerData: any;
  description: string;
  createdAt: Date;
}

export interface BonusReward {
  bonusAmount: number;
  reason: string;
}

class BonusServiceClass {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Get user's current bonus stats
   */
  async getBonusStats(): Promise<{ success: boolean; data?: BonusStats; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/stats`, {
        method: 'GET',
        headers: this.getAuthHeader()
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting bonus stats:', error);
      return { success: false, message: 'Failed to get bonus stats' };
    }
  }

  /**
   * Get game-specific bonus stats
   */
  async getGameStats(gameId: number): Promise<{ success: boolean; data?: GameSpecificStats; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/game/${gameId}`, {
        method: 'GET',
        headers: this.getAuthHeader()
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting game stats:', error);
      return { success: false, message: 'Failed to get game stats' };
    }
  }

  /**
   * Award bonus tokens based on gameplay
   */
  async awardBonusTokens(
    gameId: number,
    transactionType: string,
    bonusAmount: number,
    triggerData: any = {},
    description: string,
    betId?: number
  ): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/award`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          gameId,
          transactionType,
          bonusAmount,
          triggerData,
          description,
          betId
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error awarding bonus tokens:', error);
      return { success: false, message: 'Failed to award bonus tokens' };
    }
  }

  /**
   * Spend bonus tokens for game benefits
   */
  async spendBonusTokens(
    gameId: number,
    transactionType: string,
    bonusAmount: number,
    triggerData: any = {},
    description: string
  ): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/spend`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          gameId,
          transactionType,
          bonusAmount,
          triggerData,
          description
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error spending bonus tokens:', error);
      return { success: false, message: 'Failed to spend bonus tokens' };
    }
  }

  /**
   * Get recent bonus transaction history
   */
  async getBonusHistory(limit: number = 10): Promise<{ success: boolean; data?: BonusTransaction[]; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/history?limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeader()
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting bonus history:', error);
      return { success: false, message: 'Failed to get bonus history' };
    }
  }

  /**
   * Calculate potential bonus reward for a game result
   */
  async calculateBonusReward(
    gameType: string,
    betAmount: number,
    winAmount: number,
    multiplier: number = 0,
    isSpecialWin: boolean = false
  ): Promise<{ success: boolean; data?: BonusReward; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/calculate`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          gameType,
          betAmount,
          winAmount,
          multiplier,
          isSpecialWin
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error calculating bonus reward:', error);
      return { success: false, message: 'Failed to calculate bonus reward' };
    }
  }

  /**
   * Update game-specific statistics
   */
  async updateGameStats(gameId: number, updates: Partial<GameSpecificStats>): Promise<{ success: boolean; data?: GameSpecificStats; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/update-game-stats`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          gameId,
          updates
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error updating game stats:', error);
      return { success: false, message: 'Failed to update game stats' };
    }
  }

  /**
   * Update account-wide bonus statistics
   */
  async updateAccountStats(updates: Partial<BonusStats>): Promise<{ success: boolean; data?: BonusStats; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/bonus/update-account-stats`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ updates })
      });

      return await response.json();
    } catch (error) {
      console.error('Error updating account stats:', error);
      return { success: false, message: 'Failed to update account stats' };
    }
  }

  /**
   * Process automatic bonus awards based on game results
   */
  async processGameResult(
    gameId: number,
    gameType: string,
    betAmount: number,
    winAmount: number,
    multiplier: number = 0,
    isSpecialWin: boolean = false,
    betId?: number
  ): Promise<{ bonusAwarded: number; reason: string }> {
    try {
      // Calculate potential bonus
      const bonusCalc = await this.calculateBonusReward(gameType, betAmount, winAmount, multiplier, isSpecialWin);
      
      if (bonusCalc.success && bonusCalc.data && bonusCalc.data.bonusAmount > 0) {
        // Award the bonus
        const awardResult = await this.awardBonusTokens(
          gameId,
          'earned_win',
          bonusCalc.data.bonusAmount,
          { betAmount, winAmount, multiplier, isSpecialWin },
          bonusCalc.data.reason,
          betId
        );

        if (awardResult.success) {
          return {
            bonusAwarded: bonusCalc.data.bonusAmount,
            reason: bonusCalc.data.reason
          };
        }
      }

      return { bonusAwarded: 0, reason: '' };
    } catch (error) {
      console.error('Error processing game result for bonus:', error);
      return { bonusAwarded: 0, reason: '' };
    }
  }

  /**
   * Get formatted bonus level info
   */
  getBonusLevelInfo(bonusTokens: number): { 
    level: number; 
    tokensToNext: number; 
    levelName: string;
    levelColor: string;
  } {
    const levels = [
      { min: 0, name: 'Bronze Gambler', color: '#CD7F32' },
      { min: 100, name: 'Silver Player', color: '#C0C0C0' },
      { min: 250, name: 'Gold Bettor', color: '#FFD700' },
      { min: 500, name: 'Platinum High Roller', color: '#E5E4E2' },
      { min: 1000, name: 'Diamond VIP', color: '#B9F2FF' },
      { min: 2500, name: 'Master Gambler', color: '#FF6B35' },
      { min: 5000, name: 'Grand Master', color: '#8A2BE2' },
      { min: 10000, name: 'Legendary Casino Lord', color: '#FF1493' }
    ];

    let currentLevel = 1;
    let levelName = levels[0].name;
    let levelColor = levels[0].color;
    let tokensToNext = levels[1]?.min || 100;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (bonusTokens >= levels[i].min) {
        currentLevel = i + 1;
        levelName = levels[i].name;
        levelColor = levels[i].color;
        tokensToNext = levels[i + 1] ? levels[i + 1].min - bonusTokens : 0;
        break;
      }
    }

    return { level: currentLevel, tokensToNext, levelName, levelColor };
  }

  /**
   * Format bonus transaction type for display
   */
  formatTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      'earned_spin': '🎰 Auto-Spin Bonus',
      'earned_win': '🏆 Win Bonus',
      'earned_streak': '🔥 Streak Bonus',
      'earned_milestone': '🎯 Milestone Bonus',
      'earned_daily': '📅 Daily Bonus',
      'earned_level_up': '⬆️ Level Up Bonus',
      'earned_achievement': '🏅 Achievement Bonus',
      'spent_auto_spin': '🎰 Auto-Spin Purchase',
      'spent_multiplier': '⚡ Multiplier Boost',
      'spent_insurance': '🛡️ Insurance Purchase'
    };

    return typeMap[type] || type;
  }
}

export const bonusService = new BonusServiceClass();