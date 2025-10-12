/**
 * Poker API Routes
 * Handle table joining, betting, game actions, and tournament management
 */

import express from 'express';
import { Request, Response } from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';
import { executeQuery, executeTransaction } from '../config/database';
import { 
  createDeck, 
  shuffleDeck, 
  evaluateHand, 
  compareHands,
  calculateSidePots,
  getNextActivePlayer,
  isBettingRoundComplete,
  getNextBettingRound,
  dealCommunityCards,
  calculateMinRaise,
  validatePlayerAction,
  Card,
  Player,
  PokerGame,
  HandResult
} from '../services/pokerEngine';
import { ProvablyFairEngine } from '../services/gameEngine';
import AIPlayerManager from '../services/aiPlayerManager';
import { getPokerManager } from '../socket/socketHandler';

const router = express.Router();

// Input validation schemas
const joinTableSchema = Joi.object({
  tableId: Joi.number().integer().positive().required(),
  buyIn: Joi.number().positive().required(),
  seatPosition: Joi.number().integer().min(0).max(7).optional()
});

const playerActionSchema = Joi.object({
  gameId: Joi.number().integer().positive().required(),
  action: Joi.string().valid('fold', 'check', 'call', 'bet', 'raise', 'all_in').required(),
  amount: Joi.number().min(0).optional()
});

const createTableSchema = Joi.object({
  name: Joi.string().max(100).required(),
  tableType: Joi.string().valid('cash', 'tournament', 'sit_n_go').default('cash'),
  maxPlayers: Joi.number().integer().min(2).max(8).default(8),
  smallBlind: Joi.number().positive().required(),
  bigBlind: Joi.number().positive().required(),
  minBuyIn: Joi.number().positive().required(),
  maxBuyIn: Joi.number().positive().required()
});

/**
 * Get all available poker tables
 */
router.get('/tables', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tables = await executeQuery(`
      SELECT 
        pt.*,
        COUNT(ps.id) as current_players,
        COALESCE(AVG(ps.chips), 0) as avg_chips
      FROM poker_tables pt
      LEFT JOIN poker_seats ps ON pt.id = ps.table_id AND ps.is_active = true
      WHERE pt.is_active = true
      GROUP BY pt.id
      ORDER BY pt.small_blind ASC, pt.big_blind ASC
    `);

    res.json({
      success: true,
      message: 'Poker tables retrieved successfully',
      data: { tables }
    });
  } catch (error) {
    console.error('Error fetching poker tables:', error);
    res.status(500).json({
      success: false, 
      message: 'Failed to fetch poker tables'
    });
  }
});

/**
 * Get table details with current players
 */
router.get('/table/:tableId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    
    // Get table information
    const tableResult = await executeQuery(
      'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
      [tableId]
    );
    
    if (tableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    const table = tableResult[0];
    
    // Get current players at table (including AI players)
    const players = await executeQuery(`
      SELECT 
        ps.user_id as userId,
        ps.seat_position as seatPosition,
        ps.chips,
        ps.is_active as isActive,
        ps.is_sitting_out as isSittingOut,
        ps.last_action as lastAction,
        ps.current_bet as currentBet,
        ps.total_bet_this_hand as totalBetThisHand,
        ps.hole_cards as holeCards,
        ps.is_all_in as isAllIn,
        ps.joined_at as joinedAt,
        CASE 
          WHEN ps.user_id > 0 THEN u.username
          ELSE pai.name
        END as username,
        CASE 
          WHEN ps.user_id > 0 THEN NULL
          ELSE pai.avatar_url
        END as avatar_url,
        CASE 
          WHEN ps.user_id < 0 THEN pai.playing_style
          ELSE NULL
        END as playing_style,
        CASE 
          WHEN ps.user_id < 0 THEN pai.skill_level
          ELSE NULL
        END as skill_level,
        COALESCE(pps.hands_played, 0) as hands_played,
        COALESCE(pps.hands_won, 0) as hands_won,
        COALESCE(pps.total_winnings, 0) as total_winnings,
        CASE 
          WHEN ps.user_id < 0 THEN true
          ELSE false
        END as isAI,
        CASE 
          WHEN ps.last_action = 'fold' THEN true
          ELSE false
        END as isFolded
      FROM poker_seats ps
      LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
      LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
      LEFT JOIN poker_player_stats pps ON ps.user_id = pps.user_id
      WHERE ps.table_id = ? AND ps.is_active = true
      ORDER BY ps.seat_position ASC
    `, [tableId]);
    
    // Get current game if exists
    const gameResult = await executeQuery(
      'SELECT * FROM poker_games WHERE table_id = ? AND game_state NOT IN ("finished") ORDER BY created_at DESC LIMIT 1',
      [tableId]
    );
    
    const currentGame = gameResult.length > 0 ? gameResult[0] : null;
    
    res.json({
      success: true,
      message: 'Table details retrieved successfully',
      data: {
        table,
        players,
        currentGame
      }
    });
  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table details'
    });
  }
});

