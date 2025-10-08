import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';
import { audioService } from '../../services/audioService';

interface Bet {
  type: string;
  value: any;
  amount: number;
  position?: { x: number; y: number };
}

interface RouletteResult {
  winningNumber: number;
  color: string;
  isRed: boolean;
  isBlack: boolean;
  isEven: boolean;
  isOdd: boolean;
  isLow: boolean;
  isHigh: boolean;
  column: number;
  dozen: number;
  winningBets: any[];
  totalBets: number;
}

const RouletteGame: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateBalance, refreshBalance, isAuthenticated } = useAuth();
  const wheelRef = useRef<HTMLDivElement>(null);
  
  const [bets, setBets] = useState<Bet[]>([]);
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  const [chipValue, setChipValue] = useState(5);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<RouletteResult | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [message, setMessage] = useState("Place your bets!");
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [spinCount, setSpinCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    totalSpins: 0,
    totalWagered: 0,
    totalWon: 0,
    biggestWin: 0
  });

  // Auto-spin functionality
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [autoSpinsRemaining, setAutoSpinsRemaining] = useState(0);

  // Progressive XP and Level System
  const [autoSpinStats, setAutoSpinStats] = useState({
    totalSpins: 0,
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
    xp: 0,
    level: 1,
    levelProgress: 0,
    bonusMultiplier: 1.0
  });

  // History display state
  const [showFullHistory, setShowFullHistory] = useState(false);

  // European roulette numbers in wheel order
  const wheelNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  const getNumberColor = (num: number) => {
    if (num === 0) return 'green';
    return redNumbers.includes(num) ? 'red' : 'black';
  };

  const clearBets = () => {
    setBets([]);
    setTotalBetAmount(0);
    audioService.playButtonClick();
  };

  // Level and XP System
  const calculateXP = (betAmount: number, winAmount: number, isWin: boolean) => {
    let xp = Math.floor(betAmount * 3); // Base XP from bet amount
    
    if (isWin) {
      xp += Math.floor(winAmount * 2); // Bonus XP from wins
      if (winAmount >= betAmount * 5) xp += 25; // Good win bonus
      if (winAmount >= betAmount * 15) xp += 75; // Big win bonus
      if (winAmount >= betAmount * 35) xp += 150; // Mega win bonus (straight bet)
    }
    
    return xp;
  };

  const getLevelInfo = (level: number) => {
    const xpRequired = Math.floor(200 * Math.pow(1.4, level - 1));
    const bonusMultiplier = 1.0 + (level - 1) * 0.05; // 5% bonus per level
    const levelName = level <= 3 ? "Novice" : 
                     level <= 8 ? "Apprentice" : 
                     level <= 15 ? "Mystic" : 
                     level <= 25 ? "Master" : 
                     level <= 40 ? "Grandmaster" : "Legendary";
    
    return { xpRequired, bonusMultiplier, levelName };
  };

  const updateProgressTracking = (betAmount: number, winAmount: number) => {
    const isWin = winAmount > 0;
    const netChange = winAmount - betAmount;
    const earnedXP = calculateXP(betAmount, winAmount, isWin);

    setAutoSpinStats(prev => {
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
        totalSpins: prev.totalSpins + 1,
        totalWagered: prev.totalWagered + betAmount,
        totalWon: prev.totalWon + winAmount,
        netProfit: prev.netProfit + netChange,
        xp: newXP,
        level: newLevel,
        levelProgress: progress,
        bonusMultiplier
      };
    });
  };

  // Auto-spin controls
  const startAutoSpin = (spins: number) => {
    if (bets.length === 0 || !user || isSpinning) return;
    
    setIsAutoSpinning(true);
    setAutoSpinsRemaining(spins);
    setMessage(`🔄 Auto-spinning ${spins} times! Building XP and levels...`);
  };

  const stopAutoSpin = () => {
    setIsAutoSpinning(false);
    setAutoSpinsRemaining(0);
    setMessage("Auto-spin stopped. The wheel awaits your command...");
  };

  const addBet = (betType: string, betValue: any, position?: { x: number; y: number }) => {
    if (!user || user.balance < chipValue || totalBetAmount + chipValue > user.balance) {
      audioService.playError();
      setMessage("Insufficient balance!");
      return;
    }

    const newBet: Bet = {
      type: betType,
      value: betValue,
      amount: chipValue,
      position
    };

    setBets(prev => [...prev, newBet]);
    setTotalBetAmount(prev => prev + chipValue);
    audioService.playBetPlace();
    setMessage(`Bet placed: ${chipValue} on ${betType}`);
  };

  const spin = async () => {
    if (isSpinning || bets.length === 0 || !user) {
      audioService.playError();
      return;
    }

    setIsSpinning(true);
    setMessage("No more bets! The wheel is spinning...");
    
    // Play roulette wheel spinning sound
    audioService.playRouletteWheel();

    // Enhanced spinning animation with multiple phases
    const spinDuration = 5000; // Longer spin for more excitement
    
    // Calculate dramatic spins - wheel and ball go in opposite directions
    const wheelSpins = 8 + Math.random() * 4; // 8-12 full rotations
    const ballSpins = 12 + Math.random() * 6; // 12-18 full rotations in opposite direction
    
    const finalWheelRotation = wheelRotation + (wheelSpins * 360);
    const finalBallRotation = ballRotation - (ballSpins * 360); // Opposite direction

    // Animate with CSS transition
    if (wheelRef.current) {
      wheelRef.current.style.transition = `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
    }

    setWheelRotation(finalWheelRotation);
    setBallRotation(finalBallRotation);

    try {
      // Place bet with backend
      const result = await gameService.placeBet(3, totalBetAmount, { bets }); // Game ID 3 for roulette

      setTimeout(() => {
        // Play ball drop sound
        audioService.playRouletteBallDrop();
        
        if (result.success && result.data) {
          const gameResult = result.data.result as RouletteResult;
          setLastResult(gameResult);
          
          // Update counters and session stats
          setSpinCount(prev => prev + 1);
          setSessionStats(prev => ({
            totalSpins: prev.totalSpins + 1,
            totalWagered: prev.totalWagered + totalBetAmount,
            totalWon: prev.totalWon + (result.data?.winAmount || 0),
            biggestWin: Math.max(prev.biggestWin, result.data?.winAmount || 0)
          }));

          // Update progress tracking
          updateProgressTracking(totalBetAmount, result.data?.winAmount || 0);
          
          // Update balance
          if (result.data.newBalance !== undefined) {
            updateBalance(result.data.newBalance);
          }

          // Show result message
          if (result.data.winAmount > 0) {
            setMessage(`🎉 Winner! Number ${gameResult.winningNumber} (${gameResult.color.toUpperCase()}) - Won $${result.data.winAmount.toFixed(2)}`);
            audioService.playSlotWin(result.data.winAmount);
          } else {
            setMessage(`Number ${gameResult.winningNumber} (${gameResult.color.toUpperCase()}) - Better luck next time!`);
          }

          // Add to history (keep more results like slots)
          setGameHistory(prev => [{
            winningNumber: gameResult.winningNumber,
            color: gameResult.color,
            totalBet: totalBetAmount,
            winAmount: result.data?.winAmount || 0,
            timestamp: new Date()
          }, ...prev.slice(0, 49)]); // Keep 50 results like slots

        } else {
          setMessage("Spin failed. Please try again.");
          audioService.playError();
        }

        // Clear bets for next round
        setBets([]);
        setTotalBetAmount(0);
        setIsSpinning(false);
      }, spinDuration);

    } catch (error) {
      setIsSpinning(false);
      setMessage("Connection error. Please try again.");
      audioService.playError();
    }
  };

  // Auto-spin effect
  useEffect(() => {
    if (isAutoSpinning && autoSpinsRemaining > 0 && !isSpinning && bets.length > 0) {
      const timer = setTimeout(() => {
        spin();
        setAutoSpinsRemaining(prev => prev - 1);
      }, 2000); // Wait 2s between auto spins

      return () => clearTimeout(timer);
    } else if (autoSpinsRemaining === 0 && isAutoSpinning) {
      setIsAutoSpinning(false);
      
      // Show final auto-spin report
      if (autoSpinStats.totalSpins > 0) {
        const netResult = autoSpinStats.netProfit;
        const resultText = netResult >= 0 ? `profit of $${netResult.toFixed(2)}` : `loss of $${Math.abs(netResult).toFixed(2)}`;
        setMessage(`🔄 Auto-spin complete! Level ${autoSpinStats.level} reached with ${resultText}!`);
      } else {
        setMessage("Auto-spin complete. The wheel awaits your command...");
      }
    }
  }, [isAutoSpinning, autoSpinsRemaining, isSpinning, bets.length]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-green-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">🎰 Please Login</h1>
          <button
            onClick={() => navigate('/login')}
            className="casino-button px-8 py-4"
          >
            Login to Play Roulette
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-green-900 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              audioService.playButtonClick();
              navigate('/dashboard');
            }}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg text-white transition-all duration-300"
          >
            ← Back to Games
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 bg-clip-text text-transparent mb-2">
              🎰 European Roulette
            </h1>
            <p className="text-white text-lg">Place your bets and spin the wheel of fortune!</p>
          </div>
          
          {/* Enhanced Stats with Prominent Spin Button */}
          <div className="text-right text-white space-y-3">
            {/* Main Spin Button - Prominently Positioned */}
            <div className="flex items-center space-x-4">
              <button
                onClick={spin}
                disabled={isSpinning || bets.length === 0}
                className={`px-8 py-4 rounded-xl font-bold text-xl transition-all duration-300 shadow-lg ${
                  isSpinning 
                    ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white cursor-not-allowed animate-pulse shadow-orange-500/50'
                    : bets.length === 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-black hover:shadow-xl transform hover:scale-105 shadow-red-500/30'
                }`}
              >
                {isSpinning ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>🎲 SPINNING...</span>
                  </div>
                ) : (
                  '🎲 SPIN WHEEL'
                )}
              </button>
              
              {/* Level Badge */}
              {autoSpinStats.level > 1 && (
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-full border-2 border-purple-400">
                  <div className="text-xs font-bold">LEVEL {autoSpinStats.level}</div>
                  <div className="text-xs opacity-75">{getLevelInfo(autoSpinStats.level).levelName}</div>
                </div>
              )}
            </div>
            
            {/* Stats Display */}
            <div className="flex items-center space-x-6">
              <div>
                <div className="text-sm opacity-75">Balance</div>
                <div className="text-xl font-bold text-green-400">${user?.balance?.toFixed(2) || '0.00'}</div>
              </div>
              <div>
                <div className="text-sm opacity-75">Spins</div>
                <div className="text-xl font-bold text-blue-400">{spinCount}</div>
              </div>
              {autoSpinStats.totalSpins > 0 && (
                <div>
                  <div className="text-sm opacity-75">Level XP</div>
                  <div className="text-sm font-bold text-purple-400">
                    {Math.floor(autoSpinStats.levelProgress)}%
                  </div>
                </div>
              )}
            </div>
            
            {/* Session Stats */}
                        <div className="text-xs opacity-60 space-y-1">
              <div>Session: {sessionStats.totalSpins} spins | Bet: ${sessionStats.totalWagered.toFixed(2)} | Won: ${sessionStats.totalWon.toFixed(2)}</div>
              <div className={`font-medium ${(sessionStats.totalWon - sessionStats.totalWagered) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                Net: {(sessionStats.totalWon - sessionStats.totalWagered) >= 0 ? '+' : ''}${(sessionStats.totalWon - sessionStats.totalWagered).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Auto-Spin Controls Bar */}
        {autoSpinStats.totalSpins > 0 && (
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 border border-purple-500">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                <div className="text-sm font-bold">AUTO-SPIN STATUS:</div>
                {isAutoSpinning ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
                    <span className="text-yellow-400 font-bold">{autoSpinsRemaining} spins remaining</span>
                    <button
                      onClick={stopAutoSpin}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-bold"
                    >
                      STOP
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    {[5, 10, 25, 50].map(count => (
                      <button
                        key={count}
                        onClick={() => startAutoSpin(count)}
                        disabled={bets.length === 0 || isSpinning}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-3 py-1 rounded text-xs font-bold transition-colors"
                      >
                        {count}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Level Progress Bar */}
              <div className="flex items-center space-x-2">
                <div className="text-xs">Level {autoSpinStats.level}:</div>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-300"
                    style={{ width: `${Math.min(autoSpinStats.levelProgress, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs">{Math.floor(autoSpinStats.levelProgress)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Game Message */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="text-center p-4 rounded-lg border-2 border-yellow-400 bg-gradient-to-r from-yellow-900 to-orange-900">
          <p className="text-lg font-medium text-white">{message}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Roulette Wheel */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-2xl p-8 border-4 border-yellow-500 shadow-2xl">
            <div className="flex justify-center items-center mb-6">
              <div className="relative">
                {/* Wheel Container */}
                <div className={`relative w-80 h-80 mx-auto ${isSpinning ? 'animate-pulse' : ''}`}>
                  {/* Outer Ring */}
                  <div className={`absolute inset-0 rounded-full border-8 bg-gradient-to-br from-yellow-600 to-yellow-800 ${
                    isSpinning ? 'border-yellow-300 shadow-2xl shadow-yellow-500/50' : 'border-yellow-500'
                  }`}></div>
                  
                  {/* Spinning glow effect */}
                  {isSpinning && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-spin"></div>
                  )}
                  
                  {/* Wheel */}
                  <div 
                    ref={wheelRef}
                    className={`absolute inset-4 rounded-full border-4 border-yellow-400 overflow-hidden ${
                      isSpinning ? 'shadow-2xl shadow-yellow-500/50' : 'shadow-xl'
                    }`}
                    style={{ 
                      transform: `rotate(${wheelRotation}deg)`,
                      transition: isSpinning ? '' : 'transform 0.3s ease-out'
                    }}
                  >
                    {/* Number Segments */}
                    {wheelNumbers.map((number, index) => {
                      const angle = (360 / wheelNumbers.length) * index;
                      const color = getNumberColor(number);
                      return (
                        <div
                          key={number}
                          className="absolute w-full h-full"
                          style={{ transform: `rotate(${angle}deg)` }}
                        >
                          <div
                            className={`absolute top-0 left-1/2 w-6 h-12 flex items-start justify-center text-white text-sm font-bold transform -translate-x-1/2 ${
                              color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-black' : 'bg-green-600'
                            }`}
                            style={{
                              clipPath: 'polygon(0% 0%, 100% 0%, 85% 100%, 15% 100%)'
                            }}
                          >
                            <span className="mt-1">{number}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ball Track */}
                  <div 
                    className={`absolute inset-8 rounded-full border-2 border-white ${
                      isSpinning ? 'shadow-lg shadow-white/30' : ''
                    }`}
                    style={{ 
                      transform: `rotate(${ballRotation}deg)`,
                      transition: isSpinning ? '' : 'transform 0.3s ease-out'
                    }}
                  >
                    {/* Ball */}
                    <div className={`absolute top-0 left-1/2 w-4 h-4 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-2 ${
                      isSpinning ? 'bg-yellow-300 animate-pulse shadow-yellow-300/50' : 'bg-white'
                    }`}></div>
                  </div>

                  {/* Center Hub */}
                  <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-4 border-white transform -translate-x-1/2 -translate-y-1/2 shadow-lg"></div>
                </div>

                {/* Result Display */}
                {lastResult && (
                  <div className="mt-6 text-center">
                    <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl border-4 ${
                      lastResult.color === 'red' ? 'bg-red-600 border-red-400' :
                      lastResult.color === 'black' ? 'bg-black border-gray-400' :
                      'bg-green-600 border-green-400'
                    }`}>
                      {lastResult.winningNumber} {lastResult.color.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Betting Area and Controls */}
        <div>
          {/* Chip Selection */}
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-6 border-2 border-purple-500 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Select Chip Value</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 5, 10, 25, 50, 100, 250, 500, 1000].map(value => (
                <button
                  key={value}
                  onClick={() => {
                    setChipValue(value);
                    audioService.playButtonClick();
                  }}
                  className={`px-4 py-3 rounded-lg font-bold transition-all duration-300 ${
                    chipValue === value
                      ? 'bg-yellow-500 text-black border-2 border-yellow-300'
                      : 'bg-gray-700 text-white border-2 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  ${value}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Betting Options */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-2 border-gray-600 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Quick Bets</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => addBet('red', 'red')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                disabled={isSpinning}
              >
                Red (1:1)
              </button>
              <button
                onClick={() => addBet('black', 'black')}
                className="bg-black hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg border border-gray-600 transition-all duration-300"
                disabled={isSpinning}
              >
                Black (1:1)
              </button>
              <button
                onClick={() => addBet('even', 'even')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                disabled={isSpinning}
              >
                Even (1:1)
              </button>
              <button
                onClick={() => addBet('odd', 'odd')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                disabled={isSpinning}
              >
                Odd (1:1)
              </button>
              <button
                onClick={() => addBet('low', 'low')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                disabled={isSpinning}
              >
                1-18 (1:1)
              </button>
              <button
                onClick={() => addBet('high', 'high')}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                disabled={isSpinning}
              >
                19-36 (1:1)
              </button>
            </div>

            {/* Straight Number Bets */}
            <h4 className="text-lg font-bold text-white mb-2">Straight Up (35:1)</h4>
            <div className="grid grid-cols-6 gap-1 mb-4">
              {Array.from({ length: 37 }, (_, i) => i).map(num => (
                <button
                  key={num}
                  onClick={() => addBet('straight', num)}
                  className={`h-10 text-xs font-bold rounded transition-all duration-300 ${
                    getNumberColor(num) === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' :
                    getNumberColor(num) === 'black' ? 'bg-black hover:bg-gray-800 text-white border border-gray-600' :
                    'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  disabled={isSpinning}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Current Bets */}
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-6 border-2 border-indigo-500 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Current Bets (${totalBetAmount})</h3>
            {bets.length === 0 ? (
              <p className="text-gray-400">No bets placed</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {bets.map((bet, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                    <span className="text-white text-sm">
                      {bet.type}: {typeof bet.value === 'string' ? bet.value : bet.value}
                    </span>
                    <span className="text-yellow-400 font-bold">${bet.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <button
              onClick={clearBets}
              disabled={isSpinning || bets.length === 0}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
            >
              Clear All Bets
            </button>
            
            <button
              onClick={() => {
                setSpinCount(0);
                setSessionStats({
                  totalSpins: 0,
                  totalWagered: 0,
                  totalWon: 0,
                  biggestWin: 0
                });
                setAutoSpinStats({
                  totalSpins: 0,
                  totalWagered: 0,
                  totalWon: 0,
                  netProfit: 0,
                  xp: 0,
                  level: 1,
                  levelProgress: 0,
                  bonusMultiplier: 1.0
                });
                setGameHistory([]);
                audioService.playButtonClick();
                setMessage("Session stats reset!");
              }}
              disabled={isSpinning}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300"
            >
              Reset Session Stats
            </button>
          </div>

          {/* Enhanced Game History */}
          {gameHistory.length > 0 && (
            <div className="mt-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-2 border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">🔮 Mystical History</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">
                    {gameHistory.length} spin{gameHistory.length !== 1 ? 's' : ''}
                  </span>
                  {gameHistory.length > 10 && (
                    <button
                      onClick={() => setShowFullHistory(!showFullHistory)}
                      className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-xs font-bold text-white transition-colors"
                    >
                      {showFullHistory ? 'Show Less' : 'Show All'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className={`space-y-2 ${!showFullHistory ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
                {(showFullHistory ? gameHistory : gameHistory.slice(0, 10)).map((game, index) => (
                  <div key={index} className="flex justify-between items-center bg-gradient-to-r from-gray-700 to-gray-800 p-3 rounded-lg border border-gray-600 hover:border-purple-500 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 ${
                        game.color === 'red' ? 'bg-red-600 border-red-400' :
                        game.color === 'black' ? 'bg-black border-gray-400' :
                        'bg-green-600 border-green-400'
                      }`}>
                        {game.winningNumber}
                      </div>
                      <div className="text-white">
                        <div className="text-sm font-medium">
                          Spin #{gameHistory.length - index}
                        </div>
                        <div className="text-xs text-gray-400">
                          Bet: ${game.totalBet.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${game.winAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {game.winAmount > 0 ? '+' : ''}${game.winAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {game.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* History Summary */}
              {gameHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="text-gray-400">Total Spins</div>
                      <div className="text-white font-bold">{gameHistory.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Win Rate</div>
                      <div className="text-white font-bold">
                        {((gameHistory.filter(g => g.winAmount > 0).length / gameHistory.length) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Best Win</div>
                      <div className="text-green-400 font-bold">
                        ${Math.max(...gameHistory.map(g => g.winAmount)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouletteGame;