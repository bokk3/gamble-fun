/**
 * Database Cleanup Service
 * Fixes poker game synchronization issues and maintains database integrity
 */

import { executeQuery } from '../config/database';

export class DatabaseCleanupService {
  
  /**
   * Initialize periodic cleanup tasks
   */
  static initialize() {
    console.log('🧹 Database Cleanup Service initialized');
    
    // Run cleanup every 60 seconds
    setInterval(async () => {
      await this.performCleanup();
    }, 60000);

    // Run initial cleanup
    setTimeout(() => {
      this.performCleanup();
    }, 5000);
  }

  /**
   * Perform comprehensive database cleanup
   */
  static async performCleanup() {
    try {
      console.log('🧹 Starting database cleanup...');

      // 1. Fix game_id synchronization issues
      await this.fixGameIdSync();

      // 2. Clean up duplicate games
      await this.cleanupDuplicateGames();

      // 3. Remove inactive players
      await this.removeInactivePlayers();

      // 4. Fix orphaned hands
      await this.fixOrphanedHands();

      console.log('✅ Database cleanup completed successfully');
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
    }
  }

  /**
   * Fix game_id synchronization between seats and games
   */
  private static async fixGameIdSync() {
    const result = await executeQuery(`
      UPDATE poker_seats ps 
      JOIN (
        SELECT table_id, MAX(id) as latest_game_id
        FROM poker_games 
        WHERE game_state IN ('dealing', 'pre_flop', 'flop', 'turn', 'river')
        GROUP BY table_id
      ) latest ON ps.table_id = latest.table_id
      SET ps.game_id = latest.latest_game_id 
      WHERE ps.is_active = 1 AND ps.game_id IS NULL
    `);

    if (result.affectedRows > 0) {
      console.log(`🔧 Fixed game_id sync for ${result.affectedRows} seats`);
    }
  }

  /**
   * Clean up duplicate games per table (keep only the latest)
   */
  private static async cleanupDuplicateGames() {
    // First, find duplicate games
    const duplicates = await executeQuery(`
      SELECT pg1.id
      FROM poker_games pg1
      JOIN poker_games pg2 ON pg1.table_id = pg2.table_id AND pg1.id < pg2.id
      WHERE pg1.game_state IN ('dealing', 'pre_flop', 'flop', 'turn', 'river')
      AND pg2.game_state IN ('dealing', 'pre_flop', 'flop', 'turn', 'river')
    `);

    if (duplicates.length > 0) {
      const gameIds = duplicates.map(g => g.id);
      const result = await executeQuery(`
        UPDATE poker_games 
        SET game_state = 'finished', finished_at = NOW()
        WHERE id IN (${gameIds.map(() => '?').join(',')})
      `, gameIds);

      console.log(`🗑️ Cleaned up ${result.affectedRows} duplicate games`);
    }
  }

  /**
   * Remove inactive human players (but keep AI players)
   * Give human players longer grace period for reconnection
   */
  private static async removeInactivePlayers() {
    // Mark players as sitting out after 2 minutes of inactivity
    await executeQuery(`
      UPDATE poker_seats 
      SET is_sitting_out = 1, last_seen = NOW()
      WHERE user_id > 0 
      AND is_active = 1 
      AND is_sitting_out = 0
      AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 2 MINUTE))
    `);

    // Only remove players after 10 minutes of complete inactivity
    const result = await executeQuery(`
      UPDATE poker_seats 
      SET is_active = 0, left_at = NOW() 
      WHERE user_id > 0 
      AND is_active = 1 
      AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
    `);

    if (result.affectedRows > 0) {
      console.log(`👋 Removed ${result.affectedRows} inactive human players after 10 minutes`);
    }
  }

  /**
   * Fix orphaned hands and ensure proper game state
   */
  private static async fixOrphanedHands() {
    // Mark hands as finished if their game is finished
    const result = await executeQuery(`
      UPDATE poker_hands ph
      JOIN poker_games pg ON ph.game_id = pg.id
      SET ph.finished_at = NOW()
      WHERE pg.game_state = 'finished' 
      AND ph.finished_at IS NULL
    `);

    if (result.affectedRows > 0) {
      console.log(`📝 Fixed ${result.affectedRows} orphaned hands`);
    }
  }

  /**
   * Get system health statistics
   */
  static async getHealthStats() {
    try {
      const stats = await executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM poker_games WHERE game_state != 'finished') as active_games,
          (SELECT COUNT(*) FROM poker_seats WHERE is_active = 1) as active_seats,
          (SELECT COUNT(*) FROM poker_seats WHERE is_active = 1 AND game_id IS NULL) as orphaned_seats,
          (SELECT COUNT(DISTINCT table_id) FROM poker_games WHERE game_state != 'finished') as active_tables
      `);

      return stats[0];
    } catch (error) {
      console.error('Error getting health stats:', error);
      return null;
    }
  }

  /**
   * Emergency reset - use with caution!
   */
  static async emergencyReset() {
    console.log('🚨 EMERGENCY RESET: Cleaning all active games and seats');
    
    try {
      // Finish all active games
      await executeQuery(`
        UPDATE poker_games 
        SET game_state = 'finished', finished_at = NOW() 
        WHERE game_state != 'finished'
      `);

      // Reset all seats
      await executeQuery(`
        UPDATE poker_seats 
        SET game_id = NULL, last_action = NULL, current_bet = 0, total_bet_this_hand = 0
        WHERE is_active = 1
      `);

      console.log('✅ Emergency reset completed');
    } catch (error) {
      console.error('❌ Emergency reset failed:', error);
      throw error;
    }
  }
}