// Get current game state for a table
router.get('/game-state/:tableId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    
    // Get current active game
    const gameResult = await executeQuery(`
      SELECT 
        pg.*,
        pt.name as table_name,
        pt.small_blind,
        pt.big_blind
      FROM poker_games pg
      JOIN poker_tables pt ON pg.table_id = pt.id
      WHERE pg.table_id = ? 
      AND pg.game_state != 'completed'
      ORDER BY pg.created_at DESC
      LIMIT 1
    `, [tableId]);

    if (gameResult.length === 0) {
      return res.json({
        success: true,
        message: 'No active game at this table',
        data: null
      });
    }

    const game = gameResult[0];

    // Get current hand if exists
    const handResult = await executeQuery(`
      SELECT * FROM poker_hands 
      WHERE game_id = ? 
      ORDER BY started_at DESC 
      LIMIT 1
    `, [game.id]);

    const currentHand = handResult.length > 0 ? handResult[0] : null;

    // Get all players in current game
    const players = await executeQuery(`
      SELECT 
        ps.*,
        CASE 
          WHEN ps.user_id > 0 THEN u.username
          ELSE pai.name
        END as name,
        CASE 
          WHEN ps.user_id < 0 THEN true
          ELSE false
        END as is_ai
      FROM poker_seats ps
      LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
      LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
      WHERE ps.table_id = ? AND ps.is_active = true
      ORDER BY ps.seat_position
    `, [tableId]);

    res.json({
      success: true,
      message: 'Game state retrieved successfully',
      data: {
        game,
        currentHand,
        players,
        activePlayerCount: players.length
      }
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game state'
    });
  }
});

/**
 * Join a poker table
 */
router.post('/join', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { error, value } = joinTableSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    const { tableId, buyIn, seatPosition } = value;
    const userId = (req as any).user.id;
    
    // Get table information
    const tableResult = await executeQuery(
      'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
      [tableId]
    );
    
    if (tableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    const table = tableResult[0];
    
    // Validate buy-in amount
    if (buyIn < table.min_buy_in || buyIn > table.max_buy_in) {
      return res.status(400).json({
        success: false,
        message: `Buy-in must be between ${table.min_buy_in} and ${table.max_buy_in}`
      });
    }
    
    // Check user balance
    const userResult = await executeQuery(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    if (userResult.length === 0 || userResult[0].balance < buyIn) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Check if user already has an active seat at this table
    const existingSeat = await executeQuery(
      'SELECT id, seat_position, chips FROM poker_seats WHERE table_id = ? AND user_id = ? AND is_active = true',
      [tableId, userId]
    );
    
    if (existingSeat.length > 0) {
      // User already seated - return existing seat info instead of creating new one
      return res.json({
        success: true,
        message: 'Already seated at poker table',
        data: {
          tableId,
          seatPosition: existingSeat[0].seat_position,
          chips: parseFloat(existingSeat[0].chips)
        }
      });
    }
    
    // Get current players at table
    const currentPlayers = await executeQuery(
      'SELECT seat_position FROM poker_seats WHERE table_id = ? AND is_active = true',
      [tableId]
    );
    
    if (currentPlayers.length >= table.max_players) {
      return res.status(400).json({
        success: false,
        message: 'Table is full'
      });
    }
    
    // Find available seat
    let finalSeatPosition = seatPosition;
    if (finalSeatPosition === undefined) {
      const occupiedSeats = currentPlayers.map((p: any) => p.seat_position);
      for (let i = 0; i < table.max_players; i++) {
        if (!occupiedSeats.includes(i)) {
          finalSeatPosition = i;
          break;
        }
      }
    } else {
      // Check if requested seat is available
      const seatTaken = currentPlayers.some((p: any) => p.seat_position === finalSeatPosition);
      if (seatTaken) {
        return res.status(400).json({
          success: false,
          message: 'Seat is already taken'
        });
      }
    }
    
    // Join table transaction
    const queries = [
      {
        query: 'UPDATE users SET balance = balance - ? WHERE id = ?',
        params: [buyIn, userId]
      },
      {
        query: `INSERT INTO poker_seats (table_id, user_id, seat_position, chips) 
                VALUES (?, ?, ?, ?)`,
        params: [tableId, userId, finalSeatPosition, buyIn]
      }
    ];
    
    await executeTransaction(queries);
    
    // Initialize player stats if they don't exist
    await executeQuery(`
      INSERT IGNORE INTO poker_player_stats (user_id) VALUES (?)
    `, [userId]);
    
    res.json({
      success: true,
      message: 'Successfully joined poker table',
      data: {
        tableId,
        seatPosition: finalSeatPosition,
        chips: buyIn
      }
    });
    
  } catch (error) {
    console.error('Error joining poker table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join poker table'
    });
  }
});

