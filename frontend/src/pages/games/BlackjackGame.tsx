import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';

interface Card {
  rank: number;
  suit: string;
  suitSymbol: string;
}

interface GameHistory {
  playerCards: Card[];
  dealerCards: Card[];
  playerValue: number;
  dealerValue: number;
  betAmount: number;
  winAmount: number;
  multiplier: number;
  result: string;
  timestamp: Date;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const SUIT_COLORS: { [key: string]: string } = {
  '♠': 'text-black',
  '♥': 'text-red-500',
  '♦': 'text-red-500',
  '♣': 'text-black'
};

const BlackjackGame: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  
  const [betAmount, setBetAmount] = useState(10.00);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [gameState, setGameState] = useState<'betting' | 'dealing' | 'playing' | 'dealer-turn' | 'finished'>('betting');
  const [lastWin, setLastWin] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [gameResult, setGameResult] = useState<string>('');
  const [deck, setDeck] = useState<Card[]>([]);
  const [dealerHoleCard, setDealerHoleCard] = useState<Card | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [canDoubleDown, setCanDoubleDown] = useState(false);
  const [hasDoubledDown, setHasDoubledDown] = useState(false);

  // Mystical Counter - Progressive XP/Level System
  const [progressStats, setProgressStats] = useState({
    totalHands: 0,
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
    xp: 0,
    level: 1,
    levelProgress: 0,
    bonusMultiplier: 1.0,
    blackjacks: 0,
    perfectDoubles: 0, // Double down wins
    winStreak: 0
  });

  const minBet = 1.00;
  const maxBet = 500.00;

  // Level and XP System for Blackjack
  const calculateXP = (betAmount: number, winAmount: number, isBlackjack: boolean, isDoubleDown: boolean, isWin: boolean) => {
    let xp = Math.floor(betAmount * 3); // Base XP from bet amount
    
    if (isWin) {
      xp += Math.floor(winAmount * 1.5); // Bonus XP from wins
      if (isBlackjack) xp += 100; // Blackjack bonus
      if (isDoubleDown) xp += 50; // Double down bonus
    }
    
    return xp;
  };

  const getLevelInfo = (level: number) => {
    const xpRequired = Math.floor(180 * Math.pow(1.35, level - 1));
    const bonusMultiplier = 1.0 + (level - 1) * 0.025; // 2.5% bonus per level
    const levelName = level <= 3 ? "Rookie" : 
                     level <= 8 ? "Card Counter" : 
                     level <= 15 ? "High Roller" : 
                     level <= 25 ? "Blackjack Pro" : 
                     level <= 40 ? "Casino Legend" : "Twenty-One Master";
    
    return { xpRequired, bonusMultiplier, levelName };
  };

  const updateProgressTracking = (betAmount: number, winAmount: number, result: string, isDoubleDown: boolean) => {
    const isWin = winAmount > 0;
    const isBlackjack = result === 'blackjack';
    const netChange = winAmount - betAmount;
    
    const earnedXP = calculateXP(betAmount, winAmount, isBlackjack, isDoubleDown, isWin);

    setProgressStats(prev => {
      const newXP = prev.xp + earnedXP;
      const currentLevel = prev.level;
      const { xpRequired } = getLevelInfo(currentLevel);
      
      let newLevel = currentLevel;
      let remainingXP = newXP;
      
      // Check for level ups
      while (remainingXP >= xpRequired && newLevel < 100) {
        remainingXP -= xpRequired;
        newLevel += 1;
      }
      
      const { bonusMultiplier } = getLevelInfo(newLevel);
      const progress = newLevel < 100 ? (remainingXP / getLevelInfo(newLevel).xpRequired) * 100 : 100;

      return {
        ...prev,
        totalHands: prev.totalHands + 1,
        totalWagered: prev.totalWagered + betAmount,
        totalWon: prev.totalWon + winAmount,
        netProfit: prev.netProfit + netChange,
        xp: newXP,
        level: newLevel,
        levelProgress: progress,
        bonusMultiplier,
        blackjacks: prev.blackjacks + (isBlackjack ? 1 : 0),
        perfectDoubles: prev.perfectDoubles + (isDoubleDown && isWin ? 1 : 0),
        winStreak: isWin ? prev.winStreak + 1 : 0
      };
    });
  };

