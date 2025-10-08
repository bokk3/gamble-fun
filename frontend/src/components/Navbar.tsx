import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AudioControls from './AudioControls';
import { audioService } from '../services/audioService';

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated, isBalanceLoading } = useAuth();
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(audioService.getSettings().enabled);

  return (
    <nav className="bg-casino-primary border-b border-casino-accent/30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="casino-font text-2xl font-bold text-casino-gold">
            🎰 Gamble Fun
          </Link>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-casino-gold">
                    💰 ${user?.balance?.toFixed(2) || '0.00'}
                  </span>
                  {isBalanceLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-casino-gold border-t-transparent"></div>
                  )}
                </div>
                <span className="text-gray-300">
                  Welcome, {user?.username}!
                </span>
                <button
                  onClick={() => {
                    audioService.playButtonClick();
                    setShowAudioControls(true);
                  }}
                  className={`text-2xl transition-colors ${
                    audioEnabled ? 'text-casino-gold hover:text-casino-accent' : 'text-gray-500 hover:text-gray-400'
                  }`}
                  title="Audio Settings"
                >
                  {audioEnabled ? '🔊' : '🔇'}
                </button>
                <Link
                  to="/dashboard"
                  className="text-casino-accent hover:text-casino-gold transition-colors"
                  onClick={() => audioService.playButtonClick()}
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="text-casino-accent hover:text-casino-gold transition-colors"
                  onClick={() => audioService.playButtonClick()}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    audioService.playButtonClick();
                    logout();
                  }}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-casino-accent hover:text-casino-gold transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="casino-button-secondary px-4 py-2"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      <AudioControls 
        isOpen={showAudioControls} 
        onClose={() => {
          setShowAudioControls(false);
          setAudioEnabled(audioService.getSettings().enabled);
        }} 
      />
    </nav>
  );
};

export default Navbar;