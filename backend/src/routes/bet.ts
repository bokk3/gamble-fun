import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { executeQuery, executeTransaction } from '../config/database';
import { ProvablyFairEngine } from '../services/gameEngine';

const router = Router();

// Place a bet
router.post('/place', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { gameId, betAmount, gameData } = req.body;

    if (!gameId || !betAmount || betAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid bet data'
      });
      return;
    }

    // Get user's current balance
    const users = await executeQuery(
      'SELECT balance FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const currentBalance = parseFloat(users[0].balance);
    if (currentBalance < betAmount) {
      res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
      return;
    }

    // Get game details
    const games = await executeQuery(
      'SELECT id, name, type, min_bet, max_bet, house_edge FROM games WHERE id = ? AND is_active = TRUE',
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
    const houseEdge = parseFloat(game.house_edge);
    if (betAmount < parseFloat(game.min_bet) || betAmount > parseFloat(game.max_bet)) {
      res.status(400).json({
        success: false,
        message: `Bet amount must be between ${game.min_bet} and ${game.max_bet}`
      });
      return;
    }

    // Generate provably fair result
    const serverSeed = ProvablyFairEngine.generateServerSeed();
    const clientSeed = ProvablyFairEngine.generateClientSeed();
    const nonce = Math.floor(Date.now() / 1000); // Use timestamp as nonce

    let gameResult;
    switch (game.type) {
      case 'slots':
        gameResult = ProvablyFairEngine.playSlots(serverSeed, clientSeed, nonce, betAmount, houseEdge);
        break;
      case 'dice':
        const { target = 50, isOver = true } = gameData || {};
        gameResult = ProvablyFairEngine.playDice(serverSeed, clientSeed, nonce, betAmount, target, isOver);
        break;
      case 'crash':
        const { cashOutAt = 1.5 } = gameData || {};
        gameResult = ProvablyFairEngine.playCrash(serverSeed, clientSeed, nonce, betAmount, cashOutAt);
        break;
      case 'blackjack':
        gameResult = ProvablyFairEngine.playBlackjack(serverSeed, clientSeed, nonce, betAmount);
        break;
      case 'roulette':
        const { bets = [] } = gameData || {};
        gameResult = ProvablyFairEngine.playRoulette(serverSeed, clientSeed, nonce, betAmount, bets);
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Unsupported game type'
        });
        return;
    }

    const newBalance = currentBalance - betAmount + gameResult.winAmount;

    // Execute transaction with proper logging
    const queries = [
      // Update user balance
      {
        query: 'UPDATE users SET balance = ? WHERE id = ?',
        params: [newBalance, userId]
      },
      // Insert bet record
      {
        query: `INSERT INTO bets (user_id, game_id, bet_amount, win_amount, multiplier, game_data, 
                server_seed, client_seed, nonce, result_hash, is_win) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          userId, gameId, betAmount, gameResult.winAmount, gameResult.multiplier,
          JSON.stringify({ ...gameData, result: gameResult.result }),
          serverSeed, clientSeed, nonce, gameResult.hash, gameResult.isWin
        ]
      },
      // Log bet transaction
      {
        query: `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description) 
                VALUES (?, 'bet', ?, ?, ?, ?)`,
        params: [
          userId, -betAmount, currentBalance, currentBalance - betAmount, 
          `Bet placed on ${game.name} - Amount: $${betAmount}`
        ]
      }
    ];

    if (gameResult.isWin) {
      queries.push(
        // Update total won
        {
          query: 'UPDATE users SET total_won = total_won + ? WHERE id = ?',
          params: [gameResult.winAmount, userId]
        },
        // Log win transaction
        {
          query: `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description) 
                  VALUES (?, 'win', ?, ?, ?, ?)`,
          params: [
            userId, gameResult.winAmount, currentBalance - betAmount, newBalance,
            `Win on ${game.name} - Multiplier: ${gameResult.multiplier}x, Amount: $${gameResult.winAmount}`
          ]
        }
      );
    } else {
      queries.push({
        query: 'UPDATE users SET total_lost = total_lost + ? WHERE id = ?',
        params: [betAmount, userId]
      });
    }

    await executeTransaction(queries);

    res.json({
      success: true,
      message: gameResult.isWin ? 'Congratulations! You won!' : 'Better luck next time!',
      data: {
        result: gameResult.result,
        hash: gameResult.hash,
        isWin: gameResult.isWin,
        multiplier: gameResult.multiplier,
        winAmount: gameResult.winAmount,
        newBalance,
        provablyFair: {
          serverSeed,
          clientSeed,
          nonce,
          resultHash: gameResult.hash
        }
      }
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bet'
    });
  }
});

// Get bet history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const bets = await executeQuery(
      `SELECT b.*, g.name as game_name, g.type as game_type 
       FROM bets b 
       JOIN games g ON b.game_id = g.id 
       WHERE b.user_id = ? 
       ORDER BY b.created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: bets.map((bet: any) => ({
        id: bet.id,
        gameId: bet.game_id,
        gameName: bet.game_name,
        gameType: bet.game_type,
        betAmount: parseFloat(bet.bet_amount),
        winAmount: parseFloat(bet.win_amount),
        multiplier: parseFloat(bet.multiplier),
        isWin: bet.is_win,
        gameData: JSON.parse(bet.game_data || '{}'),
        createdAt: bet.created_at,
        provablyFair: {
          serverSeed: bet.server_seed,
          clientSeed: bet.client_seed,
          nonce: bet.nonce,
          resultHash: bet.result_hash
        }
      }))
    });
  } catch (error) {
    console.error('Get bet history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bet history'
    });
  }
});

export { router as betRoutes };