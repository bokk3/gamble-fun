/**
 * AI Player Manager
 * Manages AI player lifecycle, table assignment, and automated actions
 */

import { AIPokerEngine, AIPlayer, GameContext, AIDecision } from './aiPokerEngine';
import PokerGameManager from '../socket/pokerHandler';
import { executeQuery } from '../config/database';
import { Server } from 'socket.io';

export interface AIPlayerState {
  id: number;
  tableId: number;
  isActive: boolean;
  lastAction: string;
  lastActionTime: Date;
  chips: number;
  holeCards?: any[];
}

export class AIPlayerManager {
  private static aiStates: Map<number, AIPlayerState> = new Map();
  private static actionTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private static io: Server;

  /**
   * Initialize AI Player Manager with Socket.IO instance
   */
  static initialize(socketIO: Server) {
    this.io = socketIO;
    this.startAIMonitoring();
    console.log('AI Player Manager initialized');
  }

  /**
   * Start monitoring AI players and managing their actions
   */
  private static startAIMonitoring() {
    // Check for AI actions every 2-5 seconds
    setInterval(async () => {
      await this.processAIActions();
    }, 3000);

    // Fill empty tables with AI players every 30 seconds
    setInterval(async () => {
      await this.manageTablePopulation();
    }, 30000);
  }

  /**
   * Process pending AI actions across all tables with player timers
   */
  private static async processAIActions() {
    try {
      // Get all active poker games (both AI and human players)
      const activeGames = await executeQuery(`
        SELECT 
          pg.id as game_id,
          pg.table_id,
          pg.current_player_position,
          pg.game_state,
          pg.current_bet,
          pg.pot_amount as pot,
          pg.betting_round,
          pg.community_cards,
          pt.small_blind,
          pt.big_blind,
          pg.dealer_position
        FROM poker_games pg
        JOIN poker_tables pt ON pg.table_id = pt.id
        WHERE pg.game_state IN ('pre_flop', 'flop', 'turn', 'river')
      `);

      for (const game of activeGames) {
        // Get current player (both AI and human)
        const currentPlayer = await executeQuery(`
          SELECT ps.*, ps.hole_cards,
          CASE 
            WHEN ps.user_id < 0 THEN pai.name
            ELSE u.username
          END as name,
          CASE 
            WHEN ps.user_id < 0 THEN true
            ELSE false
          END as is_ai
          FROM poker_seats ps
          LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
          LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
          WHERE ps.table_id = ? 
          AND ps.seat_position = ? 
          AND ps.is_active = true
        `, [game.table_id, game.current_player_position]);

        if (currentPlayer.length === 0) continue; // No current player

        const player = currentPlayer[0];
        
        // Check for player action timeout (30 seconds)
        const timeoutMs = 30000; // 30 seconds
        const gameLastUpdate = new Date(game.last_action_at).getTime();
        const now = Date.now();
        const timeSinceLastAction = now - gameLastUpdate;

        if (timeSinceLastAction > timeoutMs) {
          // Player timed out - auto fold
          console.log(`⏰ Player ${player.name} at position ${player.seat_position} timed out! Auto-folding...`);
          await this.forcePlayerAction(game, player, 'fold');
          continue;
        }

        // If it's an AI player's turn, process normally
        if (!player.is_ai) continue; // Wait for human player (unless timed out)

        const aiPlayer = currentPlayer[0];
        const aiId = Math.abs(aiPlayer.user_id); // Convert negative ID back to positive

        // Get AI player details
        const aiDetails = await AIPokerEngine.getAIPlayer(aiId);
        if (!aiDetails) continue;

        // Check if we need to delay action (realistic timing)
        const lastActionTime = this.aiStates.get(aiId)?.lastActionTime;
        const currentTimeAI = new Date();
        const timeSinceAILastAction = lastActionTime ? currentTimeAI.getTime() - lastActionTime.getTime() : 10000;
        
        // AI thinking time based on skill level (beginners take longer)
        const thinkingTime = this.getAIThinkingTime(aiDetails.skill_level);
        
        if (timeSinceAILastAction < thinkingTime) {
          console.log(`🤔 ${aiDetails.name} still thinking... (${thinkingTime - timeSinceAILastAction}ms remaining)`);
          continue;
        }

        // Make AI decision
        await this.executeAIAction(game, aiPlayer, aiDetails);
      }

    } catch (error) {
      console.error('Error processing AI actions:', error);
    }
  }

  /**
   * Execute AI action for a specific game
   */
  private static async executeAIAction(game: any, aiPlayer: any, aiDetails: AIPlayer) {
    try {
      // Get game context
      const context = await this.buildGameContext(game, aiPlayer);
      
      // Parse hole cards (handle both string and object formats)
      const holeCards = this.safeParseJSON(aiPlayer.hole_cards, []);
      
      // Make AI decision
      console.log(`🤖 ${aiDetails.name} making decision with cards:`, holeCards.map((c: any) => c.display || `${c.rank}${c.suit}`));
      const decision = AIPokerEngine.makeAIDecision(aiDetails, context, holeCards);
      console.log(`🎯 ${aiDetails.name} decision:`, decision);
      
      // Add realistic delay before action
      const delay = this.getActionDelay(aiDetails, decision);
      
      setTimeout(async () => {
        await this.performAIAction(game, aiPlayer, aiDetails, decision);
      }, delay);

    } catch (error) {
      console.error('Error executing AI action:', error);
    }
  }

  /**
   * Perform the actual AI action
   */
  private static async performAIAction(game: any, aiPlayer: any, aiDetails: AIPlayer, decision: AIDecision) {
    try {
      const aiId = Math.abs(aiPlayer.user_id);
      
      // Parse hole cards safely
      const holeCardsForState = this.safeParseJSON(aiPlayer.hole_cards, []);

      // Update AI state
      this.aiStates.set(aiId, {
        id: aiId,
        tableId: game.table_id,
        isActive: true,
        lastAction: decision.action,
        lastActionTime: new Date(),
        chips: parseFloat(aiPlayer.chips),
        holeCards: holeCardsForState
      });

      // Execute AI action directly in database for now
      // In a full implementation, we'd integrate with PokerGameManager
      console.log(`AI ${aiDetails.name} decided to ${decision.action}${decision.amount ? ` $${decision.amount}` : ''}`);
      
      // For now, just update the game state in database
      // This is a simplified implementation - normally would integrate with full game engine
      console.log(`AI Action: ${aiDetails.name} -> ${decision.action} ${decision.amount || ''} (confidence: ${Math.round(decision.confidence * 100)}%)`);
      
      // Update AI player's last action in the seat
      await executeQuery(
        'UPDATE poker_seats SET last_action = ?, current_bet = current_bet + ? WHERE table_id = ? AND user_id = ?',
        [decision.action, decision.amount || 0, game.table_id, aiPlayer.user_id]
      );

      // Advance to next player or end hand
      const nextPlayerPosition = await this.getNextActivePlayer(game.table_id, game.current_player_position);
      if (nextPlayerPosition !== null) {
        await executeQuery(
          'UPDATE poker_games SET current_player_position = ? WHERE id = ?',
          [nextPlayerPosition, game.game_id]
        );
        console.log(`Turn advanced from position ${game.current_player_position} to ${nextPlayerPosition}`);
      } else {
        // End the hand - only one player remaining
        await executeQuery(
          'UPDATE poker_games SET game_state = ?, finished_at = NOW() WHERE id = ?',
          ['finished', game.game_id]
        );
        console.log(`🏁 Hand finished - only one player remaining at table ${game.table_id}`);
        
        // Award pot to last remaining player
        await this.awardPotToWinner(game.table_id, game.pot);
        return; // Don't continue processing this game
      }

      // Emit AI action to room for real-time updates
      this.io.to(`poker_table_${game.table_id}`).emit('ai_action', {
        aiName: aiDetails.name,
        action: decision.action,
        amount: decision.amount,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        nextPlayer: nextPlayerPosition
      });

      console.log(`AI ${aiDetails.name} performed ${decision.action} at table ${game.table_id}`);

    } catch (error) {
      console.error('Error performing AI action:', error);
    }
  }

