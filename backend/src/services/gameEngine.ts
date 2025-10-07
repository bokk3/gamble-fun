const crypto = require('crypto');

export interface GameResult {
  result: any;
  hash: string;
  isWin: boolean;
  multiplier: number;
  winAmount: number;
}

export class ProvablyFairEngine {
  static generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateClientSeed(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static generateHash(serverSeed: string, clientSeed: string, nonce: number): string {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  static hashToFloat(hash: string): number {
    // Convert first 8 characters of hash to float between 0 and 1
    const hex = hash.substring(0, 8);
    const num = parseInt(hex, 16);
    return num / 0xffffffff;
  }

  static playSlots(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    
    // Fortune Teller themed symbols with weighted selection
    const symbols = ['🔮', '🪬', '🃏', '🧿', '🦉', '⭐', '🌙', '👑', '💎', '💰', '🌟', '🎭', '🎲', 'WILD'];
    const weights = {
      '🔮': 1,  // Epic - rarest
      '🪬': 2,
      '🃏': 2,
      '🧿': 4,  // Rare
      '🦉': 4,
      '⭐': 5,
      '🌙': 6,
      '👑': 8,  // Common high
      '💎': 10,
      '💰': 12,
      '🌟': 15, // Common
      '🎭': 18,
      '🎲': 20,
      'WILD': 3 // Special
    };

    // Create weighted symbol array
    const weightedSymbols: string[] = [];
    Object.entries(weights).forEach(([symbol, weight]) => {
      for (let i = 0; i < weight; i++) {
        weightedSymbols.push(symbol);
      }
    });

    // Generate 5x3 grid using hash-based randomness
    const reels: string[][] = [];
    for (let col = 0; col < 5; col++) {
      const reel: string[] = [];
      for (let row = 0; row < 3; row++) {
        const hashIndex = (col * 3 + row) * 8;
        const random = this.hashToFloat(hash.substring(hashIndex % 56, (hashIndex + 8) % 64));
        const symbolIndex = Math.floor(random * weightedSymbols.length);
        reel.push(weightedSymbols[symbolIndex]);
      }
      reels.push(reel);
    }

    // Define 20 paylines (same as frontend)
    const paylines = [
      [[1,0],[1,1],[1,2],[1,3],[1,4]], // Middle row
      [[0,0],[0,1],[0,2],[0,3],[0,4]], // Top row
      [[2,0],[2,1],[2,2],[2,3],[2,4]], // Bottom row
      [[0,0],[1,1],[2,2],[1,3],[0,4]], // V shape
      [[2,0],[1,1],[0,2],[1,3],[2,4]], // ^ shape
      [[0,0],[0,1],[1,2],[2,3],[2,4]], // Diagonal down
      [[2,0],[2,1],[1,2],[0,3],[0,4]], // Diagonal up
      [[1,0],[0,1],[0,2],[0,3],[1,4]], // Dip down
      [[1,0],[2,1],[2,2],[2,3],[1,4]], // Dip up
      [[0,0],[1,1],[0,2],[1,3],[0,4]], // Zigzag down
      [[2,0],[1,1],[2,2],[1,3],[2,4]], // Zigzag up
      [[1,0],[1,1],[0,2],[1,3],[1,4]], // Middle dip down
      [[1,0],[1,1],[2,2],[1,3],[1,4]], // Middle dip up
      [[0,0],[0,1],[0,2],[1,3],[2,4]], // L shape
      [[2,0],[2,1],[2,2],[1,3],[0,4]], // L shape inverted
      [[0,0],[1,1],[1,2],[1,3],[0,4]], // Arch
      [[2,0],[1,1],[1,2],[1,3],[2,4]], // Arch inverted
      [[1,0],[0,1],[1,2],[0,3],[1,4]], // W shape
      [[1,0],[2,1],[1,2],[2,3],[1,4]], // W shape inverted
      [[0,0],[2,1],[0,2],[2,3],[0,4]]  // Lightning
    ];

    // Symbol multipliers (same as frontend)
    const getSymbolMultiplier = (symbol: string, count: number): number => {
      const multipliers: { [key: string]: number[] } = {
        '🔮': [0, 0, 50, 200, 1000], // Epic
        '🪬': [0, 0, 25, 100, 500],
        '🃏': [0, 0, 20, 80, 400],
        '🧿': [0, 0, 15, 60, 300], // Rare
        '🦉': [0, 0, 12, 50, 250],
        '⭐': [0, 0, 10, 40, 200],
        '🌙': [0, 0, 8, 35, 150],
        '👑': [0, 0, 6, 25, 100], // Common high
        '💎': [0, 0, 5, 20, 80],
        '💰': [0, 0, 4, 15, 60],
        '🌟': [0, 0, 3, 12, 50], // Common
        '🎭': [0, 0, 2, 10, 40],
        '🎲': [0, 0, 2, 8, 30]
      };
      return multipliers[symbol]?.[count] || 0;
    };

    // Calculate wins on all paylines
    const wins: any[] = [];
    let totalWinAmount = 0;

    paylines.forEach((line, lineIndex) => {
      const lineSymbols = line.map(([row, col]) => reels[col][row]);
      const cleanSymbols = lineSymbols.map(symbol => symbol === 'WILD' ? 'WILD' : symbol);
      
      // Count consecutive matching symbols from left
      let matchCount = 1;
      let matchSymbol = cleanSymbols[0];
      
      for (let i = 1; i < cleanSymbols.length; i++) {
        if (cleanSymbols[i] === matchSymbol || cleanSymbols[i] === 'WILD' || matchSymbol === 'WILD') {
          if (matchSymbol === 'WILD' && cleanSymbols[i] !== 'WILD') {
            matchSymbol = cleanSymbols[i];
          }
          matchCount++;
        } else {
          break;
        }
      }
      
      // Check if we have a winning combination (3+ symbols)
      if (matchCount >= 3 && matchSymbol !== 'WILD') {
        const baseMultiplier = getSymbolMultiplier(matchSymbol, matchCount);
        const wildCount = lineSymbols.slice(0, matchCount).filter(s => s === 'WILD').length;
        const finalMultiplier = baseMultiplier * Math.pow(2, wildCount); // Wild doubles the win
        const winAmount = betAmount * finalMultiplier;
        
        wins.push({
          line: lineIndex,
          symbols: lineSymbols.slice(0, matchCount),
          positions: line.slice(0, matchCount),
          multiplier: finalMultiplier,
          winAmount
        });
        
        totalWinAmount += winAmount;
      }
    });

    const isWin = totalWinAmount > 0;
    const overallMultiplier = isWin ? totalWinAmount / betAmount : 0;

    return {
      result: {
        reels,
        wins,
        totalWins: wins.length,
        symbols // Include symbol reference
      },
      hash,
      isWin,
      multiplier: overallMultiplier,
      winAmount: totalWinAmount
    };
  }

  static playDice(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    target: number,
    isOver: boolean
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToFloat(hash);
    const roll = Math.floor(random * 100) + 1; // 1-100

    let isWin: boolean;
    if (isOver) {
      isWin = roll > target;
    } else {
      isWin = roll < target;
    }

    // Calculate multiplier based on win chance
    const winChance = isOver ? (100 - target) / 100 : target / 100;
    const multiplier = isWin ? (0.99 / winChance) : 0; // 1% house edge
    const winAmount = isWin ? betAmount * multiplier : 0;

    return {
      result: { roll, target, isOver },
      hash,
      isWin,
      multiplier,
      winAmount
    };
  }

  static playCrash(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    cashOutAt: number
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToFloat(hash);

    // Generate crash point using exponential distribution
    const crashPoint = Math.max(1, Math.floor((99 / (random * 99)) * 100) / 100);

    const isWin = cashOutAt <= crashPoint;
    const multiplier = isWin ? cashOutAt : 0;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return {
      result: { crashPoint, cashOutAt },
      hash,
      isWin,
      multiplier,
      winAmount
    };
  }

  static playBlackjack(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    
    // Generate shuffled deck
    const deck = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push(rank);
      }
    }

    // Shuffle using hash-based randomness
    for (let i = 0; i < 52; i++) {
      const randomIndex = Math.floor(this.hashToFloat(hash.substring(i * 2, i * 2 + 8)) * (52 - i));
      [deck[i], deck[i + randomIndex]] = [deck[i + randomIndex], deck[i]];
    }

    // Deal cards
    const playerCards = [deck[0], deck[2]];
    const dealerCards = [deck[1], deck[3]];

    const getHandValue = (cards: number[]): number => {
      let value = 0;
      let aces = 0;
      
      for (const card of cards) {
        if (card === 1) {
          aces++;
          value += 11;
        } else if (card > 10) {
          value += 10;
        } else {
          value += card;
        }
      }
      
      while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
      }
      
      return value;
    };

    const playerValue = getHandValue(playerCards);
    const dealerValue = getHandValue(dealerCards);

    let isWin = false;
    let multiplier = 0;

    if (playerValue === 21 && playerCards.length === 2) {
      // Blackjack
      multiplier = 2.5;
      isWin = true;
    } else if (playerValue > 21) {
      // Player bust
      multiplier = 0;
    } else if (dealerValue > 21) {
      // Dealer bust
      multiplier = 2;
      isWin = true;
    } else if (playerValue > dealerValue) {
      // Player wins
      multiplier = 2;
      isWin = true;
    } else if (playerValue === dealerValue) {
      // Push
      multiplier = 1;
      isWin = true;
    }

    const winAmount = betAmount * multiplier;

    return {
      result: {
        playerCards,
        dealerCards,
        playerValue,
        dealerValue
      },
      hash,
      isWin,
      multiplier,
      winAmount
    };
  }
}