  // Initialize a new deck of cards
  const createDeck = (): Card[] => {
    const newDeck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        newDeck.push({
          rank,
          suit: SUIT_NAMES[suit],
          suitSymbol: SUITS[suit]
        });
      }
    }
    return shuffleDeck(newDeck);
  };

  // Shuffle deck using Fisher-Yates algorithm
  const shuffleDeck = (deck: Card[]): Card[] => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const getCardName = (rank: number) => {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return rank.toString();
  };

  const calculateHandValue = (cards: Card[]): number => {
    let value = 0;
    let aces = 0;
    
    for (const card of cards) {
      if (card.rank === 1) {
        aces++;
        value += 11;
      } else if (card.rank > 10) {
        value += 10;
      } else {
        value += card.rank;
      }
    }
    
    // Convert aces from 11 to 1 if needed
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    return value;
  };

  const renderCard = (card: Card | null, index: number, isHidden = false) => {
    if (isHidden || !card) {
      return (
        <div key={`hidden-${index}`} className="w-20 h-28 bg-gradient-to-b from-blue-900 to-blue-800 border-2 border-blue-600 rounded-lg flex items-center justify-center mr-2 mb-2 shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-white text-3xl">🂠</div>
        </div>
      );
    }

    const suitColor = SUIT_COLORS[card.suitSymbol];
    
    return (
      <div key={`card-${card.rank}-${card.suit}-${index}`} className="w-20 h-28 bg-white border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center mr-2 mb-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
        <div className={`text-lg font-bold ${suitColor}`}>
          {getCardName(card.rank)}
        </div>
        <div className={`text-2xl ${suitColor}`}>
          {card.suitSymbol}
        </div>
      </div>
    );
  };

  // Deal initial cards
  const dealInitialCards = () => {
    const newDeck = createDeck();
    const playerHand = [newDeck[0], newDeck[2]];
    const dealerHand = [newDeck[1], newDeck[3]];
    const holeCard = newDeck[3];
    
    setDeck(newDeck.slice(4));
    setPlayerCards(playerHand);
    setDealerCards([dealerHand[0]]); // Only show dealer's first card
    setDealerHoleCard(holeCard);
    setPlayerValue(calculateHandValue(playerHand));
    setDealerValue(calculateHandValue([dealerHand[0]]));
    setCanDoubleDown(playerHand.length === 2);
    setHasDoubledDown(false);
    
    // Check for natural blackjack
    const playerBJ = calculateHandValue(playerHand) === 21;
    const dealerBJ = calculateHandValue(dealerHand) === 21;
    
    if (playerBJ || dealerBJ) {
      // Reveal dealer's hole card and finish game
      setDealerCards(dealerHand);
      setDealerValue(calculateHandValue(dealerHand));
      setGameState('finished');
      
      if (playerBJ && dealerBJ) {
        setGameResult('PUSH - Both Blackjack! 🤝');
        finishGame(playerHand, dealerHand, 'push');
      } else if (playerBJ) {
        setGameResult('BLACKJACK! 🎉');
        finishGame(playerHand, dealerHand, 'blackjack');
      } else {
        setGameResult('Dealer Blackjack - You Lose! 😢');
        finishGame(playerHand, dealerHand, 'dealer-blackjack');
      }
    } else {
      setGameState('playing');
    }
  };

  const startGame = () => {
    if (!user || user.balance < betAmount) return;
    
    setGameState('dealing');
    setLastWin(0);
    setGameResult('');
    setIsAnimating(true);
    
    // Simulate dealing animation
    setTimeout(() => {
      dealInitialCards();
      setIsAnimating(false);
    }, 1000);
  };

  const hit = () => {
    if (gameState !== 'playing' || deck.length === 0) return;
    
    const newCard = deck[0];
    const newPlayerCards = [...playerCards, newCard];
    const newPlayerValue = calculateHandValue(newPlayerCards);
    
    setDeck(deck.slice(1));
    setPlayerCards(newPlayerCards);
    setPlayerValue(newPlayerValue);
    setCanDoubleDown(false);
    
    if (newPlayerValue > 21) {
      // Player busts
      setDealerCards([...dealerCards, dealerHoleCard!]);
      setDealerValue(calculateHandValue([...dealerCards, dealerHoleCard!]));
      setGameState('finished');
      setGameResult('BUST! You Lose! 💥');
      finishGame(newPlayerCards, [...dealerCards, dealerHoleCard!], 'bust');
    }
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    
    setGameState('dealer-turn');
    setCanDoubleDown(false);
    
    // Reveal dealer's hole card
    const fullDealerHand = [...dealerCards, dealerHoleCard!];
    setDealerCards(fullDealerHand);
    
    // Dealer must hit on soft 17
    dealerPlay(fullDealerHand);
  };

  const doubleDown = () => {
    if (gameState !== 'playing' || !canDoubleDown || !user || user.balance < betAmount) return;
    
    setBetAmount(prev => prev * 2);
    setHasDoubledDown(true);
    setCanDoubleDown(false);
    
    // Deal one more card and stand
    const newCard = deck[0];
    const newPlayerCards = [...playerCards, newCard];
    const newPlayerValue = calculateHandValue(newPlayerCards);
    
    setDeck(deck.slice(1));
    setPlayerCards(newPlayerCards);
    setPlayerValue(newPlayerValue);
    
    if (newPlayerValue > 21) {
      // Player busts
      setDealerCards([...dealerCards, dealerHoleCard!]);
      setDealerValue(calculateHandValue([...dealerCards, dealerHoleCard!]));
      setGameState('finished');
      setGameResult('BUST! You Lose! 💥');
      finishGame(newPlayerCards, [...dealerCards, dealerHoleCard!], 'bust');
    } else {
      setGameState('dealer-turn');
      const fullDealerHand = [...dealerCards, dealerHoleCard!];
      setDealerCards(fullDealerHand);
      dealerPlay(fullDealerHand);
    }
  };

  const dealerPlay = (initialDealerHand: Card[]) => {
    let currentDealerHand = [...initialDealerHand];
    let currentDeck = [...deck.slice(1)]; // Account for player's last card if any
    let dealerVal = calculateHandValue(currentDealerHand);
    
    // Dealer hits on soft 17
    while (dealerVal < 17) {
      if (currentDeck.length === 0) break;
      
      const newCard = currentDeck[0];
      currentDealerHand.push(newCard);
      currentDeck = currentDeck.slice(1);
      dealerVal = calculateHandValue(currentDealerHand);
    }
    
    setDealerCards(currentDealerHand);
    setDealerValue(dealerVal);
    setDeck(currentDeck);
    setGameState('finished');
    
    // Determine winner
    const playerVal = calculateHandValue(playerCards);
    
    if (dealerVal > 21) {
      setGameResult('Dealer Busts - You Win! 🎉');
      finishGame(playerCards, currentDealerHand, 'dealer-bust');
    } else if (playerVal > dealerVal) {
      setGameResult('You Win! 🎉');
      finishGame(playerCards, currentDealerHand, 'win');
    } else if (playerVal === dealerVal) {
      setGameResult('PUSH - Tie Game! 🤝');
      finishGame(playerCards, currentDealerHand, 'push');
    } else {
      setGameResult('Dealer Wins - You Lose! 😢');
      finishGame(playerCards, currentDealerHand, 'lose');
    }
  };

  const finishGame = async (finalPlayerCards: Card[], finalDealerCards: Card[], result: string) => {
    const finalPlayerValue = calculateHandValue(finalPlayerCards);
    const finalDealerValue = calculateHandValue(finalDealerCards);
    
    // Determine multiplier and win amount
    let multiplier = 0;
    let winAmount = 0;
    
    switch (result) {
      case 'blackjack':
        multiplier = 2.5;
        winAmount = betAmount * multiplier;
        break;
      case 'win':
      case 'dealer-bust':
        multiplier = 2;
        winAmount = betAmount * multiplier;
        break;
      case 'push':
        multiplier = 1;
        winAmount = betAmount; // Return bet
        break;
      case 'bust':
      case 'lose':
      case 'dealer-blackjack':
        multiplier = 0;
        winAmount = 0;
        break;
    }
    
    setLastWin(winAmount);
    
    // Update progress tracking
    updateProgressTracking(betAmount, winAmount, result, hasDoubledDown);
    
    // Send result to backend for balance update
    try {
      const backendResult = await gameService.placeBet(2, betAmount);
      if (backendResult.success && backendResult.data) {
        updateBalance(backendResult.data.newBalance);
      }
    } catch (error) {
      console.error('Failed to update backend:', error);
      // Update balance locally if backend fails
      const newBalance = user?.balance ? user.balance - betAmount + winAmount : winAmount;
      updateBalance(newBalance);
    }
    
    // Add to history
    setGameHistory((prev: GameHistory[]) => [{
      playerCards: finalPlayerCards,
      dealerCards: finalDealerCards,
      playerValue: finalPlayerValue,
      dealerValue: finalDealerValue,
      betAmount: hasDoubledDown ? betAmount : betAmount,
      winAmount,
      multiplier,
      result: gameResult || 'Game completed',
      timestamp: new Date()
    }, ...prev.slice(0, 9)]);
  };

  const newGame = () => {
    setGameState('betting');
    setPlayerCards([]);
    setDealerCards([]);
    setPlayerValue(0);
    setDealerValue(0);
    setLastWin(0);
    setGameResult('');
    setDealerHoleCard(null);
    setCanDoubleDown(false);
    setHasDoubledDown(false);
    if (hasDoubledDown) {
      setBetAmount(betAmount / 2); // Reset doubled bet
    }
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + amount));
    setBetAmount(Number(newBet.toFixed(2)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-green-700 hover:bg-green-600 px-6 py-3 rounded-lg text-white transition-all duration-300 border border-green-500 hover:border-green-400"
          >
            ← Back to Casino
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-green-300 to-yellow-400 bg-clip-text text-transparent mb-2">
              🂡 Blackjack 21 🂱
            </h1>
            <p className="text-green-200 text-lg">Beat the dealer without going over 21!</p>
          </div>
          <div className="text-right text-white space-y-2">
            {/* Level Badge */}
            {progressStats.level > 1 && (
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 rounded-full border-2 border-green-400 mb-2">
                <div className="text-xs font-bold">LEVEL {progressStats.level}</div>
                <div className="text-xs opacity-75">{getLevelInfo(progressStats.level).levelName}</div>
              </div>
            )}
            
            <div className="flex items-center space-x-6">
              <div>
                <div className="text-sm opacity-75">Balance</div>
                <div className="text-2xl font-bold text-green-400">${user?.balance?.toFixed(2) || '0.00'}</div>
              </div>
              <div>
                <div className="text-sm opacity-75">Level</div>
                <div className="text-lg font-bold text-green-400">{progressStats.level}</div>
              </div>
              {progressStats.totalHands > 0 && (
                <div>
                  <div className="text-sm opacity-75">Blackjacks</div>
                  <div className="text-lg font-bold text-yellow-400">{progressStats.blackjacks}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-b from-green-900 to-green-800 rounded-2xl border-2 border-green-600 p-8 shadow-2xl">
          
          {/* Game Table */}
          <div className="text-center mb-8">
            
            {/* Dealer Section */}
            <div className="mb-8">
              <h3 className="text-white text-2xl font-bold mb-4 flex items-center justify-center">
                <span className="mr-2">🎩</span>
                Dealer {gameState === 'finished' ? `(${dealerValue})` : dealerCards.length > 0 ? `(${calculateHandValue(dealerCards)})` : ''}
                <span className="ml-2">🎩</span>
              </h3>
              <div className="flex justify-center flex-wrap min-h-32 bg-green-800 bg-opacity-50 rounded-xl p-4 border border-green-700">
                {gameState === 'betting' ? (
                  <div className="text-green-300 text-lg flex items-center">Waiting for your bet...</div>
                ) : (
                  <>
                    {dealerCards.map((card, index) => renderCard(card, index, false))}
                    {gameState !== 'finished' && dealerHoleCard && renderCard(null, 99, true)}
                  </>
                )}
              </div>
            </div>

            {/* Player Section */}
            <div className="mb-8">
              <h3 className="text-white text-2xl font-bold mb-4 flex items-center justify-center">
                <span className="mr-2">👤</span>
                Your Hand {gameState !== 'betting' ? `(${playerValue})` : ''}
                <span className="ml-2">👤</span>
              </h3>
              <div className="flex justify-center flex-wrap min-h-32 bg-blue-800 bg-opacity-50 rounded-xl p-4 border border-blue-700">
                {gameState === 'betting' ? (
                  <div className="text-blue-300 text-lg flex items-center">Place your bet to start!</div>
                ) : playerCards.length > 0 ? (
                  playerCards.map((card, index) => renderCard(card, index, false))
                ) : (
                  <div className="text-blue-300 text-lg flex items-center">Cards coming...</div>
                )}
              </div>
            </div>

            {/* Game Result */}
            {gameResult && (
              <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 border-2 border-yellow-400">
                <div className={`text-3xl font-bold mb-2 ${lastWin >= betAmount ? 'text-white' : 'text-white'}`}>
                  {gameResult}
                </div>
                {lastWin > 0 && (
                  <div className="text-2xl font-bold text-green-200">
                    +${lastWin.toFixed(2)}
                  </div>
                )}
                {lastWin === 0 && gameState === 'finished' && (
                  <div className="text-2xl font-bold text-red-200">
                    -${betAmount.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Game Controls */}
            {gameState === 'betting' && (
              <div className="bg-gradient-to-b from-black to-green-900 rounded-xl p-6 mb-6 border-2 border-green-600">
                <div className="text-white mb-4">
                  <span className="text-xl">Bet Amount: </span>
                  <span className="text-3xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-center items-center space-x-4 mb-6">
                  <button
                    onClick={() => adjustBet(-1)}
                    disabled={betAmount <= minBet}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-red-500"
                  >
                    -$1
                  </button>
                  <button
                    onClick={() => adjustBet(-5)}
                    disabled={betAmount <= minBet}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-red-500"
                  >
                    -$5
                  </button>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
                    min={minBet}
                    max={maxBet}
                    step="1"
                    className="bg-gray-800 text-white text-center rounded-lg px-4 py-2 w-28 border-2 border-green-500 focus:border-green-400 focus:outline-none"
                  />
                  <button
                    onClick={() => adjustBet(5)}
                    disabled={betAmount >= maxBet}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-green-500"
                  >
                    +$5
                  </button>
                  <button
                    onClick={() => adjustBet(25)}
                    disabled={betAmount >= maxBet}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-green-500"
                  >
                    +$25
                  </button>
                </div>

                <button
                  onClick={startGame}
                  disabled={!user || user.balance < betAmount}
                  className={`w-full py-6 px-8 rounded-xl font-bold text-2xl transition-all duration-300 border-4 ${
                    !user || user.balance < betAmount
                      ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-400'
                      : 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 border-yellow-400 text-black transform hover:scale-105 shadow-lg hover:shadow-2xl'
                  }`}
                  style={{
                    boxShadow: !user || user.balance < betAmount ? 'none' : '0 0 30px rgba(255, 215, 0, 0.5)'
                  }}
                >
                  {isAnimating ? '🎴 DEALING... 🎴' : '🎴 DEAL CARDS 🎴'}
                </button>
              </div>
            )}

            {/* Playing Controls */}
            {gameState === 'playing' && (
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={hit}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 border border-blue-500"
                >
                  HIT 🃏
                </button>
                <button
                  onClick={stand}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 border border-red-500"
                >
                  STAND ✋
                </button>
                {canDoubleDown && user && user.balance >= betAmount && (
                  <button
                    onClick={doubleDown}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 border border-purple-500"
                  >
                    DOUBLE DOWN 💰
                  </button>
                )}
              </div>
            )}

            {/* New Game Button */}
            {gameState === 'finished' && (
              <button
                onClick={newGame}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 border border-green-500"
              >
                NEW GAME 🎲
              </button>
            )}
          </div>
        </div>

        {/* Rules and History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          
          {/* Rules */}
          <div className="bg-gradient-to-b from-green-900 to-green-800 rounded-xl border-2 border-green-600 p-6">
            <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">📋 Blackjack Rules 📋</h3>
            <div className="space-y-3 text-white">
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">🎯</span>
                <span>Get closer to 21 than the dealer without going over</span>
              </div>
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">🅰️</span>
                <span>Aces count as 1 or 11 (whichever is better)</span>
              </div>
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">👑</span>
                <span>Face cards (J, Q, K) count as 10</span>
              </div>
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">💎</span>
                <span>Blackjack (21 with 2 cards) pays 2.5x</span>
              </div>
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">🏆</span>
                <span>Regular win pays 2x</span>
              </div>
              <div className="flex items-center p-2 bg-green-800 bg-opacity-50 rounded-lg">
                <span className="text-2xl mr-3">🤝</span>
                <span>Push (tie) returns your bet</span>
              </div>
            </div>
          </div>

          {/* Mystical Progress Stats */}
          {progressStats.totalHands > 0 && (
            <div className="bg-gradient-to-r from-green-900 to-emerald-900 rounded-xl p-6 border border-green-500 mb-6">
              <div className="flex items-center justify-between text-white mb-4">
                <h3 className="text-xl font-bold">🂡 Card Master Progress</h3>
                <div className="flex items-center space-x-2">
                  <div className="text-sm">Level {progressStats.level}:</div>
                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.min(progressStats.levelProgress, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs">{Math.floor(progressStats.levelProgress)}%</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white">
                <div className="bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="text-sm opacity-75">Total Hands</div>
                  <div className="text-xl font-bold text-green-400">{progressStats.totalHands}</div>
                </div>
                <div className="bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="text-sm opacity-75">Blackjacks</div>
                  <div className="text-xl font-bold text-yellow-400">{progressStats.blackjacks}</div>
                </div>
                <div className="bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="text-sm opacity-75">Perfect Doubles</div>
                  <div className="text-xl font-bold text-blue-400">{progressStats.perfectDoubles}</div>
                </div>
                <div className="bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="text-sm opacity-75">Net Profit</div>
                  <div className={`text-xl font-bold ${progressStats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {progressStats.netProfit >= 0 ? '+' : ''}${progressStats.netProfit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Game History */}
          <div className="bg-gradient-to-b from-green-900 to-green-800 rounded-xl border-2 border-green-600 p-6">
            <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">📊 Recent Games 📊</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {gameHistory.length === 0 ? (
                <div className="text-green-200 text-center py-8 bg-green-800 bg-opacity-30 rounded-lg border border-green-700">
                  No games played yet. Deal your first hand!
                </div>
              ) : (
                gameHistory.map((game, index) => (
                  <div key={index} className="bg-green-800 bg-opacity-50 rounded-lg p-4 border border-green-700">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm text-white">
                        <div>You: {game.playerValue} | Dealer: {game.dealerValue}</div>
                        <div className="text-xs text-green-300 mt-1">
                          {game.playerCards.length} cards vs {game.dealerCards.length} cards
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${game.winAmount >= game.betAmount ? 'text-green-400' : 'text-red-400'}`}>
                          {game.winAmount > 0 ? `+$${game.winAmount.toFixed(2)}` : `-$${game.betAmount.toFixed(2)}`}
                        </div>
                        {game.multiplier > 0 && (
                          <div className="text-sm text-yellow-400">{game.multiplier}x</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-green-200 bg-green-900 bg-opacity-50 rounded p-2">{game.result}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlackjackGame;