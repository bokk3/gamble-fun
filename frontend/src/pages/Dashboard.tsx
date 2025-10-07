import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gameService, Game } from '../services/gameService';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const gamesData = await gameService.getGames();
      setGames(gamesData);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGameIcon = (type: string) => {
    switch (type) {
      case 'slots': return '🎰';
      case 'blackjack': return '🂡';
      case 'roulette': return '🎡';
      case 'dice': return '🎲';
      case 'crash': return '📈';
      default: return '🎮';
    }
  };

  const getGameDescription = (type: string) => {
    switch (type) {
      case 'slots': return 'Spin the reels for big wins!';
      case 'blackjack': return 'Beat the dealer to 21';
      case 'roulette': return 'Where will the ball land?';
      case 'dice': return 'Predict the roll outcome';
      case 'crash': return 'Cash out before the crash!';
      default: return 'Classic casino game';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading casino...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black bg-opacity-50 backdrop-blur-sm border-b border-white border-opacity-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                🎰 Gamble Fun Casino
              </h1>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-white">
                <span className="text-sm opacity-75">Balance:</span>
                <span className="text-xl font-bold text-green-400 ml-2">
                  ${user?.balance?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="text-white">
                <span className="text-sm opacity-75">Welcome,</span>
                <span className="font-semibold ml-1">{user?.username}</span>
              </div>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Choose Your Game</h2>
          <p className="text-white opacity-75">Select a game below to start playing and winning!</p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <Link
              key={game.id}
              to={`/games/${game.type}`}
              className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 hover:bg-opacity-20 transition-all duration-300 cursor-pointer transform hover:scale-105 block"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{getGameIcon(game.type)}</div>
                <h3 className="text-xl font-bold text-white mb-1">{game.name}</h3>
                <p className="text-white opacity-75 text-sm">{getGameDescription(game.type)}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white">
                  <span className="opacity-75">Min Bet:</span>
                  <span className="font-semibold text-green-400">${game.minBet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="opacity-75">Max Bet:</span>
                  <span className="font-semibold text-yellow-400">${game.maxBet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="opacity-75">House Edge:</span>
                  <span className="font-semibold text-red-400">{(game.houseEdge * 100).toFixed(2)}%</span>
                </div>
              </div>

              <button className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold py-3 px-4 rounded-lg transition-all duration-200">
                Play Now
              </button>
            </Link>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 text-center">
            <div className="text-3xl text-green-400 font-bold">{games.length}</div>
            <div className="text-white opacity-75">Games Available</div>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 text-center">
            <div className="text-3xl text-yellow-400 font-bold">100%</div>
            <div className="text-white opacity-75">Provably Fair</div>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20 text-center">
            <div className="text-3xl text-blue-400 font-bold">24/7</div>
            <div className="text-white opacity-75">Always Open</div>
          </div>
        </div>
      </main>

      {/* Game Modal - for future use */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">{selectedGame.name}</h3>
            <p className="text-gray-600 mb-4">Game will open here!</p>
            <button
              onClick={() => setSelectedGame(null)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;