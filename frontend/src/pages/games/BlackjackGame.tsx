import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gameService } from '../../services/gameService';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS: { [key: string]: string } = {
  '♠': 'text-black',
  '♥': 'text-red-500',
  '♦': 'text-red-500',
  '♣': 'text-black'
};

const BlackjackGame: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  
  const [betAmount, setBetAmount] = useState(1.00);
  const [playerCards, setPlayerCards] = useState<number[]>([]);
  const [dealerCards, setDealerCards] = useState<number[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [gameState, setGameState] = useState<'betting' | 'playing' | 'finished'>('betting');
  const [lastWin, setLastWin] = useState<number>(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [gameResult, setGameResult] = useState<string>('');

  const minBet = 1.00;
  const maxBet = 500.00;

  const getCardName = (card: number) => {
    if (card === 1) return 'A';
    if (card === 11) return 'J';
    if (card === 12) return 'Q';
    if (card === 13) return 'K';
    return card.toString();
  };

  const getCardValue = (card: number) => {
    if (card > 10) return 10;
    return card;
  };

  const calculateHandValue = (cards: number[]) => {
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

  const renderCard = (card: number, index: number, isHidden = false) => {
    if (isHidden) {
      return (
        <div key={index} className="w-16 h-24 bg-blue-900 border-2 border-white rounded-lg flex items-center justify-center mr-2 mb-2">
          <div className="text-white text-xl">?</div>
        </div>
      );
    }

    const suit = SUITS[index % 4];
    const suitColor = SUIT_COLORS[suit];
    
    return (
      <div key={index} className="w-16 h-24 bg-white border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center mr-2 mb-2 shadow-lg">
        <div className={`text-lg font-bold ${suitColor}`}>
          {getCardName(card)}
        </div>
        <div className={`text-xl ${suitColor}`}>
          {suit}
        </div>
      </div>
    );
  };

  const startGame = async () => {
    if (!user || user.balance < betAmount) return;

    setGameState('playing');
    setLastWin(0);
    setGameResult('');

    try {
      // Place bet with backend
      const result = await gameService.placeBet(2, betAmount); // Game ID 2 for blackjack

      if (result.success && result.data) {
        const { playerCards: pCards, dealerCards: dCards, playerValue: pValue, dealerValue: dValue } = result.data.result;
        
        setPlayerCards(pCards);
        setDealerCards(dCards);
        setPlayerValue(pValue);
        setDealerValue(dValue);
        setLastWin(result.data.winAmount);
        setGameState('finished');
        updateBalance(result.data.newBalance);

        // Determine result message
        let resultMessage = '';
        if (result.data.multiplier === 2.5) {
          resultMessage = 'Blackjack! 🃏';
        } else if (result.data.multiplier === 2) {
          if (dValue > 21) {
            resultMessage = 'Dealer bust! You win! 🎉';
          } else {
            resultMessage = 'You win! 🎉';
          }
        } else if (result.data.multiplier === 1) {
          resultMessage = 'Push (tie) 🤝';
        } else {
          if (pValue > 21) {
            resultMessage = 'You bust! Dealer wins 💸';
          } else {
            resultMessage = 'Dealer wins 💸';
          }
        }
        setGameResult(resultMessage);

        // Add to history
        setGameHistory(prev => [{
          playerCards: pCards,
          dealerCards: dCards,
          playerValue: pValue,
          dealerValue: dValue,
          betAmount,
          winAmount: result.data.winAmount,
          multiplier: result.data.multiplier,
          result: resultMessage,
          timestamp: new Date()
        }, ...prev.slice(0, 9)]);
      }

    } catch (error) {
      console.error('Game start failed:', error);
      setGameState('betting');
    }
  };

  const newGame = () => {
    setGameState('betting');
    setPlayerCards([]);
    setDealerCards([]);
    setPlayerValue(0);
    setDealerValue(0);
    setLastWin(0);
    setGameResult('');
  };

  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(maxBet, betAmount + amount));
    setBetAmount(Number(newBet.toFixed(2)));
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
            <h1 className="text-3xl font-bold text-yellow-400">🂡 Blackjack 21</h1>
            <p className="text-white opacity-75">Beat the dealer to 21!</p>
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
          
          {/* Game Table */}
          <div className="text-center mb-8">
            
            {/* Dealer Section */}
            <div className="mb-8">
              <h3 className="text-white text-xl font-bold mb-4">
                Dealer {gameState === 'finished' ? `(${dealerValue})` : ''}
              </h3>
              <div className="flex justify-center flex-wrap">
                {dealerCards.map((card, index) => renderCard(card, index, false))}
              </div>
            </div>

            {/* Player Section */}
            <div className="mb-8">
              <h3 className="text-white text-xl font-bold mb-4">
                Your Hand {gameState === 'finished' ? `(${playerValue})` : ''}
              </h3>
              <div className="flex justify-center flex-wrap">
                {playerCards.map((card, index) => renderCard(card, index, false))}
              </div>
            </div>

            {/* Game Result */}
            {gameResult && (
              <div className="mb-6">
                <div className={`text-3xl font-bold mb-2 ${lastWin >= betAmount ? 'text-green-400' : 'text-red-400'}`}>
                  {gameResult}
                </div>
                {lastWin > 0 && (
                  <div className="text-2xl font-bold text-yellow-400">
                    +${lastWin.toFixed(2)}
                  </div>
                )}
                {lastWin === 0 && gameState === 'finished' && (
                  <div className="text-2xl font-bold text-red-400">
                    -${betAmount.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Betting Controls */}
            {gameState === 'betting' && (
              <div className="bg-black bg-opacity-50 rounded-lg p-6 mb-6">
                <div className="text-white mb-4">
                  <span className="text-lg">Bet Amount: </span>
                  <span className="text-2xl font-bold text-yellow-400">${betAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-center items-center space-x-4 mb-4">
                  <button
                    onClick={() => adjustBet(-1)}
                    disabled={betAmount <= minBet}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                  >
                    -$1
                  </button>
                  <button
                    onClick={() => adjustBet(-5)}
                    disabled={betAmount <= minBet}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                  >
                    -$5
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
                    onClick={() => adjustBet(5)}
                    disabled={betAmount >= maxBet}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                  >
                    +$5
                  </button>
                  <button
                    onClick={() => adjustBet(25)}
                    disabled={betAmount >= maxBet}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-bold"
                  >
                    +$25
                  </button>
                </div>

                <button
                  onClick={startGame}
                  disabled={!user || user.balance < betAmount}
                  className={`w-full py-4 px-8 rounded-lg font-bold text-xl transition-all duration-200 ${
                    !user || user.balance < betAmount
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transform hover:scale-105'
                  }`}
                >
                  DEAL CARDS!
                </button>
              </div>
            )}

            {/* New Game Button */}
            {gameState === 'finished' && (
              <button
                onClick={newGame}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                NEW GAME
              </button>
            )}
          </div>
        </div>

        {/* Rules and History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Rules */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">📋 Rules</h3>
            <div className="space-y-2 text-white text-sm">
              <div>• Get closer to 21 than the dealer</div>
              <div>• Aces count as 1 or 11</div>
              <div>• Face cards count as 10</div>
              <div>• Blackjack (21 with 2 cards) pays 2.5x</div>
              <div>• Regular win pays 2x</div>
              <div>• Push (tie) returns your bet</div>
              <div>• Bust (over 21) loses your bet</div>
            </div>
          </div>

          {/* Game History */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6">
            <h3 className="text-xl font-bold text-white mb-4">📊 Recent Games</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gameHistory.length === 0 ? (
                <div className="text-white opacity-75 text-center py-4">
                  No games yet. Start playing!
                </div>
              ) : (
                gameHistory.map((game, index) => (
                  <div key={index} className="bg-black bg-opacity-30 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm text-white">
                        You: {game.playerValue} | Dealer: {game.dealerValue}
                      </div>
                      <div className={`font-bold ${game.winAmount >= game.betAmount ? 'text-green-400' : 'text-red-400'}`}>
                        {game.winAmount > 0 ? `+$${game.winAmount.toFixed(2)}` : `-$${game.betAmount.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="text-xs text-white opacity-75">{game.result}</div>
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