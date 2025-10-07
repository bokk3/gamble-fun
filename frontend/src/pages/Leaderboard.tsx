import React from 'react';

const Leaderboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 text-center mb-8">🏆 Leaderboard</h1>
        
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-8 text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-bold text-white mb-4">Coming Soon!</h2>
          <p className="text-white opacity-75">Leaderboard feature is currently under development.</p>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;