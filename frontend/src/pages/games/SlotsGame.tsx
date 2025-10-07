import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';
import { audioService } from '../../services/audioService';

interface GameHistoryItem {
  reels: string[][];
  betAmount: number;
  winAmount: number;
  multiplier: number;
  winLines: WinLine[];
  bonusTriggered: boolean;
  timestamp: Date;
}

interface WinLine {
  line: number;
  symbols: string[];
  positions: number[][];
  multiplier: number;
  winAmount: number;
}

interface SpinResult {
  reels: string[][];
  winLines: WinLine[];
  totalWin: number;
  bonusTriggered: boolean;
  freeSpins: number;
}

const SlotsGame: React.FC = () => {
  const { user, updateBalance, refreshBalance, isAuthenticated, isBalanceLoading } = useAuth();
  const navigate = useNavigate();
  
  // Check authentication and redirect if needed
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('Authentication check failed, redirecting to home...');
      navigate('/');
      return;
    }
    
    // Test token validity
    const token = localStorage.getItem('casino_token');
    if (!token) {
      console.log('No token found, redirecting to home...');
      navigate('/');
      return;
    }
    
    console.log('Authentication check passed:', {
      user: user.username,
      balance: user.balance,
      tokenExists: !!token
    });
  }, [isAuthenticated, user, navigate]);
  
  const [betAmount, setBetAmount] = useState(25);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState<string[][]>([
    ['🔮', '🃏', '⭐'],
    ['🌙', '🦉', '🕯️'],
    ['🧿', '🪬', '🔮'],
    ['⭐', '🌙', '🃏'],
    ['🦉', '🕯️', '🧿']
  ]);
  const [lastWin, setLastWin] = useState<number>(0);
  const [totalWon, setTotalWon] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [message, setMessage] = useState<string>("The spirits await your fortune...");
  const [messageType, setMessageType] = useState<string>("");
  const [winLines, setWinLines] = useState<WinLine[]>([]);
  const [activeBonusRound, setActiveBonusRound] = useState(false);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [wildMultiplier, setWildMultiplier] = useState(1);
  const [showWinAnimation, setShowWinAnimation] = useState(false);

  // Enhanced symbol set with special symbols
  const symbols = {
    common: ['�️', '🔔', '💰', '💎', '👑'],
    rare: ['🌙', '⭐', '🦉', '🧿'],
    epic: ['🃏', '🪬', '🔮'],
    wild: '🌟', // Wild symbol
    scatter: '✨', // Scatter symbol
    bonus: '🎰' // Bonus symbol
  };
  
  const allSymbols = [...symbols.common, ...symbols.rare, ...symbols.epic, symbols.wild, symbols.scatter, symbols.bonus];
  
  const symbolWeights = {
    '🕯️': 15, '🔔': 15, '💰': 12, '💎': 10, '👑': 8,
    '🌙': 7, '⭐': 6, '🦉': 5, '🧿': 4,
    '🃏': 3, '🪬': 2, '🔮': 1,
    '🌟': 3, // Wild
    '✨': 2, // Scatter
    '🎰': 1  // Bonus
  };

  const minBet = 5;
  const maxBet = 500;
  const ROWS = 3;
  const COLS = 5;

  // Define paylines (winning combinations)
  const paylines = [
    [[0,0], [0,1], [0,2], [0,3], [0,4]], // Top horizontal
    [[1,0], [1,1], [1,2], [1,3], [1,4]], // Middle horizontal
    [[2,0], [2,1], [2,2], [2,3], [2,4]], // Bottom horizontal
    [[0,0], [1,1], [2,2], [1,3], [0,4]], // Zigzag top
    [[2,0], [1,1], [0,2], [1,3], [2,4]], // Zigzag bottom
    [[0,0], [0,1], [1,2], [2,3], [2,4]], // Diagonal down
    [[2,0], [2,1], [1,2], [0,3], [0,4]], // Diagonal up
    [[1,0], [0,1], [0,2], [0,3], [1,4]], // V-shape top
    [[1,0], [2,1], [2,2], [2,3], [1,4]], // V-shape bottom
    [[0,0], [1,1], [1,2], [1,3], [0,4]], // A-shape
    [[2,0], [1,1], [1,2], [1,3], [2,4]], // A-shape inverted
    [[1,0], [1,1], [0,2], [1,3], [1,4]], // W-shape top
    [[1,0], [1,1], [2,2], [1,3], [1,4]], // W-shape bottom
    [[0,0], [2,1], [0,2], [2,3], [0,4]], // Zigzag extreme
    [[2,0], [0,1], [2,2], [0,3], [2,4]], // Zigzag extreme inverted
    [[0,0], [1,1], [0,2], [1,3], [2,4]], // Lightning
    [[2,0], [1,1], [2,2], [1,3], [0,4]], // Lightning inverted
    [[1,0], [0,1], [1,2], [2,3], [1,4]], // M-shape
    [[1,0], [2,1], [1,2], [0,3], [1,4]], // M-shape inverted
    [[0,0], [0,1], [2,2], [0,3], [0,4]]  // Crown shape
  ];

  const mysticalMessages = [
    "The ancient spirits whisper secrets...",
    "Five realms of mystical power await...",
    "The cosmic alignment grows stronger...",
    "Sacred energies flow through the reels...",
    "Divine protection surrounds your fortune...",
    "The evil eye watches over your luck...",
    "Celestial guardians guide your destiny...",
    "Ancient wisdom reveals hidden treasures...",
    "The mystic hamsa blesses your path...",
    "Spiritual forces converge upon you..."
  ];

  const payouts: { [key: string]: number } = {
    // 5 of a kind
    '🔮🔮🔮🔮🔮': 1000, '🃏🃏🃏🃏🃏': 500, '⭐⭐⭐⭐⭐': 300,
    '🌙🌙🌙🌙🌙': 250, '🦉🦉🦉🦉🦉': 200, '🕯️🕯️🕯️🕯️🕯️': 150,
    '🧿🧿🧿🧿🧿': 400, '🪬🪬🪬🪬🪬': 600,
    // 4 of a kind
    '🔮🔮🔮🔮': 200, '🃏🃏🃏🃏': 150, '⭐⭐⭐⭐': 100,
    '🌙🌙🌙🌙': 80, '🦉🦉🦉🦉': 70, '🕯️🕯️🕯️🕯️': 60,
    '🧿🧿🧿🧿': 120, '🪬🪬🪬🪬': 180,
    // 3 of a kind
    '🔮🔮🔮': 50, '🃏🃏🃏': 40, '⭐⭐⭐': 30,
    '🌙🌙🌙': 25, '🦉🦉🦉': 20, '🕯️🕯️🕯️': 15,
    '🧿🧿🧿': 35, '🪬🪬🪬': 45
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSpinning && message.includes("spirits await")) {
        const randomMessage = mysticalMessages[Math.floor(Math.random() * mysticalMessages.length)];
        setMessage(randomMessage);
        setMessageType("");
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isSpinning, message, mysticalMessages]);

  const adjustBet = (change: number) => {
    if (isSpinning) return;
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + change));
    setBetAmount(Number(newBet.toFixed(2)));
    audioService.playBetPlace();
  };

  // Enhanced weighted random symbol selection
  const getRandomSymbol = () => {
    const totalWeight = Object.values(symbolWeights).reduce((sum, weight) => sum + weight, 0);
    let randomNum = Math.random() * totalWeight;
    
    for (const [symbol, weight] of Object.entries(symbolWeights)) {
      randomNum -= weight;
      if (randomNum <= 0) {
        return symbol;
      }
    }
    return allSymbols[0];
  };

  // Generate initial random reels with proper weighting
  const generateRandomReels = (): string[][] => {
    return Array(COLS).fill(null).map(() => 
      Array(ROWS).fill(null).map(() => getRandomSymbol())
    );
  };

  // Check for winning combinations
  const checkWins = (gameReels: string[][]): WinLine[] => {
    const wins: WinLine[] = [];
    
    paylines.forEach((line, lineIndex) => {
      const lineSymbols = line.map(([row, col]) => gameReels[col][row]);
      const cleanSymbols = lineSymbols.map(symbol => symbol === symbols.wild ? 'WILD' : symbol);
      
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
      if (matchCount >= 3) {
        const baseMultiplier = getSymbolMultiplier(matchSymbol, matchCount);
        const wildCount = lineSymbols.slice(0, matchCount).filter(s => s === symbols.wild).length;
        const finalMultiplier = baseMultiplier * Math.pow(2, wildCount); // Wild doubles the win
        
        wins.push({
          line: lineIndex,
          symbols: lineSymbols.slice(0, matchCount),
          positions: line.slice(0, matchCount),
          multiplier: finalMultiplier,
          winAmount: betAmount * finalMultiplier
        });
      }
    });
    
    return wins;
  };

  // Get symbol multiplier based on rarity and count
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
      '🔔': [0, 0, 3, 12, 50],
      '🕯️': [0, 0, 2, 10, 40]
    };
    
    return multipliers[symbol]?.[count] || 0;
  };

  // Check for bonus features
  const checkBonusFeatures = (gameReels: string[][]): { bonus: boolean, freeSpins: number, scatterCount: number } => {
    const flatReels = gameReels.flat();
    const scatterCount = flatReels.filter(symbol => symbol === symbols.scatter).length;
    const bonusCount = flatReels.filter(symbol => symbol === symbols.bonus).length;
    
    let freeSpins = 0;
    if (scatterCount >= 3) {
      freeSpins = scatterCount === 3 ? 10 : scatterCount === 4 ? 15 : 25;
    }
    
    return {
      bonus: bonusCount >= 3,
      freeSpins,
      scatterCount
    };
  };

  const spin = async () => {
    if (isSpinning || !user || user.balance < betAmount) {
      setMessage("Insufficient credits! The spirits require payment...");
      setMessageType("lose");
      audioService.playError();
      return;
    }

    setIsSpinning(true);
    setWinLines([]);
    setShowWinAnimation(false);
    setMessage(mysticalMessages[Math.floor(Math.random() * mysticalMessages.length)]);
    setMessageType("");
    
    // Play spinning sound
    audioService.playSlotSpin();

    // Enhanced spinning animation
    const spinDuration = 3500;
    const spinInterval = setInterval(() => {
      setReels(generateRandomReels());
    }, 120);

    try {
      const result = await gameService.placeBet(1, betAmount);

      setTimeout(() => {
        clearInterval(spinInterval);
        
        // Generate visual result (for display only)
        const finalReels = generateRandomReels();
        const wins = checkWins(finalReels);
        const bonusFeatures = checkBonusFeatures(finalReels);
        
        // ALWAYS use server's win amount for accurate balance - never trust client calculation
        const serverWinAmount = result.success && result.data ? result.data.winAmount : 0;
        const clientWinAmount = wins.reduce((sum, win) => sum + win.winAmount, 0);
        const totalWinAmount = serverWinAmount; // Use server amount only for display and balance
        
        console.log('Win amounts:', {
          serverWinAmount,
          clientWinAmount, 
          totalWinAmount,
          serverBalance: result.data?.newBalance,
          currentBalance: user?.balance
        });

        // Warn about calculation mismatches (for debugging)
        if (Math.abs(serverWinAmount - clientWinAmount) > 0.01 && clientWinAmount > 0) {
          console.warn('⚠️ PAYOUT MISMATCH!', {
            server: serverWinAmount,
            client: clientWinAmount,
            difference: Math.abs(serverWinAmount - clientWinAmount)
          });
        }
        
        setReels(finalReels);
        setWinLines(wins);
        setLastWin(totalWinAmount);
        setTotalWon((prev: number) => prev + totalWinAmount);
        
        // Handle bonus features
        if (bonusFeatures.freeSpins > 0) {
          setFreeSpinsRemaining(prev => prev + bonusFeatures.freeSpins);
          setMessage(`✨ FREE SPINS GRANTED! ✨ ${bonusFeatures.freeSpins} mystical spins await!`);
          setMessageType("bonus");
        } else if (bonusFeatures.bonus) {
          setActiveBonusRound(true);
          setMessage("🎰 BONUS ROUND ACTIVATED! 🎰 The ancient vault opens!");
          setMessageType("bonus");
        } else if (totalWinAmount > 0) {
          setShowWinAnimation(true);
          if (totalWinAmount >= betAmount * 50) {
            setMessage(`🌟 MEGA WIN! 🌟 The cosmic forces bestow $${totalWinAmount.toFixed(2)}!`);
            setMessageType("mega-win");
            audioService.playJackpot();
          } else if (totalWinAmount >= betAmount * 20) {
            setMessage(`💫 BIG WIN! 💫 The spirits reward you with $${totalWinAmount.toFixed(2)}!`);
            setMessageType("big-win");
            audioService.playBigWin();
          } else {
            setMessage(`🔮 Mystical victory! You've won $${totalWinAmount.toFixed(2)}! 🔮`);
            setMessageType("win");
            audioService.playSmallWin();
          }
        } else {
          setMessage("The spirits test your resolve... The prophecy awaits!");
          setMessageType("lose");
        }

        // Update balance from server response
        if (result.success && result.data && result.data.newBalance !== undefined) {
          console.log('Updating balance from server:', result.data.newBalance);
          updateBalance(result.data.newBalance);
        } else if (!result.success) {
          console.error('Bet placement failed:', result.message);
          setMessage(`❌ Bet failed: ${result.message || 'Unknown error'}`);
          setMessageType("error");
        } else {
          console.log('No server balance received, keeping current balance');
        }

        setGameHistory((prev: GameHistoryItem[]) => [{
          reels: finalReels,
          betAmount,
          winAmount: totalWinAmount,
          multiplier: wins.length > 0 ? Math.max(...wins.map(w => w.multiplier)) : 0,
          winLines: wins,
          bonusTriggered: bonusFeatures.bonus || bonusFeatures.freeSpins > 0,
          timestamp: new Date()
        }, ...prev.slice(0, 9)]);
        
        setIsSpinning(false);
      }, spinDuration);

    } catch (error) {
      clearInterval(spinInterval);
      setIsSpinning(false);
      setMessage("The mystical connection was lost... Try again!");
      setMessageType("error");
    }
  };

  const getWinType = (reels: string[][]) => {
    const allSymbols = reels.flat();
    const counts: { [key: string]: number } = {};
    allSymbols.forEach(symbol => {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(counts));
    if (maxCount >= 5) return 'LEGENDARY JACKPOT!';
    if (maxCount >= 4) return 'Mystical Quad!';
    if (maxCount >= 3) return 'Sacred Triple!';
    if (maxCount >= 2) return 'Twin Blessing!';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-700 hover:bg-purple-600 px-6 py-3 rounded-lg text-white transition-all duration-300 border border-purple-500 hover:border-purple-400"
          >
            ← Back to Casino
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-purple-300 to-pink-400 bg-clip-text text-transparent mb-2">
              🔮 Fortune Teller Slots 🔮
            </h1>
            <p className="text-purple-200 text-lg">The mystical reels reveal your destiny...</p>
          </div>
          <div className="text-right text-white">
            <div className="text-sm opacity-75">Balance</div>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-green-400">${user?.balance?.toFixed(2) || '0.00'}</div>
              {isBalanceLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-400 border-t-transparent"></div>
              )}
              <button
                onClick={() => {
                  audioService.playButtonClick();
                  refreshBalance();
                }}
                className="text-green-400 hover:text-green-300 transition-colors"
                title="Refresh Balance"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Message Display */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className={`text-center p-4 rounded-lg border-2 ${
          messageType === 'jackpot' ? 'bg-gradient-to-r from-yellow-600 to-orange-600 border-yellow-400 text-white animate-pulse' :
          messageType === 'big-win' ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white' :
          messageType === 'win' ? 'bg-gradient-to-r from-green-600 to-teal-600 border-green-400 text-white' :
          messageType === 'lose' ? 'bg-gradient-to-r from-red-600 to-pink-600 border-red-400 text-white' :
          'bg-gradient-to-r from-purple-800 to-indigo-800 border-purple-500 text-purple-200'
        }`}>
          <p className="text-lg font-medium">{message}</p>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-2xl border-2 border-purple-500 p-8 shadow-2xl">
          
          {/* Slot Machine */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-b from-yellow-600 via-purple-700 to-black rounded-3xl p-10 mb-8 mx-auto max-w-6xl border-4 border-gold shadow-2xl">
              {/* Free Spins Indicator */}
              {freeSpinsRemaining > 0 && (
                <div className="text-center mb-6 p-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl border-2 border-pink-400">
                  <div className="text-2xl font-bold text-white animate-pulse">
                    ✨ FREE SPINS: {freeSpinsRemaining} ✨
                  </div>
                </div>
              )}
              
              {/* Enhanced 5x3 Slot Machine */}
              <div className="bg-gradient-to-b from-black via-purple-900 to-black rounded-2xl p-8 border-4 border-purple-600 shadow-inner">
                <div className="grid grid-cols-5 gap-4">
                  {reels.map((reel, colIndex) => (
                    <div key={colIndex} className="flex flex-col space-y-2">
                      {reel.map((symbol, rowIndex) => {
                        const isWinningSymbol = winLines.some(win => 
                          win.positions.some(([row, col]) => row === rowIndex && col === colIndex)
                        );
                        
                        return (
                          <div
                            key={`${colIndex}-${rowIndex}`}
                            className={`
                              w-28 h-28 bg-gradient-to-b from-white via-purple-50 to-purple-100 
                              rounded-2xl flex items-center justify-center text-6xl border-4 
                              ${isWinningSymbol ? 'border-yellow-400 animate-pulse shadow-yellow-400' : 'border-purple-300'} 
                              shadow-xl transform transition-all duration-500
                              ${isSpinning ? 'animate-bounce scale-110' : 'hover:scale-105'}
                              ${isWinningSymbol && showWinAnimation ? 'animate-ping' : ''}
                              ${symbol === symbols.wild ? 'bg-gradient-to-b from-yellow-200 to-yellow-400' : ''}
                              ${symbol === symbols.scatter ? 'bg-gradient-to-b from-pink-200 to-pink-400' : ''}
                              ${symbol === symbols.bonus ? 'bg-gradient-to-b from-green-200 to-green-400' : ''}
                            `}
                            style={{
                              boxShadow: isSpinning ? '0 0 30px rgba(147, 51, 234, 1)' : 
                                        isWinningSymbol ? '0 0 25px rgba(255, 215, 0, 0.8)' : 
                                        '0 8px 25px rgba(0, 0, 0, 0.4)',
                              filter: isWinningSymbol ? 'brightness(1.3) saturate(1.5)' : 'none'
                            }}
                          >
                            <span className={`
                              ${symbol === symbols.wild ? 'animate-spin text-yellow-800' : ''}
                              ${symbol === symbols.scatter ? 'animate-bounce text-pink-800' : ''}
                              ${symbol === symbols.bonus ? 'animate-pulse text-green-800' : ''}
                              ${isWinningSymbol ? 'animate-bounce' : ''}
                            `}>
                              {symbol}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* Win Lines Display */}
                {winLines.length > 0 && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-yellow-800 to-orange-800 rounded-xl border-2 border-yellow-400">
                    <div className="text-center text-white font-bold text-lg mb-2">
                      🎉 WINNING LINES: {winLines.length} 🎉
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {winLines.map((win, index) => (
                        <div key={index} className="bg-black bg-opacity-50 rounded-lg p-2 text-center">
                          <div className="text-yellow-400 font-bold">Line {win.line + 1}</div>
                          <div className="text-white text-sm">{win.symbols.join(' ')}</div>
                          <div className="text-green-400 font-bold">{win.multiplier}x = ${win.winAmount}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Win Display */}
            {lastWin > 0 && (
              <div className="mb-6 animate-bounce">
                <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
                  🎉 MYSTICAL WIN! +${lastWin.toFixed(2)} 🎉
                </div>
                <div className="text-purple-200 text-xl">
                  {getWinType(reels)}
                </div>
              </div>
            )}

            {/* Betting Controls */}
            <div className="bg-gradient-to-b from-black to-purple-900 rounded-xl p-6 mb-6 border-2 border-purple-600">
              <div className="text-white mb-4">
                <span className="text-xl">Sacred Offering: </span>
                <span className="text-3xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-center items-center space-x-4 mb-6">
                <button
                  onClick={() => adjustBet(-5)}
                  disabled={betAmount <= minBet}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-red-500"
                >
                  -$5
                </button>
                <button
                  onClick={() => adjustBet(-25)}
                  disabled={betAmount <= minBet}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-red-500"
                >
                  -$25
                </button>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
                  min={minBet}
                  max={maxBet}
                  step="1"
                  className="bg-gray-800 text-white text-center rounded-lg px-4 py-2 w-28 border-2 border-purple-500 focus:border-purple-400 focus:outline-none"
                />
                <button
                  onClick={() => adjustBet(25)}
                  disabled={betAmount >= maxBet}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-green-500"
                >
                  +$25
                </button>
                <button
                  onClick={() => adjustBet(50)}
                  disabled={betAmount >= maxBet}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-all duration-300 border border-green-500"
                >
                  +$50
                </button>
              </div>

              {/* Spin Button */}
              <button
                onClick={spin}
                disabled={isSpinning || !user || user.balance < betAmount}
                className={`w-full py-6 px-8 rounded-xl font-bold text-2xl transition-all duration-300 border-4 ${
                  isSpinning || !user || user.balance < betAmount
                    ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 border-yellow-400 text-black transform hover:scale-105 shadow-lg hover:shadow-2xl'
                }`}
                style={{
                  boxShadow: !isSpinning && user && user.balance >= betAmount ? '0 0 30px rgba(255, 215, 0, 0.5)' : 'none'
                }}
              >
                {isSpinning ? '🔮 DIVINING... 🔮' : '✨ CONSULT THE SPIRITS ✨'}
              </button>
            </div>
          </div>
        </div>

        {/* Game Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Paytable */}
          <div className="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-xl border-2 border-purple-500 p-6">
            <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">💰 Sacred Payouts 💰</h3>
            <div className="space-y-3">
              {allSymbols.map((symbol: string, index: number) => (
                <div key={index} className="flex justify-between items-center text-white bg-black bg-opacity-30 rounded-lg p-3 border border-purple-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl">{symbol}</span>
                    <span className="text-3xl">{symbol}</span>
                    <span className="text-3xl">{symbol}</span>
                    <span className="text-3xl">{symbol}</span>
                    <span className="text-3xl">{symbol}</span>
                  </div>
                  <span className="font-bold text-yellow-400 text-xl">{payouts[symbol.repeat(5)] || 100}x</span>
                </div>
              ))}
              <div className="border-t-2 border-purple-600 pt-4 mt-4">
                <div className="flex justify-between items-center text-white bg-green-800 bg-opacity-50 rounded-lg p-3 border border-green-600">
                  <span className="text-lg">Any Triple Match</span>
                  <span className="font-bold text-green-400 text-xl">15x - 50x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-xl border-2 border-purple-500 p-6">
            <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">📊 Mystical History 📊</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {gameHistory.length === 0 ? (
                <div className="text-purple-200 text-center py-8 bg-black bg-opacity-30 rounded-lg border border-purple-700">
                  The spirits await your first consultation...
                </div>
              ) : (
                gameHistory.map((game, index) => (
                  <div key={index} className="flex justify-between items-center bg-black bg-opacity-50 rounded-lg p-4 border border-purple-700">
                    <div className="flex items-center space-x-1">
                      {game.reels.map((reel: string[], idx: number) => 
                        reel.map((symbol: string, symbolIdx: number) => (
                          <span key={`${idx}-${symbolIdx}`} className="text-2xl">{symbol}</span>
                        ))
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${game.winAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {game.winAmount > 0 ? `+$${game.winAmount.toFixed(2)}` : `-$${game.betAmount.toFixed(2)}`}
                      </div>
                      {game.multiplier > 0 && (
                        <div className="text-sm text-yellow-400">{game.multiplier}x</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 bg-gradient-to-r from-purple-800 to-indigo-800 rounded-xl border-2 border-purple-500 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-green-400">${totalWon.toFixed(2)}</div>
              <div className="text-purple-200">Total Mystical Wins</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-400">{gameHistory.length}</div>
              <div className="text-purple-200">Spiritual Consultations</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">
                {gameHistory.length > 0 ? `${((gameHistory.filter(g => g.winAmount > 0).length / gameHistory.length) * 100).toFixed(1)}%` : '0%'}
              </div>
              <div className="text-purple-200">Divine Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotsGame;