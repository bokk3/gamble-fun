/**
 * AI Poker Engine
 * Intelligent computer opponents with different playing styles and decision-making algorithms
 */

import { executeQuery, executeTransaction } from '../config/database';
import { 
  evaluateHand, 
  compareHands, 
  calculatePotOdds,
  validatePlayerAction,
  Card,
  Player,
  HandResult,
  HAND_RANKINGS
} from './pokerEngine';
import { ProvablyFairEngine } from './gameEngine';

export interface AIPlayer {
  id: number;
  name: string;
  avatar_url?: string;
  playing_style: 'tight_passive' | 'tight_aggressive' | 'loose_passive' | 'loose_aggressive' | 'maniac';
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'professional';
  aggression_level: number; // 0.5 = passive, 3.0+ = very aggressive
  bluff_frequency: number; // 0.15 = 15% bluff rate
  fold_to_pressure: number; // 0.70 = 70% fold rate under pressure
  bankroll: number;
  is_active: boolean;
}

export interface GameContext {
  tableId: number;
  gameId?: number;
  pot: number;
  currentBet: number;
  minRaise: number;
  communityCards: Card[];
  bettingRound: 'pre_flop' | 'flop' | 'turn' | 'river';
  players: Player[];
  smallBlind: number;
  bigBlind: number;
  dealerPosition: number;
  myPosition: number;
  activePlayers: number;
}

export interface AIDecision {
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';
  amount?: number;
  reasoning: string;
  confidence: number; // 0-1
}

/**
 * Main AI Poker Engine Class
 */
export class AIPokerEngine {
  
  /**
   * Get all active AI players
   */
  static async getActiveAIPlayers(): Promise<AIPlayer[]> {
    const aiPlayers = await executeQuery(
      'SELECT * FROM poker_ai_players WHERE is_active = true ORDER BY skill_level DESC'
    );
    return aiPlayers;
  }

  /**
   * Get AI player by ID
   */
  static async getAIPlayer(id: number): Promise<AIPlayer | null> {
    const result = await executeQuery(
      'SELECT * FROM poker_ai_players WHERE id = ? AND is_active = true',
      [id]
    );
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Add AI players to empty seats at a table
   */
  static async fillTableWithAI(tableId: number, targetPlayers: number = 6): Promise<void> {
    try {
      // Get current players at table
      const currentSeats = await executeQuery(
        'SELECT seat_position FROM poker_seats WHERE table_id = ? AND is_active = true',
        [tableId]
      );

      const occupiedSeats = currentSeats.map((seat: any) => seat.seat_position);
      const availableSeats = [];
      
      // Find available seats (0-7 for 8-max table)
      for (let i = 0; i < 8; i++) {
        if (!occupiedSeats.includes(i)) {
          availableSeats.push(i);
        }
      }

      const seatsToFill = Math.min(
        targetPlayers - currentSeats.length,
        availableSeats.length
      );

      if (seatsToFill <= 0) return;

      // Get table info for buy-in amounts
      const tableResult = await executeQuery(
        'SELECT * FROM poker_tables WHERE id = ?',
        [tableId]
      );

      if (tableResult.length === 0) return;
      const table = tableResult[0];

      // Get available AI players
      const aiPlayers = await this.getActiveAIPlayers();
      
      // Shuffle and select AI players
      const selectedAI = this.shuffleArray(aiPlayers).slice(0, seatsToFill);

      // Add AI players to table
      const queries = [];
      for (let i = 0; i < selectedAI.length; i++) {
        const ai = selectedAI[i];
        const seatPosition = availableSeats[i];
        const buyIn = this.calculateAIBuyIn(ai, table);

        queries.push({
          query: `INSERT INTO poker_seats (table_id, user_id, seat_position, chips, is_active) 
                  VALUES (?, ?, ?, ?, true)`,
          params: [tableId, -ai.id, seatPosition, buyIn] // Negative ID for AI players
        });
      }

      if (queries.length > 0) {
        await executeTransaction(queries);
        console.log(`Added ${queries.length} AI players to table ${tableId}`);
      }

    } catch (error) {
      console.error('Error filling table with AI:', error);
    }
  }

  /**
   * Calculate appropriate buy-in for AI player based on their bankroll and table stakes
   */
  private static calculateAIBuyIn(ai: AIPlayer, table: any): number {
    const minBuyIn = parseFloat(table.min_buy_in);
    const maxBuyIn = parseFloat(table.max_buy_in);
    
    // Conservative AI players buy in for less, aggressive players buy in for more
    let buyInMultiplier = 0.5; // Default to middle buy-in
    
    switch (ai.playing_style) {
      case 'tight_passive':
        buyInMultiplier = 0.3; // Minimum buy-in
        break;
      case 'tight_aggressive':
        buyInMultiplier = 0.6; // Slightly above minimum
        break;
      case 'loose_passive':
        buyInMultiplier = 0.4; // Below middle
        break;
      case 'loose_aggressive':
        buyInMultiplier = 0.8; // Above middle
        break;
      case 'maniac':
        buyInMultiplier = 1.0; // Maximum buy-in
        break;
    }

    const targetBuyIn = minBuyIn + (maxBuyIn - minBuyIn) * buyInMultiplier;
    return Math.min(targetBuyIn, ai.bankroll * 0.1); // Never risk more than 10% of bankroll
  }

  /**
   * Make AI decision based on game context and AI personality
   */
  static makeAIDecision(ai: AIPlayer, context: GameContext, holeCards: Card[]): AIDecision {
    try {
      // Evaluate hand strength
      const allCards = [...holeCards, ...context.communityCards];
      let handStrength = 0;
      let handRank = HAND_RANKINGS.HIGH_CARD;

      if (allCards.length >= 7) {
        const handResult = evaluateHand(allCards);
        handStrength = this.normalizeHandStrength(handResult);
        handRank = handResult.rank;
      } else {
        // Pre-flop or early streets - evaluate hole cards
        handStrength = this.evaluateHoleCards(holeCards);
      }

      // Calculate pot odds if there's a bet to call
      const player = context.players.find(p => p.userId === -ai.id);
      if (!player) {
        return { action: 'fold', reasoning: 'Player not found', confidence: 1.0 };
      }

      const amountToCall = context.currentBet - player.currentBet;
      const potOdds = amountToCall > 0 ? calculatePotOdds(context.pot, amountToCall) : Infinity;

      // Get position strength (early=0.2, middle=0.5, late=0.8, button=1.0)
      const positionStrength = this.calculatePositionStrength(
        context.myPosition, 
        context.dealerPosition, 
        context.activePlayers
      );

      // Calculate opponent aggression factor
      const opponentAggression = this.analyzeOpponentAggression(context);

      // Make decision based on AI personality and game situation
      return this.calculateBestAction(ai, {
        handStrength,
        handRank,
        potOdds,
        positionStrength,
        opponentAggression,
        context,
        player,
        amountToCall
      });

    } catch (error) {
      console.error('Error making AI decision:', error);
      return { action: 'fold', reasoning: 'Error in decision making', confidence: 0.5 };
    }
  }

  /**
   * Calculate the best action based on AI personality and game factors
   */
  private static calculateBestAction(ai: AIPlayer, factors: any): AIDecision {
    const { handStrength, handRank, potOdds, positionStrength, context, player, amountToCall } = factors;
    
    // Base thresholds adjusted by AI personality
    let foldThreshold = 0.2;
    let callThreshold = 0.4;
    let betThreshold = 0.6;
    let raiseThreshold = 0.7;
    let bluffThreshold = 0.3;

    // Adjust thresholds based on playing style
    switch (ai.playing_style) {
      case 'tight_passive':
        foldThreshold = 0.3;
        callThreshold = 0.6;
        betThreshold = 0.8;
        raiseThreshold = 0.9;
        bluffThreshold = 0.1;
        break;
      case 'tight_aggressive':
        foldThreshold = 0.25;
        callThreshold = 0.5;
        betThreshold = 0.65;
        raiseThreshold = 0.75;
        bluffThreshold = 0.2;
        break;
      case 'loose_passive':
        foldThreshold = 0.1;
        callThreshold = 0.3;
        betThreshold = 0.7;
        raiseThreshold = 0.85;
        bluffThreshold = 0.05;
        break;
      case 'loose_aggressive':
        foldThreshold = 0.15;
        callThreshold = 0.35;
        betThreshold = 0.5;
        raiseThreshold = 0.6;
        bluffThreshold = 0.4;
        break;
      case 'maniac':
        foldThreshold = 0.05;
        callThreshold = 0.2;
        betThreshold = 0.3;
        raiseThreshold = 0.4;
        bluffThreshold = 0.6;
        break;
    }

    // Adjust for position
    const positionAdjustment = (positionStrength - 0.5) * 0.1;
    foldThreshold -= positionAdjustment;
    callThreshold -= positionAdjustment;
    betThreshold -= positionAdjustment;

    // Adjust for skill level
    const skillAdjustment = this.getSkillAdjustment(ai.skill_level);
    foldThreshold += skillAdjustment.fold;
    callThreshold += skillAdjustment.call;
    betThreshold += skillAdjustment.bet;
    raiseThreshold += skillAdjustment.raise;

    // Check for bluff opportunity
    const shouldBluff = Math.random() < ai.bluff_frequency && 
                       handStrength < bluffThreshold && 
                       positionStrength > 0.6;

    // Decision logic
    if (amountToCall === 0) {
      // No bet to call - can check or bet
      if (shouldBluff || handStrength > betThreshold) {
        const betAmount = this.calculateBetSize(ai, context, handStrength, shouldBluff);
        return {
          action: 'bet',
          amount: betAmount,
          reasoning: shouldBluff ? 'Bluffing from good position' : 'Betting for value',
          confidence: shouldBluff ? 0.3 : handStrength
        };
      } else {
        return {
          action: 'check',
          reasoning: 'Checking with marginal hand',
          confidence: 0.6
        };
      }
    } else {
      // There's a bet to call
      if (handStrength < foldThreshold && !shouldBluff) {
        return {
          action: 'fold',
          reasoning: 'Hand too weak to continue',
          confidence: 0.8
        };
      } else if (handStrength < callThreshold && potOdds < 3) {
        return {
          action: 'fold',
          reasoning: 'Poor pot odds',
          confidence: 0.7
        };
      } else if (shouldBluff || handStrength > raiseThreshold) {
        const raiseAmount = this.calculateRaiseSize(ai, context, handStrength, shouldBluff);
        return {
          action: 'raise',
          amount: raiseAmount,
          reasoning: shouldBluff ? 'Bluff raise' : 'Raising for value',
          confidence: shouldBluff ? 0.4 : handStrength
        };
      } else {
        return {
          action: 'call',
          reasoning: 'Calling with decent hand',
          confidence: handStrength
        };
      }
    }
  }

  /**
   * Calculate bet size based on AI aggression and hand strength
   */
  private static calculateBetSize(ai: AIPlayer, context: GameContext, handStrength: number, isBluff: boolean): number {
    const potSize = context.pot;
    let betSize = 0;

    if (isBluff) {
      // Bluff sizing - usually 40-80% of pot
      betSize = potSize * (0.4 + Math.random() * 0.4);
    } else {
      // Value betting - size based on hand strength
      const sizingFactor = 0.3 + (handStrength * 0.7); // 30-100% of pot
      betSize = potSize * sizingFactor;
    }

    // Adjust for aggression level
    betSize *= ai.aggression_level;

    // Ensure minimum bet is big blind
    betSize = Math.max(betSize, context.bigBlind);

    // Don't bet more than we have
    const player = context.players.find(p => p.userId === -ai.id);
    if (player) {
      betSize = Math.min(betSize, player.chips);
    }

    return Math.round(betSize * 100) / 100; // Round to cents
  }

  /**
   * Calculate raise size based on AI personality
   */
  private static calculateRaiseSize(ai: AIPlayer, context: GameContext, handStrength: number, isBluff: boolean): number {
    const minRaise = context.minRaise;
    const potSize = context.pot;
    let raiseSize = minRaise;

    if (isBluff) {
      // Bluff raises are usually smaller
      raiseSize = minRaise + (potSize * 0.3);
    } else {
      // Value raises based on hand strength
      const sizingFactor = 0.5 + (handStrength * 0.5); // 50-100% of pot above current bet
      raiseSize = minRaise + (potSize * sizingFactor);
    }

    // Adjust for aggression
    raiseSize *= ai.aggression_level;

    // Don't raise more than we have
    const player = context.players.find(p => p.userId === -ai.id);
    if (player) {
      raiseSize = Math.min(raiseSize, player.chips + player.currentBet);
    }

    return Math.round(raiseSize * 100) / 100;
  }

  /**
   * Evaluate hole cards strength (pre-flop)
   */
  private static evaluateHoleCards(holeCards: Card[]): number {
    if (holeCards.length !== 2) return 0;

    const [card1, card2] = holeCards;
    const rank1 = card1.rank;
    const rank2 = card2.rank;
    const suited = card1.suit === card2.suit;
    const paired = rank1 === rank2;
    
    // Pocket pairs
    if (paired) {
      if (rank1 >= 14) return 0.95; // AA
      if (rank1 >= 13) return 0.90; // KK
      if (rank1 >= 12) return 0.85; // QQ
      if (rank1 >= 11) return 0.80; // JJ
      if (rank1 >= 10) return 0.75; // TT
      if (rank1 >= 8) return 0.65; // 88-99
      if (rank1 >= 6) return 0.55; // 66-77
      return 0.4; // 22-55
    }

    // High cards
    const highRank = Math.max(rank1, rank2);
    const lowRank = Math.min(rank1, rank2);
    const gap = highRank - lowRank;

    let strength = 0;

    // Ace high hands
    if (highRank === 14) {
      if (lowRank >= 13) strength = 0.85; // AK
      else if (lowRank >= 12) strength = 0.75; // AQ
      else if (lowRank >= 11) strength = 0.70; // AJ
      else if (lowRank >= 10) strength = 0.65; // AT
      else if (lowRank >= 9) strength = 0.55; // A9
      else strength = 0.45; // A8 and below
    }
    // King high hands
    else if (highRank === 13) {
      if (lowRank >= 12) strength = 0.70; // KQ
      else if (lowRank >= 11) strength = 0.65; // KJ
      else if (lowRank >= 10) strength = 0.60; // KT
      else strength = 0.45;
    }
    // Queen high hands
    else if (highRank === 12) {
      if (lowRank >= 11) strength = 0.60; // QJ
      else if (lowRank >= 10) strength = 0.55; // QT
      else strength = 0.40;
    }
    // Jack high hands
    else if (highRank === 11) {
      if (lowRank >= 10) strength = 0.50; // JT
      else strength = 0.35;
    }
    // Other hands
    else {
      strength = 0.25;
    }

    // Suited bonus
    if (suited) {
      strength += 0.05;
    }

    // Connected bonus
    if (gap === 1) {
      strength += 0.03; // Connectors
    } else if (gap === 2) {
      strength += 0.01; // One gap
    }

    return Math.min(strength, 1.0);
  }

  /**
   * Normalize hand strength from HandResult to 0-1 scale
   */
  private static normalizeHandStrength(handResult: HandResult): number {
    const rankStrengths = {
      [HAND_RANKINGS.ROYAL_FLUSH]: 0.999,
      [HAND_RANKINGS.STRAIGHT_FLUSH]: 0.95,
      [HAND_RANKINGS.FOUR_OF_A_KIND]: 0.9,
      [HAND_RANKINGS.FULL_HOUSE]: 0.85,
      [HAND_RANKINGS.FLUSH]: 0.75,
      [HAND_RANKINGS.STRAIGHT]: 0.65,
      [HAND_RANKINGS.THREE_OF_A_KIND]: 0.55,
      [HAND_RANKINGS.TWO_PAIR]: 0.45,
      [HAND_RANKINGS.PAIR]: 0.35,
      [HAND_RANKINGS.HIGH_CARD]: 0.2
    };

    const baseStrength = rankStrengths[handResult.rank] || 0.2;
    
    // Add small bonus based on kickers/strength within rank
    const kickerBonus = Math.min(handResult.strength / 100000, 0.05);
    
    return Math.min(baseStrength + kickerBonus, 1.0);
  }

  /**
   * Calculate position strength (0-1, where 1 is button)
   */
  private static calculatePositionStrength(myPosition: number, dealerPosition: number, activePlayers: number): number {
    const positionsFromDealer = (myPosition - dealerPosition + activePlayers) % activePlayers;
    
    if (positionsFromDealer === 0) return 1.0; // Button - best position
    if (positionsFromDealer === activePlayers - 1) return 0.9; // Cutoff
    if (positionsFromDealer === activePlayers - 2) return 0.8; // Hijack
    if (positionsFromDealer <= 2) return 0.2; // Early position
    return 0.5; // Middle position
  }

  /**
   * Analyze opponent aggression from recent actions
   */
  private static analyzeOpponentAggression(context: GameContext): number {
    // Simple implementation - in real system would track historical data
    const aggressiveActions = context.players.filter(p => 
      p.lastAction === 'bet' || p.lastAction === 'raise'
    ).length;
    
    return aggressiveActions / Math.max(context.activePlayers - 1, 1);
  }

  /**
   * Get skill-based adjustments to decision thresholds
   */
  private static getSkillAdjustment(skillLevel: string) {
    switch (skillLevel) {
      case 'beginner':
        return { fold: -0.05, call: 0.1, bet: 0.05, raise: 0.1 }; // More loose-passive
      case 'intermediate':
        return { fold: 0, call: 0.05, bet: 0, raise: 0.05 };
      case 'advanced':
        return { fold: 0.02, call: 0, bet: -0.02, raise: 0 }; // More selective
      case 'expert':
        return { fold: 0.03, call: -0.05, bet: -0.03, raise: -0.05 }; // Tighter, more aggressive
      case 'professional':
        return { fold: 0.05, call: -0.1, bet: -0.05, raise: -0.1 }; // Very tight-aggressive
      default:
        return { fold: 0, call: 0, bet: 0, raise: 0 };
    }
  }

  /**
   * Utility function to shuffle array
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Update AI player bankroll after game
   */
  static async updateAIBankroll(aiId: number, changeAmount: number): Promise<void> {
    try {
      await executeQuery(
        'UPDATE poker_ai_players SET bankroll = bankroll + ? WHERE id = ?',
        [changeAmount, aiId]
      );
    } catch (error) {
      console.error('Error updating AI bankroll:', error);
    }
  }

  /**
   * Remove AI player from table
   */
  static async removeAIFromTable(tableId: number, aiId: number): Promise<void> {
    try {
      await executeQuery(
        'UPDATE poker_seats SET is_active = false, left_at = NOW() WHERE table_id = ? AND user_id = ?',
        [tableId, -aiId]
      );
    } catch (error) {
      console.error('Error removing AI from table:', error);
    }
  }
}

export default AIPokerEngine;