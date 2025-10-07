import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { executeQuery } from '../config/database';

const router = Router();

// Get casino statistics
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Total bets and wins
    const betStats = await executeQuery(`
      SELECT 
        COUNT(*) as total_bets,
        SUM(bet_amount) as total_bet_amount,
        SUM(win_amount) as total_win_amount,
        SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as total_wins,
        AVG(multiplier) as avg_multiplier
      FROM bets 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Game performance
    const gameStats = await executeQuery(`
      SELECT 
        g.name,
        g.type,
        g.house_edge,
        COUNT(b.id) as bet_count,
        SUM(b.bet_amount) as total_bet,
        SUM(b.win_amount) as total_payout,
        (SUM(b.bet_amount) - SUM(b.win_amount)) as house_profit,
        AVG(b.multiplier) as avg_multiplier
      FROM games g
      LEFT JOIN bets b ON g.id = b.game_id AND b.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE g.is_active = 1
      GROUP BY g.id, g.name, g.type, g.house_edge
    `);

    // User activity
    const userStats = await executeQuery(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        AVG(bet_amount) as avg_bet_size,
        MAX(win_amount) as biggest_win
      FROM bets 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({
      success: true,
      data: {
        overview: betStats[0],
        gamePerformance: gameStats,
        userActivity: userStats[0]
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Update game house edge
router.put('/games/:gameId/house-edge', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { houseEdge } = req.body;

    if (!houseEdge || houseEdge < 0 || houseEdge > 0.5) {
      res.status(400).json({
        success: false,
        message: 'House edge must be between 0 and 0.5 (0% to 50%)'
      });
      return;
    }

    await executeQuery(
      'UPDATE games SET house_edge = ? WHERE id = ? AND is_active = TRUE',
      [houseEdge, gameId]
    );

    res.json({
      success: true,
      message: 'House edge updated successfully'
    });
  } catch (error) {
    console.error('Update house edge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update house edge'
    });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query?.limit as string) || 50;
    const offset = parseInt(req.query?.offset as string) || 0;
    const type = req.query?.type as string;

    let query = `
      SELECT 
        t.id,
        t.user_id,
        u.username,
        t.type,
        t.amount,
        t.balance_before,
        t.balance_after,
        t.description,
        t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
    `;
    
    const params: any[] = [];
    
    if (type) {
      query += ' WHERE t.type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const transactions = await executeQuery(query, params);

    res.json({
      success: true,
      data: transactions.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        username: t.username,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceBefore: parseFloat(t.balance_before),
        balanceAfter: parseFloat(t.balance_after),
        description: t.description,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

export { router as adminRoutes };