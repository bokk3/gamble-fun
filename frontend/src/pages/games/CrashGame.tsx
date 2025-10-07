import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';

const CrashGame: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  
  const [betAmount, setBetAmount] = useState(1.00);
  const [cashOutAt, setCashOutAt] = useState(2.00);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [gameResult, setGameResult] = useState<any>(null);
  const [lastWin, setLastWin] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [canBet, setCanBet] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const minBet = 0.10;
  const maxBet = 200.00;

  // Generate random crash points for demo (this will come from backend in real game)
  const generateCrashPoint = () => {
    return Math.max(1, Math.random() * 10 + 1);
  };

  const startGame = async () => {
    if (isPlaying || !user || user.balance < betAmount) return;

    setIsPlaying(true);
    setCanBet(false);
    setGameResult(null);
    setLastWin(0);
    setCurrentMultiplier(1.00);
    startTimeRef.current = Date.now();

    try {
      // Place bet with backend
      const result = await gameService.placeBet(5, betAmount, { cashOutAt }); // Game ID 5 for crash

      // Animate multiplier growth
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newMultiplier = 1 + (elapsed / 1000) * 0.5; // Grows by 0.5 every second
        setCurrentMultiplier(Number(newMultiplier.toFixed(2)));

        // Check if game should crash (simplified - real game uses backend result)
        if (result.success && result.data) {
          const crashPoint = result.data.result.crashPoint;
          if (newMultiplier >= crashPoint) {
            endGame(result);
          }
        }
      }, 50);

    } catch (error) {
      console.error('Game start failed:', error);
      setIsPlaying(false);
      setCanBet(true);
    }
  };

  const endGame = (result: any) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsPlaying(false);
    setCanBet(true);

    if (result.success && result.data) {
      const { crashPoint, cashOutAt } = result.data.result;
      setCurrentMultiplier(crashPoint);
      setGameResult(result.data.result);
      setLastWin(result.data.winAmount);
      updateBalance(result.data.newBalance);

      // Add to history
      setGameHistory(prev => [{
        crashPoint,
        cashOutAt,
        betAmount,
        winAmount: result.data.winAmount,
        multiplier: result.data.multiplier,
        timestamp: new Date()
      }, ...prev.slice(0, 9)]);
    }
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + amount));
    setBetAmount(Number(newBet.toFixed(2)));
  };

  const adjustCashOut = (amount: number) => {
    const newCashOut = Math.max(1.01, cashOutAt + amount);
    setCashOutAt(Number(newCashOut.toFixed(2)));
  };

  const getResultMessage = () => {
    if (!gameResult) return '';
    
    const { crashPoint, cashOutAt } = gameResult;
    if (cashOutAt <= crashPoint) {
      return `🎉 Cashed out at ${cashOutAt}x! +$${lastWin.toFixed(2)}`;
    } else {
      return `💥 Crashed at ${crashPoint.toFixed(2)}x! -$${betAmount.toFixed(2)}`;
    }
  };

  const getMultiplierColor = () => {
    if (currentMultiplier < 2) return 'text-white';
    if (currentMultiplier < 5) return 'text-yellow-400';
    if (currentMultiplier < 10) return 'text-orange-400';
    return 'text-red-400';
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
            <h1 className="text-3xl font-bold text-yellow-400">📈 Crash Game</h1>
            <p className="text-white opacity-75">Cash out before the crash!</p>
          </div>
          <div className="text-right text-white">
            <div className="text-sm opacity-75">Balance</div>
            <div className="text-xl font-bold text-green-400">${user?.balance?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-8">
          
          {/* Game Display */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-b from-gray-800 to-black rounded-lg p-8 mb-6 relative overflow-hidden">
              {/* Graph Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-green-900 to-red-900 opacity-20"></div>
              
              {/* Multiplier Display */}
              <div className={`text-8xl font-bold ${getMultiplierColor()} ${isPlaying ? 'animate-pulse' : ''} relative z-10`}>
                {currentMultiplier.toFixed(2)}x
              </div>
              
              {/* Status */}
              <div className="text-white text-xl mt-4 relative z-10">
                {isPlaying ? (
                  <div className="animate-bounce">🚀 Flying...</div>
                ) : gameResult ? (
                  <div className={gameResult.cashOutAt <= gameResult.crashPoint ? 'text-green-400' : 'text-red-400'}>
                    {gameResult.cashOutAt <= gameResult.crashPoint ? '✅ Success!' : '💥 Crashed!'}
                  </div>
                ) : (
                  <div>Ready to fly</div>
                )}
              </div>
            </div>

            {/* Result Display */}
            {gameResult && (
              <div className="mb-6">
                <div className={`text-2xl font-bold ${lastWin > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {getResultMessage()}
                </div>
              </div>
            )}

            {/* Game Controls */}
            <div className="bg-black bg-opacity-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Betting Controls */}
                <div>
                  <h3 className="text-white text-lg font-bold mb-4">💰 Bet Amount</h3>
                  <div className="text-white mb-4">
                    <span className="text-2xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-center items-center space-x-2 mb-4">
                    <button
                      onClick={() => adjustBet(-0.10)}
                      disabled={betAmount <= minBet || !canBet}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      -$0.10
                    </button>
                    <button
                      onClick={() => adjustBet(-1)}
                      disabled={betAmount <= minBet || !canBet}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
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
                      disabled={!canBet}
                      className="bg-gray-800 text-white text-center rounded-lg px-3 py-2 w-20 text-sm"
                    />
                    <button
                      onClick={() => adjustBet(1)}
                      disabled={betAmount >= maxBet || !canBet}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      +$1
                    </button>
                    <button
                      onClick={() => adjustBet(10)}
                      disabled={betAmount >= maxBet || !canBet}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      +$10
                    </button>
                  </div>
                </div>

                {/* Cash Out Controls */}
                <div>
                  <h3 className="text-white text-lg font-bold mb-4">🎯 Auto Cash Out</h3>
                  <div className="text-white mb-4">
                    <span className="text-2xl font-bold text-blue-400">{cashOutAt.toFixed(2)}x</span>
                  </div>
                  
                  <div className="flex justify-center items-center space-x-2 mb-4">
                    <button
                      onClick={() => adjustCashOut(-0.10)}
                      disabled={cashOutAt <= 1.01 || !canBet}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      -0.1x
                    </button>
                    <button
                      onClick={() => adjustCashOut(-0.50)}
                      disabled={cashOutAt <= 1.01 || !canBet}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      -0.5x
                    </button>
                    <input
                      type="number"
                      value={cashOutAt}
                      onChange={(e) => setCashOutAt(Math.max(1.01, Number(e.target.value) || 1.01))}
                      min="1.01"
                      step="0.01"
                      disabled={!canBet}
                      className="bg-gray-800 text-white text-center rounded-lg px-3 py-2 w-20 text-sm"
                    />
                    <button
                      onClick={() => adjustCashOut(0.50)}
                      disabled={!canBet}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      +0.5x
                    </button>
                    <button
                      onClick={() => adjustCashOut(1.00)}
                      disabled={!canBet}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-white text-sm"
                    >
                      +1.0x
                    </button>
                  </div>
                </div>
              </div>

              {/* Potential Win Display */}
              <div className="text-center mb-4">
                <div className="text-white opacity-75">Potential Win:</div>
                <div className="text-2xl font-bold text-green-400">
                  ${(betAmount * cashOutAt).toFixed(2)}
                </div>
              </div>

              {/* Play Button */}
              <button
                onClick={startGame}
                disabled={isPlaying || !user || user.balance < betAmount}
                className={`w-full py-4 px-8 rounded-lg font-bold text-xl transition-all duration-200 ${
                  isPlaying || !user || user.balance < betAmount
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transform hover:scale-105'
                }`}
              >
                {isPlaying ? 'FLYING...' : 'START FLIGHT!'}
              </button>
            </div>
          </div>
        </div>

        {/* Game History */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6 mt-6">
          <h3 className="text-xl font-bold text-white mb-4">📊 Flight History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {gameHistory.length === 0 ? (
              <div className="text-white opacity-75 text-center py-4">
                No flights yet. Start playing!
              </div>
            ) : (
              gameHistory.map((game, index) => (
                <div key={index} className="flex justify-between items-center bg-black bg-opacity-30 rounded-lg p-3">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-white opacity-75">
                      Crashed: {game.crashPoint.toFixed(2)}x
                    </div>
                    <div className="text-sm text-blue-400">
                      Target: {game.cashOutAt.toFixed(2)}x
                    </div>
                    <div className={`text-sm ${game.winAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {game.winAmount > 0 ? '✅ Win' : '💥 Crash'}
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

export default CrashGame;