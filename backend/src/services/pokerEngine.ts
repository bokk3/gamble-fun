/**
 * Comprehensive Poker Game Engine
 * Texas Hold'em implementation with hand evaluation, pot calculation, and game logic
 */

import { Request, Response } from 'express';
import { executeQuery, executeTransaction } from '../config/database';
import { ProvablyFairEngine } from './gameEngine';

// Card and hand type definitions
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: number; // 2-14 (14 = Ace)
  display: string; // '2♠', 'K♥', 'A♦', etc.
}

export interface HandResult {
  rank: number; // 1=Royal Flush, 2=Straight Flush, etc.
  name: string;
  cards: Card[];
  kickers: number[];
  strength: number; // For comparing hands of same rank
}

export interface Player {
  userId: number;
  seatPosition: number;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalBetThisHand: number;
  lastAction: string | null;
  isActive: boolean;
  isAllIn: boolean;
  isFolded: boolean;
}

export interface PokerGame {
  id: number;
  tableId: number;
  gameState: string;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
  currentPlayerPosition: number;
  potAmount: number;
  communityCards: Card[];
  players: Player[];
  deck: Card[];
  currentBet: number;
  minRaise: number;
  bettingRound: string;
}

// Hand ranking constants
export const HAND_RANKINGS = {
  ROYAL_FLUSH: 1,
  STRAIGHT_FLUSH: 2,
  FOUR_OF_A_KIND: 3,
  FULL_HOUSE: 4,
  FLUSH: 5,
  STRAIGHT: 6,
  THREE_OF_A_KIND: 7,
  TWO_PAIR: 8,
  PAIR: 9,
  HIGH_CARD: 10
};

/**
 * Create a standard 52-card deck
 */
export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J, 12=Q, 13=K, 14=A
  const rankNames = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };

  const deck: Card[] = [];
  
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        suit,
        rank,
        display: `${rankNames[rank as keyof typeof rankNames]}${suitSymbols[suit]}`
      });
    });
  });

  return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm with provably fair seed
 */
export function shuffleDeck(deck: Card[], serverSeed: string, clientSeed: string, nonce: number): Card[] {
  const shuffledDeck = [...deck];
  
  for (let i = shuffledDeck.length - 1; i > 0; i--) {
    const hash = ProvablyFairEngine.generateHash(serverSeed, clientSeed, nonce + i);
    const randomFloat = ProvablyFairEngine.hashToFloat(hash);
    const j = Math.floor(randomFloat * (i + 1));
    [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
  }
  
  return shuffledDeck;
}

/**
 * Evaluate poker hand strength - returns hand rank and description
 */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length !== 7) {
    throw new Error('Hand evaluation requires exactly 7 cards (2 hole cards + 5 community cards)');
  }

  // Sort cards by rank (highest first)
  const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
  
  // Group cards by rank and suit
  const rankCounts: { [key: number]: number } = {};
  const suitCounts: { [key: string]: Card[] } = {};
  
  sortedCards.forEach(card => {
    rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    if (!suitCounts[card.suit]) suitCounts[card.suit] = [];
    suitCounts[card.suit].push(card);
  });

  // Check for flush
  const flushSuit = Object.keys(suitCounts).find(suit => suitCounts[suit].length >= 5);
  const isFlush = !!flushSuit;
  const flushCards = isFlush ? suitCounts[flushSuit!].slice(0, 5) : [];

  // Check for straight
  const straightResult = findStraight(sortedCards);
  const isStraight = straightResult.length > 0;

  // Get rank groups (pairs, trips, quads)
  const rankGroups = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: parseInt(rank), count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count; // Sort by count first
      return b.rank - a.rank; // Then by rank
    });

  // Evaluate hand type
  if (isFlush && isStraight) {
    const straightFlushCards = findStraightInSuit(suitCounts[flushSuit!]);
    if (straightFlushCards.length > 0) {
      const highCard = Math.max(...straightFlushCards.map(c => c.rank));
      if (highCard === 14 && straightFlushCards.some(c => c.rank === 10)) {
        return {
          rank: HAND_RANKINGS.ROYAL_FLUSH,
          name: 'Royal Flush',
          cards: straightFlushCards,
          kickers: [],
          strength: 0 // Royal flush has no kickers
        };
      } else {
        return {
          rank: HAND_RANKINGS.STRAIGHT_FLUSH,
          name: 'Straight Flush',
          cards: straightFlushCards,
          kickers: [highCard],
          strength: highCard
        };
      }
    }
  }

  // Four of a kind
  if (rankGroups[0].count === 4) {
    const quadRank = rankGroups[0].rank;
    const kicker = rankGroups[1].rank;
    const quadCards = sortedCards.filter(c => c.rank === quadRank);
    const kickerCard = sortedCards.find(c => c.rank === kicker);
    
    return {
      rank: HAND_RANKINGS.FOUR_OF_A_KIND,
      name: 'Four of a Kind',
      cards: [...quadCards, kickerCard!],
      kickers: [quadRank, kicker],
      strength: quadRank * 1000 + kicker
    };
  }

  // Full house
  if (rankGroups[0].count === 3 && rankGroups[1].count >= 2) {
    const tripRank = rankGroups[0].rank;
    const pairRank = rankGroups[1].count === 3 ? Math.max(rankGroups[1].rank, rankGroups[2]?.rank || 0) : rankGroups[1].rank;
    const tripCards = sortedCards.filter(c => c.rank === tripRank);
    const pairCards = sortedCards.filter(c => c.rank === pairRank).slice(0, 2);
    
    return {
      rank: HAND_RANKINGS.FULL_HOUSE,
      name: 'Full House',
      cards: [...tripCards, ...pairCards],
      kickers: [tripRank, pairRank],
      strength: tripRank * 1000 + pairRank
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: HAND_RANKINGS.FLUSH,
      name: 'Flush',
      cards: flushCards,
      kickers: flushCards.map(c => c.rank),
      strength: flushCards.reduce((sum, card, index) => sum + card.rank * Math.pow(100, 4 - index), 0)
    };
  }

  // Straight
  if (isStraight) {
    const highCard = Math.max(...straightResult.map(c => c.rank));
    return {
      rank: HAND_RANKINGS.STRAIGHT,
      name: 'Straight',
      cards: straightResult,
      kickers: [highCard],
      strength: highCard
    };
  }

  // Three of a kind
  if (rankGroups[0].count === 3) {
    const tripRank = rankGroups[0].rank;
    const tripCards = sortedCards.filter(c => c.rank === tripRank);
    const kickers = rankGroups.slice(1, 3).map(g => g.rank);
    const kickerCards = kickers.map(rank => sortedCards.find(c => c.rank === rank)!);
    
    return {
      rank: HAND_RANKINGS.THREE_OF_A_KIND,
      name: 'Three of a Kind',
      cards: [...tripCards, ...kickerCards],
      kickers: [tripRank, ...kickers],
      strength: tripRank * 10000 + kickers[0] * 100 + kickers[1]
    };
  }

  // Two pair
  if (rankGroups[0].count === 2 && rankGroups[1].count === 2) {
    const highPair = rankGroups[0].rank;
    const lowPair = rankGroups[1].rank;
    const kicker = rankGroups[2].rank;
    const highPairCards = sortedCards.filter(c => c.rank === highPair);
    const lowPairCards = sortedCards.filter(c => c.rank === lowPair);
    const kickerCard = sortedCards.find(c => c.rank === kicker)!;
    
    return {
      rank: HAND_RANKINGS.TWO_PAIR,
      name: 'Two Pair',
      cards: [...highPairCards, ...lowPairCards, kickerCard],
      kickers: [highPair, lowPair, kicker],
      strength: highPair * 10000 + lowPair * 100 + kicker
    };
  }

  // One pair
  if (rankGroups[0].count === 2) {
    const pairRank = rankGroups[0].rank;
    const pairCards = sortedCards.filter(c => c.rank === pairRank);
    const kickers = rankGroups.slice(1, 4).map(g => g.rank);
    const kickerCards = kickers.map(rank => sortedCards.find(c => c.rank === rank)!);
    
    return {
      rank: HAND_RANKINGS.PAIR,
      name: 'Pair',
      cards: [...pairCards, ...kickerCards],
      kickers: [pairRank, ...kickers],
      strength: pairRank * 1000000 + kickers.reduce((sum, k, i) => sum + k * Math.pow(100, 2 - i), 0)
    };
  }

  // High card
  const topFive = sortedCards.slice(0, 5);
  const kickers = topFive.map(c => c.rank);
  
  return {
    rank: HAND_RANKINGS.HIGH_CARD,
    name: 'High Card',
    cards: topFive,
    kickers,
    strength: kickers.reduce((sum, k, i) => sum + k * Math.pow(100, 4 - i), 0)
  };
}

/**
 * Find straight in cards
 */
function findStraight(sortedCards: Card[]): Card[] {
  const uniqueRanks = Array.from(new Set(sortedCards.map(c => c.rank))).sort((a, b) => b - a);
  
  // Check for regular straight
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
      return uniqueRanks.slice(i, i + 5).map(rank => 
        sortedCards.find(c => c.rank === rank)!
      );
    }
  }
  
  // Check for A-2-3-4-5 straight (wheel)
  if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && 
      uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
    return [5, 4, 3, 2, 14].map(rank => 
      sortedCards.find(c => c.rank === rank)!
    );
  }
  
  return [];
}

/**
 * Find straight flush in specific suit
 */
function findStraightInSuit(suitCards: Card[]): Card[] {
  if (suitCards.length < 5) return [];
  
  const sortedSuitCards = suitCards.sort((a, b) => b.rank - a.rank);
  return findStraight(sortedSuitCards);
}

/**
 * Compare two hands to determine winner
 */
export function compareHands(hand1: HandResult, hand2: HandResult): number {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank < hand2.rank ? 1 : -1; // Lower rank number wins
  }
  
  // Same hand type, compare strength
  if (hand1.strength !== hand2.strength) {
    return hand1.strength > hand2.strength ? 1 : -1;
  }
  
  return 0; // Tie
}

/**
 * Calculate pot odds for a player
 */
export function calculatePotOdds(potSize: number, betToCall: number): number {
  if (betToCall === 0) return Infinity;
  return potSize / betToCall;
}

/**
 * Calculate side pots for all-in situations
 */
export function calculateSidePots(players: Player[]): Array<{amount: number, eligiblePlayers: number[]}> {
  const sidePots: Array<{amount: number, eligiblePlayers: number[]}> = [];
  const activePlayers = players.filter(p => p.totalBetThisHand > 0 && !p.isFolded);
  
  if (activePlayers.length === 0) return sidePots;
  
  // Sort players by total bet amount
  const sortedPlayers = [...activePlayers].sort((a, b) => a.totalBetThisHand - b.totalBetThisHand);
  
  let previousBetLevel = 0;
  
  for (let i = 0; i < sortedPlayers.length; i++) {
    const currentBetLevel = sortedPlayers[i].totalBetThisHand;
    const betLevelDiff = currentBetLevel - previousBetLevel;
    
    if (betLevelDiff > 0) {
      const eligiblePlayers = sortedPlayers.slice(i).map(p => p.userId);
      const potAmount = betLevelDiff * eligiblePlayers.length;
      
      sidePots.push({
        amount: potAmount,
        eligiblePlayers
      });
    }
    
    previousBetLevel = currentBetLevel;
  }
  
  return sidePots;
}

/**
 * Get next active player position
 */
export function getNextActivePlayer(players: Player[], currentPosition: number): number {
  const activePlayers = players.filter(p => p.isActive && !p.isFolded && !p.isAllIn);
  
  if (activePlayers.length === 0) return -1;
  
  let nextPosition = (currentPosition + 1) % players.length;
  let attempts = 0;
  
  while (attempts < players.length) {
    const player = players.find(p => p.seatPosition === nextPosition);
    if (player && player.isActive && !player.isFolded && !player.isAllIn) {
      return nextPosition;
    }
    nextPosition = (nextPosition + 1) % players.length;
    attempts++;
  }
  
  return -1; // No active players found
}

/**
 * Check if betting round is complete
 */
export function isBettingRoundComplete(players: Player[], currentBet: number): boolean {
  const activePlayers = players.filter(p => p.isActive && !p.isFolded);
  
  if (activePlayers.length <= 1) return true;
  
  // All players must have either folded, gone all-in, or matched the current bet
  return activePlayers.every(player => 
    player.isAllIn || player.currentBet === currentBet || player.isFolded
  );
}

/**
 * Advance to next betting round
 */
export function getNextBettingRound(currentRound: string): string | null {
  const rounds = ['pre_flop', 'flop', 'turn', 'river'];
  const currentIndex = rounds.indexOf(currentRound);
  
  if (currentIndex === -1 || currentIndex === rounds.length - 1) {
    return null; // End of betting rounds
  }
  
  return rounds[currentIndex + 1];
}

/**
 * Deal community cards for specific betting round
 */
export function dealCommunityCards(deck: Card[], currentRound: string): Card[] {
  switch (currentRound) {
    case 'flop':
      return deck.slice(0, 3); // First 3 cards
    case 'turn':
      return deck.slice(0, 4); // First 4 cards
    case 'river':
      return deck.slice(0, 5); // All 5 cards
    default:
      return [];
  }
}

/**
 * Calculate minimum raise amount
 */
export function calculateMinRaise(currentBet: number, lastRaiseAmount: number, bigBlind: number): number {
  if (currentBet === 0) {
    return bigBlind; // First bet must be at least big blind
  }
  
  return currentBet + Math.max(lastRaiseAmount, bigBlind);
}

/**
 * Validate player action
 */
export function validatePlayerAction(
  player: Player, 
  action: string, 
  amount: number, 
  currentBet: number, 
  minRaise: number
): { valid: boolean; error?: string } {
  
  if (!player.isActive || player.isFolded) {
    return { valid: false, error: 'Player is not active' };
  }
  
  switch (action) {
    case 'fold':
      return { valid: true };
      
    case 'check':
      if (currentBet > player.currentBet) {
        return { valid: false, error: 'Cannot check when there is a bet to call' };
      }
      return { valid: true };
      
    case 'call':
      const callAmount = currentBet - player.currentBet;
      if (callAmount === 0) {
        return { valid: false, error: 'No bet to call' };
      }
      if (callAmount > player.chips) {
        return { valid: false, error: 'Insufficient chips to call' };
      }
      return { valid: true };
      
    case 'bet':
      if (currentBet > 0) {
        return { valid: false, error: 'Cannot bet when there is already a bet' };
      }
      if (amount > player.chips) {
        return { valid: false, error: 'Insufficient chips to bet' };
      }
      return { valid: true };
      
    case 'raise':
      if (currentBet === 0) {
        return { valid: false, error: 'Cannot raise when there is no bet' };
      }
      if (amount < minRaise) {
        return { valid: false, error: `Raise must be at least ${minRaise}` };
      }
      if (amount > player.chips + player.currentBet) {
        return { valid: false, error: 'Insufficient chips to raise' };
      }
      return { valid: true };
      
    case 'all_in':
      if (player.chips === 0) {
        return { valid: false, error: 'No chips to go all-in' };
      }
      return { valid: true };
      
    default:
      return { valid: false, error: 'Invalid action' };
  }
}

export default {
  createDeck,
  shuffleDeck,
  evaluateHand,
  compareHands,
  calculatePotOdds,
  calculateSidePots,
  getNextActivePlayer,
  isBettingRoundComplete,
  getNextBettingRound,
  dealCommunityCards,
  calculateMinRaise,
  validatePlayerAction,
  HAND_RANKINGS
};