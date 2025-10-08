import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';
import { audioService } from '../../services/audioService';

interface GameHistory {
  roll: number;
  target: number;
  isOver: boolean;
  betAmount: number;
  winAmount: number;
  multiplier: number;
  timestamp: Date;
}

const DiceGame: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [betAmount, setBetAmount] = useState(1.00);
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number>(0);
    const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [diceResult, setDiceResult] = useState<number>(1);

  // Mystical Counter - Progressive XP/Level System
  const [progressStats, setProgressStats] = useState({
    totalRolls: 0,
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
    xp: 0,
    level: 1,
    levelProgress: 0,
    bonusMultiplier: 1.0,
    perfectRolls: 0, // Rolls that win by exactly 1
    winStreak: 0,
    bigWins: 0 // Wins with high multipliers
  });

  const minBet = 0.01;
  const maxBet = 50.00;

  // Level and XP System for Dice Game
  const calculateXP = (betAmount: number, winAmount: number, multiplier: number, isWin: boolean, isPerfectRoll: boolean) => {
    let xp = Math.floor(betAmount * 5); // Base XP from bet amount (higher for dice precision)
    
    if (isWin) {
      xp += Math.floor(winAmount * 1.5); // Bonus XP from wins
      if (multiplier >= 2.0) xp += 20; // 2x+ multiplier bonus
      if (multiplier >= 5.0) xp += 50; // 5x+ multiplier bonus
      if (multiplier >= 10.0) xp += 100; // 10x+ multiplier bonus
      if (isPerfectRoll) xp += 75; // Perfect roll bonus
    }
    
    return xp;
  };

  const getLevelInfo = (level: number) => {
    const xpRequired = Math.floor(120 * Math.pow(1.25, level - 1));
    const bonusMultiplier = 1.0 + (level - 1) * 0.03; // 3% bonus per level
    const levelName = level <= 3 ? "Novice" : 
                     level <= 8 ? "Gambler" : 
                     level <= 15 ? "High Roller" : 
                     level <= 25 ? "Lucky Seven" : 
                     level <= 40 ? "Fortune Teller" : "Dice Master";
    
    return { xpRequired, bonusMultiplier, levelName };
  };

  const updateProgressTracking = (betAmount: number, winAmount: number, multiplier: number, roll: number, target: number, isOver: boolean) => {
    const isWin = winAmount > 0;
    const netChange = winAmount - betAmount;
    
    // Check for perfect roll (winning by exactly 1)
    const isPerfectRoll = isWin && ((isOver && roll === target + 1) || (!isOver && roll === target - 1));
    
    const earnedXP = calculateXP(betAmount, winAmount, multiplier, isWin, isPerfectRoll);

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
        totalRolls: prev.totalRolls + 1,
        totalWagered: prev.totalWagered + betAmount,
        totalWon: prev.totalWon + winAmount,
        netProfit: prev.netProfit + netChange,
        xp: newXP,
        level: newLevel,
        levelProgress: progress,
        bonusMultiplier,
        perfectRolls: prev.perfectRolls + (isPerfectRoll ? 1 : 0),
        winStreak: isWin ? prev.winStreak + 1 : 0,
        bigWins: prev.bigWins + (multiplier >= 5.0 && isWin ? 1 : 0)
      };
    });
  };

  // Calculate win chance and multiplier
  const winChance = isOver ? (100 - target) : target;
  const multiplier = winChance > 0 ? (99 / winChance) : 0;

  const rollDice = async () => {
    if (isRolling || !user || user.balance < betAmount || winChance <= 1) {
      audioService.playError();
      return;
    }

    setIsRolling(true);
    setLastWin(0);
    
    // Play dice roll sound
    audioService.playDiceRoll();

    // Animate rolling
    const rollDuration = 2000;
    let animationRoll = Math.floor(Math.random() * 100) + 1;
    const rollInterval = setInterval(() => {
      animationRoll = Math.floor(Math.random() * 100) + 1;
      setLastRoll(animationRoll);
    }, 100);

    try {
      // Place bet with backend
      const result = await gameService.placeBet(4, betAmount, { target, isOver }); // Game ID 4 for dice

      setTimeout(() => {
        clearInterval(rollInterval);
        
        if (result.success && result.data) {
          const gameResult = result.data?.result || { roll: 1 };
          const { roll } = gameResult;
          setDiceResult(roll);
          setLastWin(result.data?.winAmount || 0);
          updateBalance(result.data?.newBalance || 0);
          
          // Update progress tracking
          updateProgressTracking(betAmount, result.data?.winAmount || 0, result.data?.multiplier || 0, roll, target, isOver);
          
          // Play win sound if applicable
          if (result.data?.winAmount > 0) {
            audioService.playSlotWin(result.data.winAmount);
          }
          
          // Add to history
          setGameHistory(prev => [{
            roll,
            target,
            isOver,
            betAmount,
            winAmount: result.data?.winAmount || 0,
            multiplier: result.data?.multiplier || 0,
            timestamp: new Date()
          }, ...prev.slice(0, 9)]);
        }
        
        setIsRolling(false);
      }, rollDuration);

    } catch (error) {
      clearInterval(rollInterval);
      setIsRolling(false);
      console.error('Roll failed:', error);
    }
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + amount));
    setBetAmount(Number(newBet.toFixed(2)));
  };

  const getWinCondition = () => {
    if (lastRoll === null) return '';
    
    const won = isOver ? lastRoll > target : lastRoll < target;
    return won ? 'WIN!' : 'LOSE';
  };

  const getDiceColor = () => {
    if (lastRoll === null) return 'text-white';
    const won = isOver ? lastRoll > target : lastRoll < target;
    return won ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white transition-colors"
          >
            ← Back to Casino
          </button>
          <div className="text-white text-center">
            <h1 className="text-3xl font-bold text-yellow-400">🎲 Dice Roll</h1>
            <p className="text-white opacity-75">Predict the roll and win big!</p>
          </div>
          <div className="text-right text-white space-y-2">
            {/* Level Badge */}
            {progressStats.level > 1 && (
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-2 rounded-full border-2 border-yellow-400 mb-2">
                <div className="text-xs font-bold">LEVEL {progressStats.level}</div>
                <div className="text-xs opacity-75">{getLevelInfo(progressStats.level).levelName}</div>
              </div>
            )}
            
            <div className="flex items-center space-x-6">
              <div>
                <div className="text-sm opacity-75">Balance</div>
                <div className="text-xl font-bold text-green-400">${user?.balance?.toFixed(2) || '0.00'}</div>
              </div>
              <div>
                <div className="text-sm opacity-75">Level</div>
                <div className="text-lg font-bold text-yellow-400">{progressStats.level}</div>
              </div>
              {progressStats.totalRolls > 0 && (
                <div>
                  <div className="text-sm opacity-75">Win Streak</div>
                  <div className="text-lg font-bold text-orange-400">{progressStats.winStreak}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-8">
          
          {/* Dice Display */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-b from-green-400 to-green-600 rounded-lg p-6 mb-6 mx-auto max-w-md">
              <div className="bg-black rounded-lg p-8">
                <div className={`text-6xl font-bold ${getDiceColor()} ${isRolling ? 'animate-pulse' : ''}`}>
                  {lastRoll !== null ? lastRoll : '?'}
                </div>
              </div>
            </div>

            {/* Win Display */}
            {lastWin > 0 && lastRoll !== null && (
              <div className="mb-4 animate-bounce">
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  🎉 {getWinCondition()} +${lastWin.toFixed(2)} 🎉
                </div>
              </div>
            )}
            {lastWin === 0 && lastRoll !== null && !isRolling && (
              <div className="mb-4">
                <div className="text-2xl font-bold text-red-400">
                  💸 {getWinCondition()} -${betAmount.toFixed(2)}
                </div>
              </div>
            )}

            {/* Game Controls */}
            <div className="bg-black bg-opacity-50 rounded-lg p-6 mb-6">
              {/* Prediction Controls */}
              <div className="mb-6">
                <h3 className="text-white text-xl font-bold mb-4">Prediction</h3>
                <div className="flex justify-center items-center space-x-4 mb-4">
                  <button
                    onClick={() => setIsOver(false)}
                    className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                      !isOver 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    Roll UNDER {target}
                  </button>
                  <button
                    onClick={() => setIsOver(true)}
                    className={`px-6 py-3 rounded-lg font-bold transition-colors ${
                      isOver 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    Roll OVER {target}
                  </button>
                </div>

                {/* Target Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-white text-sm mb-2">
                    <span>Target Number</span>
                    <span>{target}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Stats Display */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-white text-sm opacity-75">Win Chance</div>
                    <div className="text-xl font-bold text-blue-400">{winChance.toFixed(1)}%</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-white text-sm opacity-75">Multiplier</div>
                    <div className="text-xl font-bold text-yellow-400">{multiplier.toFixed(2)}x</div>
                  </div>
                </div>
              </div>

              {/* Betting Controls */}
              <div className="mb-4">
                <div className="text-white mb-4">
                  <span className="text-lg">Bet Amount: </span>
                  <span className="text-2xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-center items-center space-x-4 mb-4">
                  <button
                    onClick={() => adjustBet(-0.10)}
                    disabled={betAmount <= minBet}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold"
                  >
                    -$0.10
                  </button>
                  <button
                    onClick={() => adjustBet(-1)}
                    disabled={betAmount <= minBet}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold"
                  >
                    -$1
                  </button>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
                    min={minBet}
                    max={maxBet}
                    step="0.01"
                    className="bg-gray-800 text-white text-center rounded-lg px-4 py-2 w-24"
                  />
                  <button
                    onClick={() => adjustBet(1)}
                    disabled={betAmount >= maxBet}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold"
                  >
                    +$1
                  </button>
                  <button
                    onClick={() => adjustBet(5)}
                    disabled={betAmount >= maxBet}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white font-bold"
                  >
                    +$5
                  </button>
                </div>

                {/* Potential Win Display */}
                <div className="text-center mb-4">
                  <div className="text-white opacity-75">Potential Win:</div>
                  <div className="text-2xl font-bold text-green-400">
                    ${(betAmount * multiplier).toFixed(2)}
                  </div>
                </div>

                {/* Roll Button */}
                <button
                  onClick={rollDice}
                  disabled={isRolling || !user || user.balance < betAmount || winChance <= 1}
                  className={`w-full py-4 px-8 rounded-lg font-bold text-xl transition-all duration-200 ${
                    isRolling || !user || user.balance < betAmount || winChance <= 1
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105'
                  }`}
                >
                  {isRolling ? 'ROLLING...' : 'ROLL DICE!'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mystical Progress Stats */}
        {progressStats.totalRolls > 0 && (
          <div className="bg-gradient-to-r from-yellow-900 to-orange-900 rounded-xl p-6 border border-yellow-500 mt-6">
            <div className="flex items-center justify-between text-white mb-4">
              <h3 className="text-xl font-bold">🎲 Dice Master Progress</h3>
              <div className="flex items-center space-x-2">
                <div className="text-sm">Level {progressStats.level}:</div>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-300"
                    style={{ width: `${Math.min(progressStats.levelProgress, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs">{Math.floor(progressStats.levelProgress)}%</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white">
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="text-sm opacity-75">Total Rolls</div>
                <div className="text-xl font-bold text-yellow-400">{progressStats.totalRolls}</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="text-sm opacity-75">Perfect Rolls</div>
                <div className="text-xl font-bold text-green-400">{progressStats.perfectRolls}</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="text-sm opacity-75">Big Wins (5x+)</div>
                <div className="text-xl font-bold text-purple-400">{progressStats.bigWins}</div>
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
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6 mt-6">
          <h3 className="text-xl font-bold text-white mb-4">📊 Recent Rolls</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {gameHistory.length === 0 ? (
              <div className="text-white opacity-75 text-center py-4">
                No rolls yet. Start playing!
              </div>
            ) : (
              gameHistory.map((game, index) => (
                <div key={index} className="flex justify-between items-center bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl font-bold text-white">{game.roll}</div>
                    <div className="text-sm text-white opacity-75">
                      {game.isOver ? 'Over' : 'Under'} {game.target}
                    </div>
                    <div className="text-sm text-yellow-400">
                      {game.multiplier.toFixed(2)}x
                    </div>
                  </div>
                  <div className={`font-bold ${game.winAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {game.winAmount > 0 ? `+$${game.winAmount.toFixed(2)}` : `-$${game.betAmount.toFixed(2)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiceGame;