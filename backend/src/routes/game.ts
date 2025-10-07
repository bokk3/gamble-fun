import { Router, Response } from 'express';
import { executeQuery } from '../config/database';

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

export { router as gameRoutes };