  /**
   * Build game context for AI decision making
   */
  private static async buildGameContext(game: any, aiPlayer: any): Promise<GameContext> {
    // Get all players at the table
    const players = await executeQuery(`
      SELECT 
        ps.*,
        CASE 
          WHEN ps.user_id < 0 THEN pai.name
          ELSE u.username
        END as name,
        ps.last_action,
        ps.current_bet as last_bet_amount
      FROM poker_seats ps
      LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
      LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
      LEFT JOIN poker_actions pa ON pa.user_id = ps.user_id
      WHERE ps.table_id = ? AND ps.is_active = true
      ORDER BY ps.seat_position
    `, [game.table_id]);

    // Convert to Player format
    const contextPlayers = players.map((p: any) => ({
      userId: p.user_id,
      name: p.name,
      chips: parseFloat(p.chips),
      currentBet: parseFloat(p.current_bet || 0),
      position: p.seat_position,
      isActive: p.is_active,
      lastAction: p.last_action,
      isAllIn: parseFloat(p.chips) === 0 && parseFloat(p.current_bet || 0) > 0
    }));

    // Find AI player's position
    const myPosition = aiPlayer.seat_position;
    
    // Count active players (not folded)
    const activePlayers = contextPlayers.filter((p: any) => p.isActive && p.chips > 0).length;

    return {
      tableId: game.table_id,
      gameId: game.game_id,
      pot: parseFloat(game.pot),
      currentBet: parseFloat(game.current_bet),
      minRaise: parseFloat(game.current_bet) * 2, // Simplified - should be minimum raise amount
      communityCards: game.community_cards ? JSON.parse(game.community_cards) : [],
      bettingRound: game.betting_round,
      players: contextPlayers,
      smallBlind: parseFloat(game.small_blind),
      bigBlind: parseFloat(game.big_blind),
      dealerPosition: game.dealer_position,
      myPosition: myPosition,
      activePlayers: activePlayers
    };
  }

  /**
   * Manage table population with AI players
   */
  private static async manageTablePopulation() {
    try {
      // Get all active tables with player counts
      const tables = await executeQuery(`
        SELECT 
          pt.id,
          pt.name,
          pt.max_players,
          pt.min_players,
          COUNT(ps.id) as current_players
        FROM poker_tables pt
        LEFT JOIN poker_seats ps ON pt.id = ps.table_id AND ps.is_active = true
        WHERE pt.is_active = true
        GROUP BY pt.id
        HAVING current_players < pt.min_players
      `);

      for (const table of tables) {
        const targetPlayers = Math.min(table.max_players, 6); // Target 6 players max
        
        if (table.current_players < table.min_players) {
          console.log(`Filling table ${table.name} (${table.current_players}/${targetPlayers} players)`);
          await AIPokerEngine.fillTableWithAI(table.id, targetPlayers);
        }
      }

    } catch (error) {
      console.error('Error managing table population:', error);
    }
  }

  /**
   * Get AI thinking time based on skill level
   */
  private static getAIThinkingTime(skillLevel: string): number {
    switch (skillLevel) {
      case 'beginner': return 8000; // 8 seconds
      case 'intermediate': return 5000; // 5 seconds
      case 'advanced': return 3000; // 3 seconds
      case 'expert': return 2000; // 2 seconds
      case 'professional': return 1500; // 1.5 seconds
      default: return 4000;
    }
  }

  /**
   * Get realistic action delay based on AI personality and decision
   */
  private static getActionDelay(ai: AIPlayer, decision: AIDecision): number {
    let baseDelay = 1000; // 1 second base

    // Confident decisions are faster
    if (decision.confidence > 0.8) {
      baseDelay *= 0.7;
    } else if (decision.confidence < 0.4) {
      baseDelay *= 1.5; // Uncertain decisions take longer
    }

    // Complex actions take longer
    if (decision.action === 'raise' || decision.action === 'bet') {
      baseDelay *= 1.3;
    } else if (decision.action === 'fold') {
      baseDelay *= 0.8; // Quick folds
    }

    // Skill level affects speed
    switch (ai.skill_level) {
      case 'beginner':
        baseDelay *= 1.5;
        break;
      case 'professional':
        baseDelay *= 0.7;
        break;
    }

    // Add some randomness for realism
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    
    return Math.round(baseDelay * randomFactor);
  }

  /**
   * Handle AI player leaving table (when bankroll gets too low)
   */
  static async handleAIBankrollCheck(aiId: number, currentChips: number) {
    try {
      const ai = await AIPokerEngine.getAIPlayer(aiId);
      if (!ai) return;

      // If AI has less than 5% of their bankroll left, they should leave
      const minChips = ai.bankroll * 0.05;
      
      if (currentChips < minChips) {
        // Find AI's table and remove them
        const aiSeat = await executeQuery(
          'SELECT table_id FROM poker_seats WHERE user_id = ? AND is_active = true',
          [-aiId]
        );

        if (aiSeat.length > 0) {
          await AIPokerEngine.removeAIFromTable(aiSeat[0].table_id, aiId);
          
          // Update bankroll
          await AIPokerEngine.updateAIBankroll(aiId, currentChips - ai.bankroll);
          
          console.log(`AI ${ai.name} left table due to low bankroll`);
        }
      }
    } catch (error) {
      console.error('Error handling AI bankroll check:', error);
    }
  }

  /**
   * Force player action (AI or human) due to timeout
   */
  private static async forcePlayerAction(game: any, player: any, action: string) {
    try {
      console.log(`🎬 Forcing ${player.name} to ${action} due to timeout`);
      
      // Update player action
      await executeQuery(
        'UPDATE poker_seats SET last_action = ? WHERE table_id = ? AND user_id = ?',
        [action, game.table_id, player.user_id]
      );

      // Update game timestamp
      await executeQuery(
        'UPDATE poker_games SET last_action_at = NOW() WHERE id = ?',
        [game.game_id]
      );

      // Advance to next player or check betting round completion
      await this.advanceGameState(game, player, action);
      
    } catch (error) {
      console.error('Error forcing player action:', error);
    }
  }

  /**
   * Advance game state and check for betting round completion
   */
  private static async advanceGameState(game: any, player: any, action: string) {
    try {
      // Check if betting round is complete
      const isRoundComplete = await this.isBettingRoundComplete(game.table_id);
      
      if (isRoundComplete) {
        console.log(`🎯 Betting round ${game.betting_round} completed!`);
        await this.advanceBettingRound(game);
      } else {
        // Advance to next player
        const nextPlayerPosition = await this.getNextActivePlayer(game.table_id, game.current_player_position);
        if (nextPlayerPosition !== null) {
          await executeQuery(
            'UPDATE poker_games SET current_player_position = ?, last_action_at = NOW() WHERE id = ?',
            [nextPlayerPosition, game.game_id]
          );
          console.log(`🔄 Turn advanced from position ${game.current_player_position} to ${nextPlayerPosition}`);
        } else {
          // Only one player remaining - end hand
          await this.endHand(game, 'fold_out');
        }
      }
    } catch (error) {
      console.error('Error advancing game state:', error);
    }
  }

  /**
   * Check if current betting round is complete
   */
  private static async isBettingRoundComplete(tableId: number): Promise<boolean> {
    try {
      const activePlayers = await executeQuery(`
        SELECT COUNT(*) as active_count,
        COUNT(CASE WHEN last_action IN ('call', 'check', 'raise', 'bet') THEN 1 END) as acted_count,
        MAX(current_bet) as max_bet,
        COUNT(CASE WHEN current_bet = (SELECT MAX(current_bet) FROM poker_seats WHERE table_id = ? AND is_active = true AND (last_action IS NULL OR last_action != 'fold')) THEN 1 END) as matched_bet_count
        FROM poker_seats 
        WHERE table_id = ? AND is_active = true AND (last_action IS NULL OR last_action != 'fold')
      `, [tableId, tableId]);

      const stats = activePlayers[0];
      
      // Round complete if all active players have acted and matched the current bet
      return stats.acted_count === stats.active_count && stats.matched_bet_count === stats.active_count;
      
    } catch (error) {
      console.error('Error checking betting round completion:', error);
      return false;
    }
  }

  /**
   * Advance to next betting round (flop, turn, river, showdown)
   */
  private static async advanceBettingRound(game: any) {
    try {
      let nextRound: string;
      let communityCards = game.community_cards ? JSON.parse(game.community_cards) : [];
      
      switch (game.betting_round) {
        case 'pre_flop':
          nextRound = 'flop';
          // Deal 3 flop cards
          const flopCards = await this.dealCommunityCards(game.game_id, 3);
          communityCards = [...communityCards, ...flopCards];
          console.log(`🃏 FLOP: ${flopCards.map((c: any) => c.display).join(', ')}`);
          break;
        case 'flop':
          nextRound = 'turn';
          // Deal 1 turn card
          const turnCard = await this.dealCommunityCards(game.game_id, 1);
          communityCards = [...communityCards, ...turnCard];
          console.log(`🃏 TURN: ${turnCard[0].display}`);
          break;
        case 'turn':
          nextRound = 'river';
          // Deal 1 river card
          const riverCard = await this.dealCommunityCards(game.game_id, 1);
          communityCards = [...communityCards, ...riverCard];
          console.log(`🃏 RIVER: ${riverCard[0].display}`);
          break;
        case 'river':
          // Hand complete - showdown
          await this.endHand(game, 'showdown');
          return;
        default:
          return;
      }

      // Update game state
      await executeQuery(`
        UPDATE poker_games 
        SET betting_round = ?, 
            community_cards = ?,
            current_player_position = (
              SELECT MIN(seat_position) 
              FROM poker_seats 
              WHERE table_id = ? AND is_active = true AND (last_action IS NULL OR last_action != 'fold')
            ),
            last_action_at = NOW()
        WHERE id = ?
      `, [nextRound, JSON.stringify(communityCards), game.table_id, game.game_id]);

      // Reset player bets for new round
      await executeQuery(`
        UPDATE poker_seats 
        SET current_bet = 0, last_action = NULL
        WHERE table_id = ? AND is_active = true AND (last_action IS NULL OR last_action != 'fold')
      `, [game.table_id]);

      console.log(`🎲 Advanced to ${nextRound.toUpperCase()} betting round`);
      
      // Emit to frontend
      this.io.to(`poker_table_${game.table_id}`).emit('betting_round_advanced', {
        round: nextRound,
        communityCards,
        pot: game.pot
      });

    } catch (error) {
      console.error('Error advancing betting round:', error);
    }
  }

  /**
   * Deal community cards from deck
   */
  private static async dealCommunityCards(gameId: number, count: number): Promise<any[]> {
    // Simplified - in full implementation, would use proper deck management
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const cards = [];
    
    for (let i = 0; i < count; i++) {
      const rank = Math.floor(Math.random() * 13) + 2; // 2-14 (Ace high)
      const suit = suits[Math.floor(Math.random() * 4)];
      const display = this.getCardDisplay(rank, suit);
      
      cards.push({ rank, suit, display });
    }
    
    return cards;
  }

  /**
   * Get card display string
   */
  private static getCardDisplay(rank: number, suit: string): string {
    const rankNames: { [key: number]: string } = {
      14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10'
    };
    const suitSymbols: { [key: string]: string } = {
      'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠'
    };
    
    const rankStr = rankNames[rank] || rank.toString();
    return `${rankStr}${suitSymbols[suit]}`;
  }

  /**
   * End hand with winner determination
   */
  private static async endHand(game: any, endType: string) {
    try {
      if (endType === 'fold_out') {
        // Find last remaining player
        const winner = await executeQuery(`
          SELECT user_id, chips, 
          CASE 
            WHEN user_id > 0 THEN (SELECT username FROM users WHERE id = user_id)
            ELSE (SELECT name FROM poker_ai_players WHERE id = -user_id)
          END as name
          FROM poker_seats 
          WHERE table_id = ? AND is_active = true 
          AND (last_action IS NULL OR last_action != 'fold')
          LIMIT 1
        `, [game.table_id]);

        if (winner.length > 0) {
          await this.awardPotToWinner(game.table_id, game.pot, winner[0]);
        }
      } else {
        // TODO: Implement showdown logic with hand evaluation
        console.log(`🏁 Hand ended with ${endType}`);
      }

      // Mark game as finished
      await executeQuery(
        'UPDATE poker_games SET game_state = ?, finished_at = NOW() WHERE id = ?',
        ['finished', game.game_id]
      );

      // Start new hand after 5 seconds
      setTimeout(() => {
        this.startNewHandAtTable(game.table_id);
      }, 5000);

    } catch (error) {
      console.error('Error ending hand:', error);
    }
  }

  /**
   * Start new hand at table
   */
  private static async startNewHandAtTable(tableId: number) {
    try {
      // Use existing start hand endpoint
      await executeQuery(
        'INSERT INTO poker_games (table_id, game_state) VALUES (?, ?)',
        [tableId, 'waiting']
      );
      console.log(`🎯 Starting new hand at table ${tableId}...`);
    } catch (error) {
      console.error('Error starting new hand:', error);
    }
  }

  /**
   * Force AI action if they're taking too long (fallback)
   */
  static async forceAIAction(gameId: number, playerId: number) {
    try {
      const aiId = Math.abs(playerId);
      const ai = await AIPokerEngine.getAIPlayer(aiId);
      
      if (ai) {
        // Force fold as default action
        await executeQuery(
          'UPDATE poker_seats SET last_action = ? WHERE user_id = ?',
          ['fold', playerId]
        );
        
        console.log(`Forced AI ${ai.name} to fold due to timeout`);
      }
    } catch (error) {
      console.error('Error forcing AI action:', error);
    }
  }

  /**
   * Award pot to the last remaining player
   */
  private static async awardPotToWinner(tableId: number, potAmount: number) {
    try {
      // Find the last player who hasn't folded
      const winner = await executeQuery(`
        SELECT user_id, chips, 
        CASE 
          WHEN user_id > 0 THEN (SELECT username FROM users WHERE id = user_id)
          ELSE (SELECT name FROM poker_ai_players WHERE id = -user_id)
        END as name
        FROM poker_seats 
        WHERE table_id = ? AND is_active = true 
        AND (last_action IS NULL OR last_action != 'fold')
        LIMIT 1
      `, [tableId]);

      if (winner.length > 0) {
        const winnerPlayer = winner[0];
        
        // Validate chip amounts to prevent NaN
        const currentChips = parseFloat(winnerPlayer.chips) || 0;
        const potValue = parseFloat(potAmount) || 0;
        const newChips = currentChips + potValue;
        
        if (isNaN(newChips) || newChips < 0) {
          console.error(`Invalid chip calculation: currentChips=${currentChips}, potValue=${potValue}, newChips=${newChips}`);
          return;
        }
        
        // Award chips to winner
        await executeQuery(
          'UPDATE poker_seats SET chips = ?, total_bet_this_hand = 0, current_bet = 0, last_action = NULL WHERE table_id = ? AND user_id = ?',
          [newChips.toFixed(2), tableId, winnerPlayer.user_id]
        );
        
        console.log(`🏆 ${winnerPlayer.name} wins $${potValue} pot! New chip count: $${newChips.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error awarding pot to winner:', error);
    }
  }

  /**
   * Get next active player position
   */
  private static async getNextActivePlayer(tableId: number, currentPosition: number): Promise<number | null> {
    try {
      // Get all active players at table who haven't folded, ordered by seat position
      const players = await executeQuery(`
        SELECT seat_position, user_id, last_action
        FROM poker_seats 
        WHERE table_id = ? AND is_active = true 
        AND (last_action IS NULL OR last_action != 'fold')
        ORDER BY seat_position
      `, [tableId]);

      if (players.length <= 1) {
        console.log(`Only ${players.length} active players remaining, hand should end`);
        return null; // Game should end
      }

      // Find current player index
      const currentIndex = players.findIndex((p: any) => p.seat_position === currentPosition);
      
      // Get next player (wrap around if needed)
      const nextIndex = (currentIndex + 1) % players.length;
      const nextPlayer = players[nextIndex];
      
      console.log(`Next player calculation: current=${currentPosition}, next=${nextPlayer.seat_position}, active_players=${players.length}`);
      
      return nextPlayer.seat_position;
      
    } catch (error) {
      console.error('Error getting next active player:', error);
      return null;
    }
  }

  /**
   * Safely parse JSON data that might be string or already parsed object
   */
  private static safeParseJSON(data: any, defaultValue: any = null): any {
    if (!data) return defaultValue;
    
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse JSON string:', data);
        return defaultValue;
      }
    }
    
    // Already parsed object
    return data;
  }

  /**
   * Get AI player statistics for debugging
   */
  static getAIStats(): any {
    return {
      activeAIPlayers: this.aiStates.size,
      pendingActions: this.actionTimeouts.size,
      aiStates: Array.from(this.aiStates.entries())
    };
  }
}

export default AIPlayerManager;