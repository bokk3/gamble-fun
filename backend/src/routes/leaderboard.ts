import { Router, Response } from 'express';
import { executeQuery } from '../config/database';

const router = Router();

// Get top players leaderboard
router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const topPlayers = await executeQuery(
      `SELECT username, balance, total_won, total_lost, 
              (total_won - total_lost) as net_profit,
              created_at
       FROM users 
       WHERE is_active = TRUE 
       ORDER BY total_won DESC 
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: topPlayers.map((player: any, index: number) => ({
        rank: index + 1,
        username: player.username,
        balance: parseFloat(player.balance),
        totalWon: parseFloat(player.total_won),
        totalLost: parseFloat(player.total_lost),
        netProfit: parseFloat(player.net_profit),
        memberSince: player.created_at
      }))
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

export { router as leaderboardRoutes };