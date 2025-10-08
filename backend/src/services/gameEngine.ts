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
    betAmount: number,
    houseEdge: number = 0.03
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    
    // Fortune Teller themed symbols with achievable big wins
    const symbols = ['🔮', '🪬', '🃏', '🧿', '🦉', '⭐', '🌙', '👑', '💎', '💰', '🌟', '🎭', '🎲', 'WILD'];
    const weights = {
      '🔮': 3,  // Epic - rare but achievable (3% chance for big jackpots)
      '🪬': 4,
      '🃏': 5,
      '🧿': 7,  // Rare - better chance for good wins
      '🦉': 8,
      '⭐': 10,
      '🌙': 12,
      '👑': 15,  // Common high - frequent medium wins
      '💎': 18,
      '💰': 20,
      '🌟': 22, // Common - regular wins
      '🎭': 25,
      '🎲': 28,
      'WILD': 4 // Special - more frequent for bigger wins
    };

    // Create weighted symbol array
    const weightedSymbols: string[] = [];
    Object.entries(weights).forEach(([symbol, weight]) => {
      for (let i = 0; i < weight; i++) {
        weightedSymbols.push(symbol);
      }
    });
    
    // Debug: ensure we have symbols
    if (weightedSymbols.length === 0) {
      console.error('No weighted symbols generated!');
      // Fallback to basic symbols
      weightedSymbols.push(...symbols.slice(0, -1)); // All except WILD
    }

    // Generate 5x3 grid using hash-based randomness
    const reels: string[][] = [];
    for (let col = 0; col < 5; col++) {
      const reel: string[] = [];
      for (let row = 0; row < 3; row++) {
        // Use a simpler, more reliable hash indexing approach
        const position = col * 3 + row;
        const hashStart = (position * 4) % (hash.length - 8); // Ensure we stay within bounds
        const hashSlice = hash.substring(hashStart, hashStart + 8);
        const random = this.hashToFloat(hashSlice);
        const symbolIndex = Math.floor(random * weightedSymbols.length);
        
        // Ensure we always get a valid symbol
        const selectedSymbol = weightedSymbols[symbolIndex] || weightedSymbols[0];
        reel.push(selectedSymbol);
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

    // Symbol multipliers with exciting but balanced payouts
    const getSymbolMultiplier = (symbol: string, count: number): number => {
      const baseMultipliers: { [key: string]: number[] } = {
        '🔮': [0, 0, 15, 75, 300], // Epic - exciting jackpots (300x max)
        '🪬': [0, 0, 10, 50, 200],
        '🃏': [0, 0, 8, 35, 150],
        '🧿': [0, 0, 6, 25, 100], // Rare - good wins
        '🦉': [0, 0, 5, 20, 80],
        '⭐': [0, 0, 4, 15, 60],
        '🌙': [0, 0, 3, 12, 50],
        '👑': [0, 0, 2.5, 10, 40], // Common high - decent wins
        '💎': [0, 0, 2, 8, 30],
        '💰': [0, 0, 1.5, 6, 25],
        '🌟': [0, 0, 1, 4, 20], // Common - small wins
        '🎭': [0, 0, 0.8, 3, 15],
        '🎲': [0, 0, 0.5, 2, 10]
      };
      const baseMultiplier = baseMultipliers[symbol]?.[count] || 0;
      // Light house edge to keep games fair but exciting
      return Math.floor(baseMultiplier * (1 - houseEdge * 0.2) * 100) / 100;
    };

    // Calculate wins on all paylines
    const wins: any[] = [];
    let totalWinAmount = 0;

    paylines.forEach((line, lineIndex) => {
      const lineSymbols = line.map(([row, col]) => reels[col][row]);
      
      // Find the base symbol (first non-wild symbol)
      let baseSymbol = '';
      for (const symbol of lineSymbols) {
        if (symbol !== 'WILD') {
          baseSymbol = symbol;
          break;
        }
      }
      
      // If all symbols are wild, treat as highest value symbol
      if (!baseSymbol) {
        baseSymbol = '🔮'; // Treat all wilds as epic symbol
      }
      
      // Count consecutive matching symbols from left (with wild substitution)
      let matchCount = 0;
      for (let i = 0; i < lineSymbols.length; i++) {
        if (lineSymbols[i] === baseSymbol || lineSymbols[i] === 'WILD') {
          matchCount++;
        } else {
          break;
        }
      }
      
      // Check if we have a winning combination (3+ consecutive symbols from left)
      // Also verify we have a valid base symbol (not just wilds creating fake wins)
      if (matchCount >= 3 && baseSymbol && baseSymbol !== '') {
        const baseMultiplier = getSymbolMultiplier(baseSymbol, matchCount);
        
        // Only apply multiplier if it's actually positive (valid symbol)
        if (baseMultiplier > 0) {
          const wildCount = lineSymbols.slice(0, matchCount).filter(s => s === 'WILD').length;
          const finalMultiplier = baseMultiplier * Math.pow(2, wildCount); // Wild doubles the win
          const winAmount = (betAmount / 10) * finalMultiplier; // Less division for bigger wins
          
          wins.push({
            line: lineIndex,
            symbol: baseSymbol,
            symbols: lineSymbols.slice(0, matchCount),
            positions: line.slice(0, matchCount),
            multiplier: finalMultiplier,
            winAmount
          });
          
          totalWinAmount += winAmount;
        }
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

  static playRoulette(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    betAmount: number,
    bets: { type: string, value: any, amount: number }[]
  ): GameResult {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToFloat(hash);
    
    // European roulette: 0-36 (37 numbers)
    const winningNumber = Math.floor(random * 37);
    
    // Determine color and properties
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = redNumbers.includes(winningNumber);
    const isBlack = winningNumber !== 0 && !isRed;
    const isEven = winningNumber !== 0 && winningNumber % 2 === 0;
    const isOdd = winningNumber !== 0 && winningNumber % 2 === 1;
    const isLow = winningNumber >= 1 && winningNumber <= 18;
    const isHigh = winningNumber >= 19 && winningNumber <= 36;
    
    // Calculate column and dozen
    const column = winningNumber === 0 ? 0 : ((winningNumber - 1) % 3) + 1;
    const dozen = winningNumber === 0 ? 0 : Math.ceil(winningNumber / 12);

    let totalWinAmount = 0;
    const winningBets: any[] = [];

    // Process each bet
    bets.forEach(bet => {
      let isWinning = false;
      let payout = 0;

      switch (bet.type) {
        case 'straight': // Single number
          if (bet.value === winningNumber) {
            isWinning = true;
            payout = 35; // 35:1
          }
          break;
          
        case 'red':
          if (isRed) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'black':
          if (isBlack) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'even':
          if (isEven) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'odd':
          if (isOdd) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'low': // 1-18
          if (isLow) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'high': // 19-36
          if (isHigh) {
            isWinning = true;
            payout = 1; // 1:1
          }
          break;
          
        case 'dozen': // 1st 12, 2nd 12, 3rd 12
          if (bet.value === dozen) {
            isWinning = true;
            payout = 2; // 2:1
          }
          break;
          
        case 'column': // Column 1, 2, or 3
          if (bet.value === column) {
            isWinning = true;
            payout = 2; // 2:1
          }
          break;
          
        case 'split': // Two adjacent numbers
          if (bet.value.includes(winningNumber)) {
            isWinning = true;
            payout = 17; // 17:1
          }
          break;
          
        case 'street': // Three numbers in a row
          if (bet.value.includes(winningNumber)) {
            isWinning = true;
            payout = 11; // 11:1
          }
          break;
          
        case 'corner': // Four numbers
          if (bet.value.includes(winningNumber)) {
            isWinning = true;
            payout = 8; // 8:1
          }
          break;
          
        case 'line': // Six numbers (two streets)
          if (bet.value.includes(winningNumber)) {
            isWinning = true;
            payout = 5; // 5:1
          }
          break;
      }

      if (isWinning) {
        const winAmount = bet.amount * (payout + 1); // Include original bet
        totalWinAmount += winAmount;
        winningBets.push({
          type: bet.type,
          value: bet.value,
          amount: bet.amount,
          payout,
          winAmount
        });
      }
    });

    const isWin = totalWinAmount > 0;
    const overallMultiplier = isWin ? totalWinAmount / betAmount : 0;

    return {
      result: {
        winningNumber,
        color: winningNumber === 0 ? 'green' : (isRed ? 'red' : 'black'),
        isRed,
        isBlack,
        isEven,
        isOdd,
        isLow,
        isHigh,
        column,
        dozen,
        winningBets,
        totalBets: bets.length
      },
      hash,
      isWin,
      multiplier: overallMultiplier,
      winAmount: totalWinAmount
    };
  }
}