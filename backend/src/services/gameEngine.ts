import crypto from 'crypto';

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
    const random1 = this.hashToFloat(hash.substring(0, 16));
    const random2 = this.hashToFloat(hash.substring(16, 32));
    const random3 = this.hashToFloat(hash.substring(32, 48));

    // Slot symbols: 0=Cherry, 1=Lemon, 2=Orange, 3=Plum, 4=Bell, 5=Bar, 6=Seven
    const reel1 = Math.floor(random1 * 7);
    const reel2 = Math.floor(random2 * 7);
    const reel3 = Math.floor(random3 * 7);

    const result = [reel1, reel2, reel3];
    let multiplier = 0;

    // Win conditions
    if (reel1 === reel2 && reel2 === reel3) {
      // Three of a kind
      const payouts = [5, 10, 15, 25, 50, 100, 777]; // Multipliers for each symbol
      multiplier = payouts[reel1];
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
      // Two of a kind
      multiplier = 2;
    }

    const isWin = multiplier > 0;
    const winAmount = isWin ? betAmount * multiplier : 0;

    return {
      result,
      hash,
      isWin,
      multiplier,
      winAmount
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