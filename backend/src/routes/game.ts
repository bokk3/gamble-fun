import { Router, Response } from 'express';
import { executeQuery } from '../config/database';
import AIPlayerManager from '../services/aiPlayerManager';
import { AIPokerEngine } from '../services/aiPokerEngine';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all available games
router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const games = await executeQuery(
      'SELECT id, name, type, min_bet, max_bet, house_edge, is_active FROM games WHERE is_active = TRUE'
    );

    res.json({
      success: true,
      data: games.map((game: any) => ({
        id: game.id,
        name: game.name,
        type: game.type,
        minBet: parseFloat(game.min_bet),
        maxBet: parseFloat(game.max_bet),
        houseEdge: parseFloat(game.house_edge),
        isActive: game.is_active
      }))
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch games'
    });
  }
});

// Get specific game details
router.get('/:id', async (req, res: Response): Promise<void> => {
  try {
    const gameId = parseInt(req.params.id);
    
    const games = await executeQuery(
      'SELECT id, name, type, min_bet, max_bet, house_edge, is_active FROM games WHERE id = ? AND is_active = TRUE',
      [gameId]
    );

    if (games.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Game not found'
      });
      return;
    }

    const game = games[0];
    res.json({
      success: true,
      data: {
        id: game.id,
        name: game.name,
        type: game.type,
        minBet: parseFloat(game.min_bet),
        maxBet: parseFloat(game.max_bet),
        houseEdge: parseFloat(game.house_edge),
        isActive: game.is_active
      }
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game'
    });
  }
});

// AI Management Endpoints (Admin only)
router.get('/ai/stats', authenticateToken, async (req, res: Response): Promise<void> => {
  try {
    // Only allow admins to view AI stats
    const user = (req as any).user;
    if (!user.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const stats = AIPlayerManager.getAIStats();
    const aiPlayers = await AIPokerEngine.getActiveAIPlayers();

    res.json({
      success: true,
      data: {
        aiStats: stats,
        activeAIPlayers: aiPlayers.length,
        aiPlayers: aiPlayers.map(ai => ({
          id: ai.id,
          name: ai.name,
          playingStyle: ai.playing_style,
          skillLevel: ai.skill_level,
          bankroll: ai.bankroll,
          isActive: ai.is_active
        }))
      }
    });
  } catch (error) {
    console.error('Get AI stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI stats'
    });
  }
});

// Fill table with AI players (temporary - no auth required for testing)
router.post('/ai/fill-table/:tableId', async (req, res: Response): Promise<void> => {
  try {
    const tableId = parseInt(req.params.tableId);
    const { targetPlayers = 6 } = req.body;

    console.log(`Filling table ${tableId} with AI players...`);
    await AIPokerEngine.fillTableWithAI(tableId, targetPlayers);

    res.json({
      success: true,
      message: `Table ${tableId} filled with AI players`
    });
  } catch (error) {
    console.error('Fill table with AI error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fill table with AI: ' + error
    });
  }
});

// Get AI player performance data
router.get('/ai/performance', authenticateToken, async (req, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    // Get AI player performance stats
    const performance = await executeQuery(`
      SELECT 
        pai.id,
        pai.name,
        pai.playing_style,
        pai.skill_level,
        pai.bankroll,
        COUNT(b.id) as total_hands,
        SUM(CASE WHEN b.win_amount > 0 THEN 1 ELSE 0 END) as hands_won,
        SUM(b.win_amount - b.bet_amount) as total_profit,
        AVG(b.bet_amount) as avg_bet_size
      FROM poker_ai_players pai
      LEFT JOIN bets b ON b.user_id = -pai.id AND b.game_type = 'poker'
      WHERE pai.is_active = true
      GROUP BY pai.id
      ORDER BY total_profit DESC
    `);

    res.json({
      success: true,
      data: performance.map((p: any) => ({
        id: p.id,
        name: p.name,
        playingStyle: p.playing_style,
        skillLevel: p.skill_level,
        bankroll: parseFloat(p.bankroll),
        totalHands: p.total_hands || 0,
        handsWon: p.hands_won || 0,
        winRate: p.total_hands > 0 ? ((p.hands_won || 0) / p.total_hands * 100).toFixed(1) : '0.0',
        totalProfit: parseFloat(p.total_profit || 0),
        avgBetSize: parseFloat(p.avg_bet_size || 0)
      }))
    });
  } catch (error) {
    console.error('Get AI performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI performance data'
    });
  }
});

export { router as gameRoutes };