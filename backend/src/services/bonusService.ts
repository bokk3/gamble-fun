import { executeQuery, executeTransaction } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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

export class BonusService {
  
  /**
   * Get user's current bonus stats
   */
  static async getBonusStats(userId: number): Promise<BonusStats | null> {
    try {
      const [rows] = await executeQuery(
        `SELECT 
          bonus_tokens as bonusTokens,
          total_bonus_earned as totalBonusEarned,
          total_bonus_spent as totalBonusSpent,
          account_level as accountLevel,
          total_xp as totalXp,
          global_multiplier as globalMultiplier,
          current_win_streak as currentWinStreak,
          longest_win_streak as longestWinStreak,
          total_games_played as totalGamesPlayed,
          total_auto_spins as totalAutoSpins,
          perfect_sessions as perfectSessions,
          jackpot_hits as jackpotHits,
          mega_win_count as megaWinCount,
          epic_win_count as epicWinCount,
          legendary_win_count as legendaryWinCount
        FROM user_bonus_stats 
        WHERE user_id = ?`,
        [userId]
      ) as RowDataPacket[];

      return rows.length > 0 ? rows[0] as BonusStats : null;
    } catch (error) {
      console.error('Error getting bonus stats:', error);
      throw error;
    }
  }

  /**
   * Get game-specific stats for a user
   */
  static async getGameStats(userId: number, gameId: number): Promise<GameSpecificStats | null> {
    try {
      const [rows] = await executeQuery(
        `SELECT 
          game_level as gameLevel,
          game_xp as gameXp,
          game_multiplier as gameMultiplier,
          auto_spin_sessions as autoSpinSessions,
          total_auto_spins as totalAutoSpins,
          auto_spin_profit as autoSpinProfit,
          best_auto_spin_streak as bestAutoSpinStreak,
          perfect_games as perfectGames,
          bonus_rounds_triggered as bonusRoundsTriggered,
          jackpots_won as jackpotsWon
        FROM game_specific_stats 
        WHERE user_id = ? AND game_id = ?`,
        [userId, gameId]
      ) as RowDataPacket[];

      return rows.length > 0 ? rows[0] as GameSpecificStats : null;
    } catch (error) {
      console.error('Error getting game stats:', error);
      throw error;
    }
  }

  /**
   * Award bonus tokens based on gameplay achievements
   */
  static async awardBonusTokens(
    userId: number, 
    gameId: number,
    transactionType: string,
    bonusAmount: number,
    triggerData: any,
    description: string,
    betId?: number
  ): Promise<boolean> {
    try {
      // Get current bonus balance
      const bonusStats = await this.getBonusStats(userId);
      if (!bonusStats) {
        throw new Error('User bonus stats not found');
      }

      const balanceBefore = bonusStats.bonusTokens;
      const balanceAfter = balanceBefore + bonusAmount;

      // Update user bonus stats and record transaction atomically
      const queries = [
        {
          query: `UPDATE user_bonus_stats 
                   SET bonus_tokens = bonus_tokens + ?,
                       total_bonus_earned = total_bonus_earned + ?,
                       last_bonus_earned = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE user_id = ?`,
          params: [bonusAmount, bonusAmount, userId]
        },
        {
          query: `INSERT INTO bonus_transactions 
                   (user_id, game_id, bet_id, transaction_type, bonus_amount, 
                    balance_before, balance_after, trigger_data, description)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [userId, gameId, betId, transactionType, bonusAmount, 
                   balanceBefore, balanceAfter, JSON.stringify(triggerData), description]
        }
      ];

      await executeTransaction(queries);
      return true;
    } catch (error) {
      console.error('Error awarding bonus tokens:', error);
      throw error;
    }
  }

  /**
   * Spend bonus tokens for game benefits
   */
  static async spendBonusTokens(
    userId: number,
    gameId: number,
    transactionType: string,
    bonusAmount: number,
    triggerData: any,
    description: string
  ): Promise<boolean> {
    try {
      // Get current bonus balance
      const bonusStats = await this.getBonusStats(userId);
      if (!bonusStats) {
        throw new Error('User bonus stats not found');
      }

      if (bonusStats.bonusTokens < bonusAmount) {
        throw new Error('Insufficient bonus tokens');
      }

      const balanceBefore = bonusStats.bonusTokens;
      const balanceAfter = balanceBefore - bonusAmount;

      // Update user bonus stats and record transaction atomically
      const queries = [
        {
          query: `UPDATE user_bonus_stats 
                   SET bonus_tokens = bonus_tokens - ?,
                       total_bonus_spent = total_bonus_spent + ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE user_id = ?`,
          params: [bonusAmount, bonusAmount, userId]
        },
        {
          query: `INSERT INTO bonus_transactions 
                   (user_id, game_id, transaction_type, bonus_amount, 
                    balance_before, balance_after, trigger_data, description)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [userId, gameId, transactionType, -bonusAmount, 
                   balanceBefore, balanceAfter, JSON.stringify(triggerData), description]
        }
      ];

      await executeTransaction(queries);
      return true;
    } catch (error) {
      console.error('Error spending bonus tokens:', error);
      throw error;
    }
  }

  /**
   * Update game-specific statistics
   */
  static async updateGameStats(
    userId: number,
    gameId: number,
    updates: Partial<GameSpecificStats>
  ): Promise<void> {
    try {
      const updateFields = [];
      const updateValues = [];

      // Build dynamic update query based on provided fields
      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = ?`);
        updateValues.push(value);
      }

      if (updateFields.length === 0) return;

      updateValues.push(userId, gameId);

      await executeQuery(
        `UPDATE game_specific_stats 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND game_id = ?`,
        updateValues
      );
    } catch (error) {
      console.error('Error updating game stats:', error);
      throw error;
    }
  }

  /**
   * Update account-wide bonus stats
   */
  static async updateAccountStats(
    userId: number,
    updates: Partial<BonusStats>
  ): Promise<void> {
    try {
      const updateFields = [];
      const updateValues = [];

      // Build dynamic update query based on provided fields
      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = ?`);
        updateValues.push(value);
      }

      if (updateFields.length === 0) return;

      updateValues.push(userId);

      await executeQuery(
        `UPDATE user_bonus_stats 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        updateValues
      );
    } catch (error) {
      console.error('Error updating account stats:', error);
      throw error;
    }
  }

  /**
   * Get recent bonus transactions for a user
   */
  static async getBonusHistory(userId: number, limit: number = 10): Promise<BonusTransaction[]> {
    try {
      const [rows] = await executeQuery(
        `SELECT 
          id,
          transaction_type as transactionType,
          bonus_amount as bonusAmount,
          balance_before as balanceBefore,
          balance_after as balanceAfter,
          trigger_data as triggerData,
          description,
          created_at as createdAt
        FROM bonus_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?`,
        [userId, limit]
      ) as RowDataPacket[];

      return rows.map((row: any) => ({
        ...row,
        triggerData: JSON.parse(row.triggerData || '{}')
      }));
    } catch (error) {
      console.error('Error getting bonus history:', error);
      throw error;
    }
  }

  /**
   * Calculate bonus rewards based on game performance
   */
  static calculateBonusReward(
    gameType: string,
    betAmount: number,
    winAmount: number,
    multiplier: number,
    isSpecialWin: boolean = false
  ): { bonusAmount: number; reason: string } {
    let bonusAmount = 0;
    let reason = '';

    // Base bonus calculation
    const winRatio = winAmount / betAmount;

    if (winRatio >= 100) {
      bonusAmount = 50; // Legendary win bonus
      reason = 'Legendary Win (100x+)!';
    } else if (winRatio >= 50) {
      bonusAmount = 25; // Epic win bonus
      reason = 'Epic Win (50x+)!';
    } else if (winRatio >= 10) {
      bonusAmount = 10; // Mega win bonus
      reason = 'Mega Win (10x+)!';
    } else if (winRatio >= 5) {
      bonusAmount = 5; // Big win bonus
      reason = 'Big Win (5x+)!';
    } else if (winAmount > betAmount * 2) {
      bonusAmount = 2; // Double win bonus
      reason = 'Double Win!';
    }

    // Special game-specific bonuses
    if (isSpecialWin) {
      switch (gameType) {
        case 'slots':
          bonusAmount += 5;
          reason += ' + Bonus Round!';
          break;
        case 'blackjack':
          bonusAmount += 3;
          reason += ' + Blackjack!';
          break;
        case 'roulette':
          bonusAmount += 4;
          reason += ' + Straight Up!';
          break;
        case 'dice':
          bonusAmount += 2;
          reason += ' + Perfect Roll!';
          break;
        case 'crash':
          bonusAmount += 3;
          reason += ' + Perfect Cash Out!';
          break;
      }
    }

    return { bonusAmount, reason };
  }

  /**
   * Initialize bonus stats for new user
   */
  static async initializeBonusStats(userId: number): Promise<void> {
    try {
      // Create bonus stats entry
      await executeQuery(
        `INSERT INTO user_bonus_stats (user_id, bonus_tokens, total_bonus_earned) 
         VALUES (?, 100.00, 100.00)
         ON DUPLICATE KEY UPDATE user_id = user_id`,
        [userId]
      );

      // Create game-specific stats for all games
      await executeQuery(
        `INSERT INTO game_specific_stats (user_id, game_id)
         SELECT ?, id FROM games
         ON DUPLICATE KEY UPDATE user_id = user_id`,
        [userId]
      );
    } catch (error) {
      console.error('Error initializing bonus stats:', error);
      throw error;
    }
  }
}