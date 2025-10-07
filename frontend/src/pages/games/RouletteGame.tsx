import React from 'react';
import { useNavigate } from 'react-router-dom';

const RouletteGame: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white transition-colors"
          >
            ← Back to Casino
          </button>
          <h1 className="text-3xl font-bold text-yellow-400">🎡 European Roulette</h1>
        </div>
        
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-8 text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-bold text-white mb-4">Coming Soon!</h2>
          <p className="text-white opacity-75">This game is currently under development.</p>
        </div>
      </div>
    </div>
  );
};

export default RouletteGame;