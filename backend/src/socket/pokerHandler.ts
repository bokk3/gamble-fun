/**
 * Poker WebSocket Handler
 * Real-time multiplayer poker game events and synchronization
 */

import { Server, Socket } from 'socket.io';
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

interface PokerPlayer extends Player {
  socketId: string | null; // null for AI players
  username: string;
  avatar?: string;
}

interface PokerTable {
  id: number;
  gameId?: number;
  players: Map<number, PokerPlayer>; // userId -> player
  spectators: Set<string>; // socket IDs
  gameState: any;
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  currentPlayerPosition: number;
  bettingRound: string;
  handNumber: number;
}

class PokerGameManager {
  private io: Server;
  private tables: Map<number, PokerTable> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Join a poker table
   */
  async joinTable(socket: Socket, data: { tableId: number; userId: number }) {
    try {
      const { tableId, userId } = data;

      console.log(`🎯 WEBSOCKET: User ${userId} attempting to join poker table ${tableId}`);

      // Get table info
      const tableResult = await executeQuery(
        'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
        [tableId]
      );

      if (tableResult.length === 0) {
        socket.emit('poker:error', { message: 'Table not found' });
        return;
      }

      const table = tableResult[0];

      // Get user info
      const userResult = await executeQuery(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );

      if (userResult.length === 0) {
        socket.emit('poker:error', { message: 'User not found' });
        return;
      }

      const user = userResult[0];

      // Check if player is already at table
      const seatResult = await executeQuery(
        'SELECT * FROM poker_seats WHERE table_id = ? AND user_id = ? AND is_active = true',
        [tableId, userId]
      );

      if (seatResult.length === 0) {
        socket.emit('poker:error', { message: 'Player not seated at table' });
        return;
      }

      const seat = seatResult[0];

      // Initialize table if not exists
      if (!this.tables.has(tableId)) {
        this.tables.set(tableId, {
          id: tableId,
          players: new Map(),
          spectators: new Set(),
          gameState: null,
          deck: [],
          communityCards: [],
          pot: 0,
          currentBet: 0,
          minRaise: table.big_blind,
          dealerPosition: 0,
          smallBlindPosition: 1,
          bigBlindPosition: 2,
          currentPlayerPosition: 0,
          bettingRound: 'pre_flop',
          handNumber: 1
        });
      }

      const pokerTable = this.tables.get(tableId)!;

      // Add player to table
      const player: PokerPlayer = {
        userId,
        seatPosition: seat.seat_position,
        chips: parseFloat(seat.chips),
        holeCards: this.safeParseJSON(seat.hole_cards, []),
        currentBet: parseFloat(seat.current_bet || 0),
        totalBetThisHand: parseFloat(seat.total_bet_this_hand || 0),
        lastAction: seat.last_action,
        isActive: seat.is_active,
        isAllIn: seat.is_all_in,
        isFolded: seat.last_action === 'fold',
        socketId: socket.id,
        username: user.username,
        avatar: undefined
      };

      pokerTable.players.set(userId, player);

      // Join socket room
      socket.join(`poker_table_${tableId}`);

      // Send table state to player
      await this.sendTableState(tableId);

      // Notify other players
      socket.to(`poker_table_${tableId}`).emit('poker:player_joined', {
        player: {
          userId: player.userId,
          username: player.username,
          avatar: player.avatar,
          seatPosition: player.seatPosition,
          chips: player.chips,
          isActive: player.isActive
        }
      });

      socket.emit('poker:joined_table', {
        tableId,
        seatPosition: player.seatPosition,
        chips: player.chips
      });

      // Check if we can start a hand
      await this.checkAndStartHand(tableId);

    } catch (error) {
      console.error('Error joining poker table:', error);
      socket.emit('poker:error', { message: 'Failed to join table' });
    }
  }

