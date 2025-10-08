import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { BonusService } from '../services/bonusService';

const router = Router();

/**
 * GET /api/bonus/stats
 * Get user's current bonus stats
 */
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    
    const bonusStats = await BonusService.getBonusStats(userId);
    if (!bonusStats) {
      // Initialize bonus stats if they don't exist
      await BonusService.initializeBonusStats(userId);
      const newBonusStats = await BonusService.getBonusStats(userId);
      
      return res.json({
        success: true,
        message: 'Bonus stats initialized',
        data: newBonusStats
      });
    }

    res.json({
      success: true,
      message: 'Bonus stats retrieved successfully',
      data: bonusStats
    });
  } catch (error) {
    console.error('Error getting bonus stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bonus stats'
    });
  }
});

/**
 * GET /api/bonus/game/:gameId
 * Get game-specific bonus stats
 */
router.get('/game/:gameId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const gameId = parseInt(req.params.gameId);

    if (!gameId || gameId < 1 || gameId > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game ID'
      });
    }

    const gameStats = await BonusService.getGameStats(userId, gameId);
    
    res.json({
      success: true,
      message: 'Game stats retrieved successfully',
      data: gameStats
    });
  } catch (error) {
    console.error('Error getting game stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game stats'
    });
  }
});

/**
 * POST /api/bonus/award
 * Award bonus tokens based on gameplay
 */
router.post('/award', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const { 
      gameId, 
      transactionType, 
      bonusAmount, 
      triggerData, 
      description, 
      betId 
    } = req.body;

    // Validate input
    if (!gameId || !transactionType || !bonusAmount || bonusAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const success = await BonusService.awardBonusTokens(
      userId,
      gameId,
      transactionType,
      bonusAmount,
      triggerData || {},
      description || 'Bonus tokens awarded',
      betId
    );

    if (success) {
      // Get updated bonus stats
      const updatedStats = await BonusService.getBonusStats(userId);
      
      res.json({
        success: true,
        message: `Awarded ${bonusAmount} bonus tokens!`,
        data: {
          bonusAwarded: bonusAmount,
          newBalance: updatedStats?.bonusTokens || 0,
          reason: description
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to award bonus tokens'
      });
    }
  } catch (error) {
    console.error('Error awarding bonus tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to award bonus tokens'
    });
  }
});

/**
 * POST /api/bonus/spend
 * Spend bonus tokens for game benefits
 */
router.post('/spend', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const { 
      gameId, 
      transactionType, 
      bonusAmount, 
      triggerData, 
      description 
    } = req.body;

    // Validate input
    if (!gameId || !transactionType || !bonusAmount || bonusAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
      return;
    }

    const success = await BonusService.spendBonusTokens(
      userId,
      gameId,
      transactionType,
      bonusAmount,
      triggerData || {},
      description || 'Bonus tokens spent'
    );

    if (success) {
      // Get updated bonus stats
      const updatedStats = await BonusService.getBonusStats(userId);
      
      res.json({
        success: true,
        message: `Spent ${bonusAmount} bonus tokens!`,
        data: {
          bonusSpent: bonusAmount,
          newBalance: updatedStats?.bonusTokens || 0,
          benefit: description
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to spend bonus tokens'
      });
    }
  } catch (error) {
    console.error('Error spending bonus tokens:', error);
    if (error instanceof Error && error.message === 'Insufficient bonus tokens') {
      res.status(400).json({
        success: false,
        message: 'Insufficient bonus tokens'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to spend bonus tokens'
      });
    }
  }
});

/**
 * GET /api/bonus/history
 * Get recent bonus transaction history
 */
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await BonusService.getBonusHistory(userId, Math.min(limit, 50));
    
    res.json({
      success: true,
      message: 'Bonus history retrieved successfully',
      data: history
    });
  } catch (error) {
    console.error('Error getting bonus history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bonus history'
    });
  }
});

/**
 * POST /api/bonus/calculate
 * Calculate potential bonus reward for a game result
 */
router.post('/calculate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameType, betAmount, winAmount, multiplier, isSpecialWin } = req.body;

    if (!gameType || !betAmount || winAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const bonusReward = BonusService.calculateBonusReward(
      gameType,
      betAmount,
      winAmount,
      multiplier || 0,
      isSpecialWin || false
    );

    res.json({
      success: true,
      message: 'Bonus reward calculated',
      data: bonusReward
    });
  } catch (error) {
    console.error('Error calculating bonus reward:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate bonus reward'
    });
  }
});

/**
 * POST /api/bonus/update-game-stats
 * Update game-specific statistics
 */
router.post('/update-game-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const { gameId, updates } = req.body;

    if (!gameId || !updates) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    await BonusService.updateGameStats(userId, gameId, updates);
    
    // Get updated stats
    const updatedStats = await BonusService.getGameStats(userId, gameId);
    
    res.json({
      success: true,
      message: 'Game stats updated successfully',
      data: updatedStats
    });
  } catch (error) {
    console.error('Error updating game stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update game stats'
    });
  }
});

/**
 * POST /api/bonus/update-account-stats
 * Update account-wide bonus statistics
 */
router.post('/update-account-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    const { updates } = req.body;

    if (!updates) {
      return res.status(400).json({
        success: false,
        message: 'Missing updates data'
      });
    }

    await BonusService.updateAccountStats(userId, updates);
    
    // Get updated stats
    const updatedStats = await BonusService.getBonusStats(userId);
    
    res.json({
      success: true,
      message: 'Account stats updated successfully',
      data: updatedStats
    });
  } catch (error) {
    console.error('Error updating account stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account stats'
    });
  }
});

export default router;