/**
 * Leave a poker table
 */
router.post('/leave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.body;
    const userId = (req as any).user.id;
    
    // Get player's seat
    const seatResult = await executeQuery(
      'SELECT * FROM poker_seats WHERE table_id = ? AND user_id = ? AND is_active = true',
      [tableId, userId]
    );
    
    if (seatResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Player not found at table'
      });
    }
    
    const seat = seatResult[0];
    
    // Check if player is in active game
    const activeGameResult = await executeQuery(`
      SELECT pg.* FROM poker_games pg
      JOIN poker_seats ps ON pg.table_id = ps.table_id
      WHERE ps.user_id = ? AND ps.table_id = ? AND pg.game_state NOT IN ('finished')
    `, [userId, tableId]);
    
    if (activeGameResult.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave table during active game'
      });
    }
    
    // Cash out transaction
    const queries = [
      {
        query: 'UPDATE users SET balance = balance + ? WHERE id = ?',
        params: [seat.chips, userId]
      },
      {
        query: 'UPDATE poker_seats SET is_active = false, left_at = NOW() WHERE id = ?',
        params: [seat.id]
      }
    ];
    
    await executeTransaction(queries);
    
    res.json({
      success: true,
      message: 'Successfully left poker table',
      data: {
        chipsReturned: seat.chips
      }
    });
    
  } catch (error) {
    console.error('Error leaving poker table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave poker table'
    });
  }
});

/**
 * Start a hand manually (for testing/admin purposes)
 */
router.post('/start-hand', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.body;
    
    if (!tableId) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required'
      });
    }
    
    // Get table info
    const tableResult = await executeQuery(
      'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
      [tableId]
    );
    
    if (tableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    // Get current player count (including AI)
    const playerCount = await executeQuery(`
      SELECT COUNT(*) as count
      FROM poker_seats ps
      WHERE ps.table_id = ? AND ps.is_active = true AND ps.chips > 0
    `, [tableId]);
    
    if (playerCount[0].count < 2) {
      return res.status(400).json({
        success: false,
        message: 'Need at least 2 players to start a hand'
      });
    }
    
    // Use poker manager directly to start hand
    const pokerManager = getPokerManager();
    if (pokerManager) {
      await pokerManager.startHand(tableId);
    }
    
    res.json({
      success: true,
      message: 'Hand start command sent',
      data: {
        tableId,
        playerCount: playerCount[0].count
      }
    });
    
  } catch (error) {
    console.error('Error starting poker hand:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start poker hand'
    });
  }
});

/**
 * Start a new poker game (requires minimum players)
 */