  /**
   * Leave a poker table
   */
  async leaveTable(socket: Socket, data: { tableId: number; userId: number }) {
    try {
      const { tableId, userId } = data;
      
      const pokerTable = this.tables.get(tableId);
      if (!pokerTable) return;

      // Remove player
      pokerTable.players.delete(userId);
      socket.leave(`poker_table_${tableId}`);

      // Notify other players
      socket.to(`poker_table_${tableId}`).emit('poker:player_left', { userId });

      // Clean up empty tables
      if (pokerTable.players.size === 0 && pokerTable.spectators.size === 0) {
        this.tables.delete(tableId);
      }

    } catch (error) {
      console.error('Error leaving poker table:', error);
    }
  }

  /**
   * Start a new hand
   */
  async startNewHand(tableId: number) {
    try {
      console.log(`Starting new hand for table ${tableId}`);
      let pokerTable = this.tables.get(tableId);
      if (!pokerTable) {
        console.log(`No poker table found in memory for table ${tableId}, creating one`);
        // Initialize table if not exists
        const newTable: PokerTable = {
          id: tableId,
          players: new Map(),
          spectators: new Set(),
          gameState: null,
          deck: [],
          communityCards: [],
          pot: 0,
          currentBet: 0,
          minRaise: 0,
          dealerPosition: 0,
          smallBlindPosition: 1,
          bigBlindPosition: 2,
          currentPlayerPosition: 0,
          bettingRound: 'pre_flop',
          handNumber: 1
        };
        this.tables.set(tableId, newTable);
        pokerTable = newTable;
      }

      // Get all active players from database (including AI players)
      const dbPlayers = await executeQuery(`
        SELECT 
          ps.*,
          CASE 
            WHEN ps.user_id > 0 THEN u.username
            ELSE pai.name
          END as username,
          CASE 
            WHEN ps.user_id < 0 THEN true
            ELSE false
          END as isAI
        FROM poker_seats ps
        LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
        LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
        WHERE ps.table_id = ? AND ps.is_active = true AND ps.chips > 0
        ORDER BY ps.seat_position ASC
      `, [tableId]);

      if (dbPlayers.length < 2) {
        this.io.to(`poker_table_${tableId}`).emit('poker:error', {
          message: 'Not enough players to start hand'
        });
        return;
      }

      // Create player objects for all players (human + AI)
      const activePlayers = dbPlayers.map((dbPlayer: any) => {
        // Check if this is a connected human player
        const connectedPlayer = pokerTable.players.get(dbPlayer.user_id);
        
        if (connectedPlayer) {
          // Use connected player data
          return connectedPlayer;
        } else {
          // Create AI player object
          return {
            userId: dbPlayer.user_id,
            seatPosition: dbPlayer.seat_position,
            chips: parseFloat(dbPlayer.chips),
            holeCards: this.safeParseJSON(dbPlayer.hole_cards, []),
            currentBet: parseFloat(dbPlayer.current_bet || 0),
            totalBetThisHand: parseFloat(dbPlayer.total_bet_this_hand || 0),
            lastAction: dbPlayer.last_action,
            isActive: dbPlayer.is_active,
            isAllIn: dbPlayer.is_all_in,
            isFolded: dbPlayer.last_action === 'fold',
            socketId: null, // AI players don't have sockets
            username: dbPlayer.username,
            avatar: undefined,
            isAI: dbPlayer.isAI
          } as PokerPlayer;
        }
      });

      // Get table info for blinds
      const tableResult = await executeQuery(
        'SELECT * FROM poker_tables WHERE id = ?',
        [tableId]
      );

      if (tableResult.length === 0) return;
      const table = tableResult[0];

      // Create and shuffle new deck
      const deck = createDeck();
      const serverSeed = ProvablyFairEngine.generateServerSeed();
      const clientSeed = `poker_hand_${tableId}_${Date.now()}`;
      const nonce = pokerTable.handNumber;
      const shuffledDeck = shuffleDeck(deck, serverSeed, clientSeed, nonce);

      // Reset game state
      pokerTable.deck = shuffledDeck;
      pokerTable.communityCards = [];
      pokerTable.pot = 0;
      pokerTable.currentBet = parseFloat(table.big_blind);
      pokerTable.minRaise = parseFloat(table.big_blind);
      pokerTable.bettingRound = 'pre_flop';
      
      // Rotate dealer position
      pokerTable.dealerPosition = (pokerTable.dealerPosition + 1) % activePlayers.length;
      pokerTable.smallBlindPosition = (pokerTable.dealerPosition + 1) % activePlayers.length;
      pokerTable.bigBlindPosition = (pokerTable.dealerPosition + 2) % activePlayers.length;
      pokerTable.currentPlayerPosition = (pokerTable.bigBlindPosition + 1) % activePlayers.length;

      // Deal hole cards
      let cardIndex = 0;
      for (let round = 0; round < 2; round++) {
        for (const player of activePlayers) {
          if (!player.holeCards) player.holeCards = [];
          player.holeCards.push(shuffledDeck[cardIndex++]);
        }
      }

      // Post blinds
      const smallBlindPlayer = activePlayers[pokerTable.smallBlindPosition];
      const bigBlindPlayer = activePlayers[pokerTable.bigBlindPosition];

      const smallBlindAmount = Math.min(parseFloat(table.small_blind), smallBlindPlayer.chips);
      const bigBlindAmount = Math.min(parseFloat(table.big_blind), bigBlindPlayer.chips);

      smallBlindPlayer.chips -= smallBlindAmount;
      smallBlindPlayer.currentBet = smallBlindAmount;
      smallBlindPlayer.totalBetThisHand = smallBlindAmount;

      bigBlindPlayer.chips -= bigBlindAmount;
      bigBlindPlayer.currentBet = bigBlindAmount;
      bigBlindPlayer.totalBetThisHand = bigBlindAmount;

      pokerTable.pot = smallBlindAmount + bigBlindAmount;

    // Create new game if doesn't exist
    if (!pokerTable.gameId) {
      const gameResult = await executeQuery(`
        INSERT INTO poker_games (
          table_id, game_state, dealer_position, small_blind_position, 
          big_blind_position, current_player_position, pot_amount, 
          hand_number, current_bet, min_raise, betting_round
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tableId, 'dealing', pokerTable.dealerPosition, pokerTable.smallBlindPosition,
        pokerTable.bigBlindPosition, pokerTable.currentPlayerPosition, pokerTable.pot,
        pokerTable.handNumber, pokerTable.currentBet, pokerTable.minRaise, pokerTable.bettingRound
      ]);

      pokerTable.gameId = gameResult.insertId;
    }

    // Create new hand record
    const handResult = await executeQuery(`
      INSERT INTO poker_hands (
        game_id, table_id, hand_number, dealer_position, 
        small_blind, big_blind, total_pot, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      pokerTable.gameId,
      tableId,
      pokerTable.handNumber,
      pokerTable.dealerPosition,
      table.small_blind,
      table.big_blind,
      pokerTable.pot
    ]);      const handId = handResult.insertId;

      // Record blind actions (only for human players, skip AI players)
      const blindActions = [];
      
      if (smallBlindPlayer.userId > 0) {
        blindActions.push({
          query: `INSERT INTO poker_actions (
            hand_id, user_id, seat_position, action_type, amount, 
            betting_round, action_sequence, pot_size_before, 
            chips_before, chips_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            handId, smallBlindPlayer.userId, smallBlindPlayer.seatPosition,
            'blind', smallBlindAmount, 'pre_flop', 1, 0,
            smallBlindPlayer.chips + smallBlindAmount, smallBlindPlayer.chips
          ]
        });
      }
      
      if (bigBlindPlayer.userId > 0) {
        blindActions.push({
          query: `INSERT INTO poker_actions (
            hand_id, user_id, seat_position, action_type, amount, 
            betting_round, action_sequence, pot_size_before, 
            chips_before, chips_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            handId, bigBlindPlayer.userId, bigBlindPlayer.seatPosition,
            'blind', bigBlindAmount, 'pre_flop', blindActions.length === 0 ? 1 : 2, 
            blindActions.length === 0 ? 0 : smallBlindAmount,
            bigBlindPlayer.chips + bigBlindAmount, bigBlindPlayer.chips
          ]
        });
      }
      
      if (blindActions.length > 0) {
        await executeTransaction(blindActions);
      }

      // Save hole cards to database
      const holeCardUpdates = [];
      for (const player of activePlayers) {
        if (player.holeCards && player.holeCards.length === 2) {
          holeCardUpdates.push({
            query: 'UPDATE poker_seats SET hole_cards = ? WHERE table_id = ? AND user_id = ?',
            params: [JSON.stringify(player.holeCards), tableId, player.userId]
          });
        }
      }
      
      if (holeCardUpdates.length > 0) {
        await executeTransaction(holeCardUpdates);
        console.log(`🃏 Dealt hole cards to ${holeCardUpdates.length} players`);
      }

      // Update game state from 'dealing' to 'pre_flop'
      await executeQuery(`
        UPDATE poker_games 
        SET game_state = 'pre_flop' 
        WHERE id = ?
      `, [pokerTable.gameId]);

      // Send hand started event
      this.sendHandStarted(tableId, handId);
      this.sendTableState(tableId);

      pokerTable.handNumber++;
      
      console.log(`✅ Hand started at table ${tableId}, transitioned to pre_flop state`);

    } catch (error) {
      console.error('Error starting new hand:', error);
      this.io.to(`poker_table_${tableId}`).emit('poker:error', {
        message: 'Failed to start new hand'
      });
    }
  }

  /**
   * Handle player action
   */
  async handlePlayerAction(socket: Socket, data: {
    tableId: number;
    userId: number;
    action: string;
    amount?: number;
  }) {
    try {
      const { tableId, userId, action, amount = 0 } = data;
      
      const pokerTable = this.tables.get(tableId);
      if (!pokerTable) {
        socket.emit('poker:error', { message: 'Table not found' });
        return;
      }

      const player = pokerTable.players.get(userId);
      if (!player) {
        socket.emit('poker:error', { message: 'Player not at table' });
        return;
      }

      // Validate it's player's turn
      const currentPlayer = Array.from(pokerTable.players.values())
        .find(p => p.seatPosition === pokerTable.currentPlayerPosition);

      if (!currentPlayer || currentPlayer.userId !== userId) {
        socket.emit('poker:error', { message: 'Not your turn' });
        return;
      }

      // Validate action
      const validation = validatePlayerAction(
        player, 
        action, 
        amount, 
        pokerTable.currentBet,
        pokerTable.minRaise
      );

      if (!validation.valid) {
        socket.emit('poker:error', { message: validation.error });
        return;
      }

      // Process action
      await this.processPlayerAction(tableId, player, action, amount);

      // Check if betting round is complete
      const allPlayers = Array.from(pokerTable.players.values());
      if (isBettingRoundComplete(allPlayers, pokerTable.currentBet)) {
        await this.advanceBettingRound(tableId);
      } else {
        // Move to next player
        const nextPosition = getNextActivePlayer(allPlayers, pokerTable.currentPlayerPosition);
        if (nextPosition !== -1) {
          pokerTable.currentPlayerPosition = nextPosition;
          this.sendTableState(tableId);
        }
      }

    } catch (error) {
      console.error('Error handling player action:', error);
      socket.emit('poker:error', { message: 'Failed to process action' });
    }
  }

  /**
   * Process individual player action
   */
  private async processPlayerAction(tableId: number, player: PokerPlayer, action: string, amount: number) {
    const pokerTable = this.tables.get(tableId)!;
    
    switch (action) {
      case 'fold':
        player.isFolded = true;
        player.lastAction = 'fold';
        break;
        
      case 'check':
        player.lastAction = 'check';
        break;
        
      case 'call':
        const callAmount = pokerTable.currentBet - player.currentBet;
        const actualCall = Math.min(callAmount, player.chips);
        player.chips -= actualCall;
        player.currentBet += actualCall;
        player.totalBetThisHand += actualCall;
        pokerTable.pot += actualCall;
        player.lastAction = 'call';
        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;
        
      case 'bet':
      case 'raise':
        const betAmount = Math.min(amount, player.chips + player.currentBet);
        const additionalBet = betAmount - player.currentBet;
        player.chips -= additionalBet;
        pokerTable.pot += additionalBet;
        
        // Update raise tracking
        if (action === 'raise') {
          pokerTable.minRaise = betAmount - pokerTable.currentBet;
        }
        
        pokerTable.currentBet = betAmount;
        player.currentBet = betAmount;
        player.totalBetThisHand += additionalBet;
        player.lastAction = action;
        
        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;
        
      case 'all_in':
        const allInAmount = player.chips + player.currentBet;
        const additionalAllIn = player.chips;
        player.chips = 0;
        pokerTable.pot += additionalAllIn;
        player.totalBetThisHand += additionalAllIn;
        
        if (allInAmount > pokerTable.currentBet) {
          pokerTable.currentBet = allInAmount;
        }
        
        player.currentBet = allInAmount;
        player.isAllIn = true;
        player.lastAction = 'all_in';
        break;
    }

    // Broadcast action to all players
    this.io.to(`poker_table_${tableId}`).emit('poker:player_action', {
      userId: player.userId,
      action,
      amount,
      newChips: player.chips,
      newPot: pokerTable.pot,
      currentBet: pokerTable.currentBet
    });
  }

  /**
   * Advance to next betting round or showdown
   */
  private async advanceBettingRound(tableId: number) {
    const pokerTable = this.tables.get(tableId)!;
    const nextRound = getNextBettingRound(pokerTable.bettingRound);
    
    if (!nextRound) {
      // Go to showdown
      await this.handleShowdown(tableId);
      return;
    }
    
    // Reset betting for new round
    pokerTable.bettingRound = nextRound;
    pokerTable.currentBet = 0;
    pokerTable.minRaise = parseFloat((await executeQuery(
      'SELECT big_blind FROM poker_tables WHERE id = ?', 
      [tableId]
    ))[0].big_blind);
    
    // Reset player bets
    Array.from(pokerTable.players.values()).forEach(player => {
      player.currentBet = 0;
      player.lastAction = null;
    });
    
    // Deal community cards
    pokerTable.communityCards = dealCommunityCards(pokerTable.deck, nextRound);
    
    // Find first active player after dealer
    const activePlayers = Array.from(pokerTable.players.values())
      .filter(p => p.isActive && !p.isFolded && !p.isAllIn);
    
    if (activePlayers.length > 0) {
      pokerTable.currentPlayerPosition = activePlayers[0].seatPosition;
    }
    
    // Broadcast new round
    this.io.to(`poker_table_${tableId}`).emit('poker:new_round', {
      round: nextRound,
      communityCards: pokerTable.communityCards
    });
    
    this.sendTableState(tableId);
  }

  /**
   * Handle showdown and determine winners
   */
  private async handleShowdown(tableId: number) {
    const pokerTable = this.tables.get(tableId)!;
    const activePlayers = Array.from(pokerTable.players.values())
      .filter(p => p.isActive && !p.isFolded);

    if (activePlayers.length === 1) {
      // Only one player left, they win
      const winner = activePlayers[0];
      winner.chips += pokerTable.pot;
      
      this.io.to(`poker_table_${tableId}`).emit('poker:hand_complete', {
        winner: { userId: winner.userId, username: winner.username },
        winAmount: pokerTable.pot,
        winReason: 'All others folded'
      });
      
    } else {
      // Evaluate hands for showdown
      const handResults: Array<{ player: PokerPlayer; hand: HandResult }> = [];
      
      for (const player of activePlayers) {
        const allCards = [...player.holeCards, ...pokerTable.communityCards];
        const handResult = evaluateHand(allCards);
        handResults.push({ player, hand: handResult });
      }
      
      // Sort by hand strength (best first)
      handResults.sort((a, b) => compareHands(a.hand, b.hand));
      
      // Calculate side pots and distribute winnings
      const sidePots = calculateSidePots(activePlayers);
      this.distributeSidePots(sidePots, handResults);
      
      // Broadcast showdown results
      this.io.to(`poker_table_${tableId}`).emit('poker:showdown', {
        results: handResults.map(r => ({
          userId: r.player.userId,
          username: r.player.username,
          hand: r.hand,
          holeCards: r.player.holeCards
        }))
      });
    }

    // Reset for next hand
    this.resetTableForNextHand(tableId);
  }

  /**
   * Distribute side pots to winners
   */
  private distributeSidePots(sidePots: any[], handResults: any[]) {
    for (const pot of sidePots) {
      const eligibleResults = handResults.filter(r => 
        pot.eligiblePlayers.includes(r.player.userId)
      );
      
      if (eligibleResults.length > 0) {
        const winners = eligibleResults.filter(r => 
          compareHands(r.hand, eligibleResults[0].hand) === 0
        );
        
        const winAmount = pot.amount / winners.length;
        for (const winner of winners) {
          winner.player.chips += winAmount;
        }
      }
    }
  }

  /**
   * Reset table state for next hand
   */
  private resetTableForNextHand(tableId: number) {
    const pokerTable = this.tables.get(tableId)!;
    
    // Reset player states
    Array.from(pokerTable.players.values()).forEach(player => {
      player.holeCards = [];
      player.currentBet = 0;
      player.totalBetThisHand = 0;
      player.lastAction = null;
      player.isFolded = false;
      player.isAllIn = false;
    });
    
    // Reset table state
    pokerTable.communityCards = [];
    pokerTable.pot = 0;
    pokerTable.currentBet = 0;
    pokerTable.bettingRound = 'pre_flop';
    
    this.sendTableState(tableId);
  }

  /**
   * Send complete table state to all players
   */
  private async sendTableState(tableId: number) {
    try {
      // Get current table info from database
      const tableResult = await executeQuery(
        'SELECT * FROM poker_tables WHERE id = ? AND is_active = true',
        [tableId]
      );

      if (tableResult.length === 0) return;
      const table = tableResult[0];

      // Get all players currently at the table (including AI)
      const players = await executeQuery(`
        SELECT 
          ps.*,
          CASE 
            WHEN ps.user_id > 0 THEN u.username
            ELSE pai.name
          END as username,
          CASE 
            WHEN ps.user_id < 0 THEN pai.playing_style
            ELSE NULL
          END as playing_style,
          CASE 
            WHEN ps.user_id < 0 THEN pai.skill_level
            ELSE NULL
          END as skill_level,
          CASE 
            WHEN ps.user_id < 0 THEN true
            ELSE false
          END as isAI
        FROM poker_seats ps
        LEFT JOIN users u ON ps.user_id = u.id AND ps.user_id > 0
        LEFT JOIN poker_ai_players pai ON -ps.user_id = pai.id AND ps.user_id < 0
        WHERE ps.table_id = ? AND ps.is_active = true
        ORDER BY ps.seat_position ASC
      `, [tableId]);

      // Get current game state if exists
      const gameResult = await executeQuery(
        'SELECT * FROM poker_games WHERE table_id = ? AND game_state NOT IN ("finished") ORDER BY created_at DESC LIMIT 1',
        [tableId]
      );

      const currentGame = gameResult.length > 0 ? gameResult[0] : null;

      const tableState = {
        tableId,
        players: players.map((p: any) => ({
          userId: p.user_id,
          username: p.username,
          seatPosition: p.seat_position,
          chips: parseFloat(p.chips),
          currentBet: parseFloat(p.current_bet || 0),
          lastAction: p.last_action,
          isActive: !!p.is_active,
          isAllIn: !!p.is_all_in,
          isFolded: p.last_action === 'fold',
          isAI: !!p.isAI,
          playingStyle: p.playing_style,
          skillLevel: p.skill_level
        })),
        communityCards: currentGame?.community_cards ? JSON.parse(currentGame.community_cards) : [],
        pot: currentGame ? parseFloat(currentGame.pot_amount || 0) : 0,
        currentBet: currentGame ? parseFloat(currentGame.current_bet || 0) : 0,
        minRaise: currentGame ? parseFloat(currentGame.min_raise || table.big_blind) : parseFloat(table.big_blind),
        currentPlayerPosition: currentGame ? currentGame.current_player_position : 0,
        dealerPosition: currentGame ? currentGame.dealer_position : 0,
        bettingRound: currentGame ? currentGame.betting_round : 'pre_flop',
        handNumber: currentGame ? currentGame.hand_number : 1
      };

      console.log(`Sending table state for table ${tableId}:`, {
        playersCount: tableState.players.length,
        pot: tableState.pot
      });

      this.io.to(`poker_table_${tableId}`).emit('poker:table_state', tableState);
    } catch (error) {
      console.error('Error sending table state:', error);
    }
  }

  /**
   * Send hand started event
   */
  private sendHandStarted(tableId: number, handId: number) {
    this.io.to(`poker_table_${tableId}`).emit('poker:hand_started', {
      handId,
      message: 'New hand started!'
    });
  }

  /**
   * Check if we can start a hand and start it if possible
   */
  async checkAndStartHand(tableId: number) {
    try {
      // Get current game state to see if a hand is already in progress
      const gameResult = await executeQuery(
        'SELECT * FROM poker_games WHERE table_id = ? AND game_state IN ("active", "waiting") ORDER BY created_at DESC LIMIT 1',
        [tableId]
      );

      if (gameResult.length > 0) {
        console.log(`Table ${tableId} already has a game in progress`);
        return; // Game already in progress
      }

      // Check if we have enough players
      const dbPlayers = await executeQuery(`
        SELECT COUNT(*) as player_count
        FROM poker_seats ps
        WHERE ps.table_id = ? AND ps.is_active = true AND ps.chips > 0
      `, [tableId]);

      const playerCount = dbPlayers[0].player_count;
      console.log(`Table ${tableId} has ${playerCount} active players`);

      if (playerCount >= 2) {
        console.log(`Starting new hand for table ${tableId}`);
        await this.startNewHand(tableId);
      }
    } catch (error) {
      console.error('Error checking and starting hand:', error);
    }
  }

  /**
   * Public method to start a hand (can be called from routes)
   */
  async startHand(tableId: number) {
    return this.startNewHand(tableId);
  }

  /**
   * Handle socket disconnection
   */
  async handleDisconnect(socket: Socket) {
    try {
      const userId = socket.data?.user?.id;
      if (!userId) return;

      console.log(`Handling disconnect for user ${userId} (${socket.data?.user?.username})`);

      // Find and remove player from any tables
      Array.from(this.tables.entries()).forEach(([tableId, table]) => {
        Array.from(table.players.entries()).forEach(([playerId, player]) => {
          if (player.socketId === socket.id) {
            // Mark as sitting out but don't remove immediately
            player.isActive = false;
            this.io.to(`poker_table_${tableId}`).emit('poker:player_disconnected', {
              userId: playerId,
              username: player.username
            });
          }
        });
        
        // Remove from spectators
        table.spectators.delete(socket.id);
      });

      // Update database to mark player as inactive with a short delay
      // This gives them time to reconnect without losing their seat
      setTimeout(async () => {
        try {
          await executeQuery(
            'UPDATE poker_seats SET is_active = 0, left_at = NOW() WHERE user_id = ? AND is_active = 1 AND joined_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)',
            [userId]
          );
          console.log(`Cleaned up poker seats for disconnected user ${userId}`);
        } catch (error) {
          console.error('Error cleaning up poker seats on disconnect:', error);
        }
      }, 30000); // 30 second grace period for reconnection

    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  /**
   * Safely parse JSON data that might be string or already parsed object
   */
  private safeParseJSON(data: any, defaultValue: any = null): any {
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
}

export default PokerGameManager;