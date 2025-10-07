import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const SYMBOL_NAMES = ['Cherry', 'Lemon', 'Orange', 'Plum', 'Bell', 'Bar', 'Seven'];
const SYMBOL_PAYOUTS = [5, 10, 15, 25, 50, 100, 777];

const SlotsGame: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  
  const [reels, setReels] = useState([0, 0, 0]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(1.00);
  const [lastWin, setLastWin] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [showPaytable, setShowPaytable] = useState(false);

  const minBet = 0.10;
  const maxBet = 100.00;

  const spin = async () => {
    if (isSpinning || !user || user.balance < betAmount) return;

    setIsSpinning(true);
    setLastWin(0);

    // Animate spinning
    const spinDuration = 2000;
    const spinInterval = setInterval(() => {
      setReels([
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length)
      ]);
    }, 100);

    try {
      // Place bet with backend
      const result = await gameService.placeBet(1, betAmount); // Game ID 1 for slots

      setTimeout(() => {
        clearInterval(spinInterval);
        
        if (result.success && result.data) {
          setReels(result.data.result);
          setLastWin(result.data.winAmount);
          updateBalance(result.data.newBalance);
          
          // Add to history
          setGameHistory(prev => [{
            reels: result.data.result,
            betAmount,
            winAmount: result.data.winAmount,
            multiplier: result.data.multiplier,
            timestamp: new Date()
          }, ...prev.slice(0, 9)]);
        }
        
        setIsSpinning(false);
      }, spinDuration);

    } catch (error) {
      clearInterval(spinInterval);
      setIsSpinning(false);
      console.error('Spin failed:', error);
    }
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + amount));
    setBetAmount(Number(newBet.toFixed(2)));
  };

  const getWinType = (reels: number[]) => {
    const [r1, r2, r3] = reels;
    if (r1 === r2 && r2 === r3) {
      return `Three ${SYMBOL_NAMES[r1]}s!`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      return 'Two of a kind!';
    }
    return '';
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
            <h1 className="text-3xl font-bold text-yellow-400">🎰 Lucky Slots</h1>
            <p className="text-white opacity-75">Spin the reels for massive wins!</p>
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
          
          {/* Slot Machine */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-lg p-6 mb-6 mx-auto max-w-md">
              <div className="flex justify-center space-x-2 bg-black rounded-lg p-4">
                {reels.map((symbol, index) => (
                  <div
                    key={index}
                    className={`w-20 h-20 bg-white rounded-lg flex items-center justify-center text-4xl ${
                      isSpinning ? 'animate-pulse' : ''
                    }`}
                  >
                    {SLOT_SYMBOLS[symbol]}
                  </div>
                ))}
              </div>
            </div>

            {/* Win Display */}
            {lastWin > 0 && (
              <div className="mb-4 animate-bounce">
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  🎉 WIN! +${lastWin.toFixed(2)} 🎉
                </div>
                <div className="text-white text-lg">
                  {getWinType(reels)}
                </div>
              </div>
            )}

            {/* Betting Controls */}
            <div className="bg-black bg-opacity-50 rounded-lg p-6 mb-6">
              <div className="text-white mb-4">
                <span className="text-lg">Bet Amount: </span>
                <span className="text-2xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-center items-center space-x-4 mb-4">
                <button
                  onClick={() => adjustBet(-0.10)}
                  disabled={betAmount <= minBet}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                >
                  -$0.10
                </button>
                <button
                  onClick={() => adjustBet(-1)}
                  disabled={betAmount <= minBet}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
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
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                >
                  +$1
                </button>
                <button
                  onClick={() => adjustBet(10)}
                  disabled={betAmount >= maxBet}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                >
                  +$10
                </button>
              </div>

              {/* Spin Button */}
              <button
                onClick={spin}
                disabled={isSpinning || !user || user.balance < betAmount}
                className={`w-full py-4 px-8 rounded-lg font-bold text-xl transition-all duration-200 ${
                  isSpinning || !user || user.balance < betAmount
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black transform hover:scale-105'
                }`}
              >
                {isSpinning ? 'SPINNING...' : 'SPIN!'}
              </button>
            </div>
          </div>
        </div>

        {/* Game Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Paytable */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">💰 Paytable</h3>
            <div className="space-y-2">
              {SLOT_SYMBOLS.map((symbol, index) => (
                <div key={index} className="flex justify-between items-center text-white">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{symbol}</span>
                    <span className="text-2xl">{symbol}</span>
                    <span className="text-2xl">{symbol}</span>
                  </div>
                  <span className="font-bold text-yellow-400">{SYMBOL_PAYOUTS[index]}x</span>
                </div>
              ))}
              <div className="border-t border-white border-opacity-20 pt-2 mt-2">
                <div className="flex justify-between items-center text-white">
                  <span>Any Two Match</span>
                  <span className="font-bold text-green-400">2x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">📊 Recent Spins</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gameHistory.length === 0 ? (
                <div className="text-white opacity-75 text-center py-4">
                  No spins yet. Start playing!
                </div>
              ) : (
                gameHistory.map((game, index) => (
                  <div key={index} className="flex justify-between items-center bg-black bg-opacity-30 rounded-lg p-3">
                    <div className="flex items-center space-x-1">
                      {game.reels.map((reel: number, idx: number) => (
                        <span key={idx} className="text-lg">{SLOT_SYMBOLS[reel]}</span>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${game.winAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {game.winAmount > 0 ? `+$${game.winAmount.toFixed(2)}` : `-$${game.betAmount.toFixed(2)}`}
                      </div>
                      {game.multiplier > 0 && (
                        <div className="text-xs text-yellow-400">{game.multiplier}x</div>
                      )}
                    </div>
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

export default SlotsGame;