router.post('/start-game', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.body;
    
    // Get table info
    const tableResult = await executeQuery(
      'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
      [tableId]
    );
    
    if (tableResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    const table = tableResult[0];
    
    // Get active players
    const players = await executeQuery(
      'SELECT * FROM poker_seats WHERE table_id = ? AND is_active = true AND is_sitting_out = false',
      [tableId]
    );
    
    if (players.length < table.min_players) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${table.min_players} players required to start game`
      });
    }
    
    // Check if game already in progress
    const existingGameResult = await executeQuery(
      'SELECT * FROM poker_games WHERE table_id = ? AND game_state NOT IN ("finished")',
      [tableId]
    );
    
    if (existingGameResult.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Game already in progress'
      });
    }
    
    // Create new deck and shuffle it
    const deck = createDeck();
    const serverSeed = ProvablyFairEngine.generateServerSeed();
    const clientSeed = 'poker_game_' + Date.now();
    const nonce = 1;
    const shuffledDeck = shuffleDeck(deck, serverSeed, clientSeed, nonce);
    
    // Determine dealer position (rotate from last game or start at 0)
    const lastGameResult = await executeQuery(
      'SELECT dealer_position FROM poker_games WHERE table_id = ? ORDER BY created_at DESC LIMIT 1',
      [tableId]
    );
    
    const dealerPosition = lastGameResult.length > 0 
      ? (lastGameResult[0].dealer_position + 1) % players.length 
      : 0;
    
    const smallBlindPosition = (dealerPosition + 1) % players.length;
    const bigBlindPosition = (dealerPosition + 2) % players.length;
    
    // Create new game
    const gameResult = await executeQuery(`
      INSERT INTO poker_games (
        table_id, dealer_position, small_blind_position, big_blind_position,
        current_player_position, pot_amount, deck_state, current_bet, min_raise
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tableId, dealerPosition, smallBlindPosition, bigBlindPosition,
      bigBlindPosition, 0, JSON.stringify(shuffledDeck), table.big_blind, table.big_blind
    ]);
    
    const gameId = gameResult.insertId;
    
    // Update player seats with game reference
    await executeQuery(
      'UPDATE poker_seats SET game_id = ? WHERE table_id = ? AND is_active = true',
      [gameId, tableId]
    );
    
    // Post blinds
    const smallBlindPlayer = players[smallBlindPosition];
    const bigBlindPlayer = players[bigBlindPosition];
    
    const blindQueries = [
      {
        query: 'UPDATE poker_seats SET current_bet = ?, total_bet_this_hand = ?, chips = chips - ? WHERE id = ?',
        params: [table.small_blind, table.small_blind, table.small_blind, smallBlindPlayer.id]
      },
      {
        query: 'UPDATE poker_seats SET current_bet = ?, total_bet_this_hand = ?, chips = chips - ? WHERE id = ?',
        params: [table.big_blind, table.big_blind, table.big_blind, bigBlindPlayer.id]
      },
      {
        query: 'UPDATE poker_games SET pot_amount = ?, game_state = ? WHERE id = ?',
        params: [parseFloat(table.small_blind) + parseFloat(table.big_blind), 'dealing', gameId]
      }
    ];
    
    await executeTransaction(blindQueries);
    
    res.json({
      success: true,
      message: 'Poker game started successfully',
      data: {
        gameId,
        dealerPosition,
        smallBlindPosition,
        bigBlindPosition,
        potAmount: parseFloat(table.small_blind) + parseFloat(table.big_blind)
      }
    });
    
  } catch (error) {
    console.error('Error starting poker game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start poker game'
    });
  }
});

/**
 * Make a poker action (fold, call, raise, etc.)
 */
router.post('/action', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { error, value } = playerActionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    const { gameId, action, amount = 0 } = value;
    const userId = (req as any).user.id;
    
    // Get game details
    const gameResult = await executeQuery(
      'SELECT * FROM poker_games WHERE id = ? AND game_state NOT IN ("finished")',
      [gameId]
    );
    
    if (gameResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Game not found or finished'
      });
    }
    
    const game = gameResult[0];
    
    // Get player's seat
    const seatResult = await executeQuery(
      'SELECT * FROM poker_seats WHERE game_id = ? AND user_id = ? AND is_active = true',
      [gameId, userId]
    );
    
    if (seatResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Player not in this game'
      });
    }
    
    const playerSeat = seatResult[0];
    
    // Check if it's player's turn
    if (game.current_player_position !== playerSeat.seat_position) {
      return res.status(400).json({
        success: false,
        message: 'Not your turn'
      });
    }
    
    // Get all players in game
    const allPlayers = await executeQuery(
      'SELECT * FROM poker_seats WHERE game_id = ? AND is_active = true ORDER BY seat_position',
      [gameId]
    );
    
    // Convert to Player objects for engine
    const players: Player[] = allPlayers.map((seat: any) => ({
      userId: seat.user_id,
      seatPosition: seat.seat_position,
      chips: parseFloat(seat.chips),
      holeCards: seat.hole_cards ? (typeof seat.hole_cards === 'string' ? JSON.parse(seat.hole_cards) : seat.hole_cards) : [],
      currentBet: parseFloat(seat.current_bet),
      totalBetThisHand: parseFloat(seat.total_bet_this_hand),
      lastAction: seat.last_action,
      isActive: seat.is_active,
      isAllIn: seat.is_all_in,
      isFolded: seat.last_action === 'fold'
    }));
    
    const currentPlayer = players.find(p => p.userId === userId)!;
    
    // Validate action
    const validation = validatePlayerAction(
      currentPlayer, 
      action, 
      amount, 
      parseFloat(game.current_bet),
      parseFloat(game.min_raise)
    );
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }
    
    // Process action - this will be handled by WebSocket events in real implementation
    // For now, just acknowledge the action
    
    res.json({
      success: true,
      message: `Action ${action} processed successfully`,
      data: {
        action,
        amount,
        playerId: userId
      }
    });
    
  } catch (error) {
    console.error('Error processing poker action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process poker action'
    });
  }
});

/**
 * Get player's poker statistics
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const statsResult = await executeQuery(`
      SELECT 
        pps.*,
        COUNT(ph.id) as total_hands_history,
        SUM(CASE WHEN ph.winner_user_id = ? THEN 1 ELSE 0 END) as hands_won_history,
        MAX(ph.total_pot) as biggest_pot_won
      FROM poker_player_stats pps
      LEFT JOIN poker_hands ph ON pps.user_id = ?
      WHERE pps.user_id = ?
      GROUP BY pps.user_id
    `, [userId, userId, userId]);
    
    const stats = statsResult.length > 0 ? statsResult[0] : {
      user_id: userId,
      hands_played: 0,
      hands_won: 0,
      total_winnings: 0,
      total_losses: 0
    };
    
    // Calculate derived statistics
    const winRate = stats.hands_played > 0 ? (stats.hands_won / stats.hands_played * 100) : 0;
    const netProfit = parseFloat(stats.total_winnings) - parseFloat(stats.total_losses);
    const profitPerHand = stats.hands_played > 0 ? netProfit / stats.hands_played : 0;
    
    res.json({
      success: true,
      message: 'Poker statistics retrieved successfully',
      data: {
        ...stats,
        win_rate: winRate.toFixed(2),
        net_profit: netProfit.toFixed(2),
        profit_per_hand: profitPerHand.toFixed(2)
      }
    });
    
  } catch (error) {
    console.error('Error fetching poker statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch poker statistics'
    });
  }
});

/**
 * Get poker leaderboard
 */
router.get('/leaderboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const leaderboard = await executeQuery(`
      SELECT 
        u.username,
        u.avatar_url,
        pps.total_winnings,
        pps.hands_played,
        pps.hands_won,
        pps.tournaments_won,
        (pps.hands_won / GREATEST(pps.hands_played, 1) * 100) as win_rate,
        (pps.total_winnings - pps.total_losses) as net_profit
      FROM poker_player_stats pps
      JOIN users u ON pps.user_id = u.id
      WHERE pps.hands_played >= 10
      ORDER BY net_profit DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      message: 'Poker leaderboard retrieved successfully',
      data: { leaderboard }
    });
    
  } catch (error) {
    console.error('Error fetching poker leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch poker leaderboard'
    });
  }
});

/**
 * Emergency system reset endpoint - for development/debugging
 */
router.post('/emergency-reset', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Emergency reset not allowed in production'
      });
    }

    const { DatabaseCleanupService } = await import('../services/databaseCleanup');
    await DatabaseCleanupService.emergencyReset();

    res.json({
      success: true,
      message: 'Emergency reset completed successfully'
    });

  } catch (error) {
    console.error('Emergency reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Emergency reset failed'
    });
  }
});

/**
 * System health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { DatabaseCleanupService } = await import('../services/databaseCleanup');
    const healthStats = await DatabaseCleanupService.getHealthStats();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        stats: healthStats,
        status: healthStats?.orphaned_seats > 10 ? 'warning' : 'healthy'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
});

/**
 * Debug endpoint to trigger WebSocket table state update
 */
router.post('/debug/broadcast-table/:tableId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const pokerManager = getPokerManager();
    
    if (pokerManager) {
      // Force send table state update via WebSocket
      await (pokerManager as any).sendTableState(tableId);
      console.log(`🔧 DEBUG: Forced WebSocket table state update for table ${tableId}`);
    }

    res.json({
      success: true,
      message: `WebSocket table state broadcast sent for table ${tableId}`
    });

  } catch (error) {
    console.error('Debug broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug broadcast failed'
    });
  }
});

export default router;