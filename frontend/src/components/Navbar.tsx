import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated, isBalanceLoading } = useAuth();

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
                <Link
                  to="/dashboard"
                  className="text-casino-accent hover:text-casino-gold transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
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
    </nav>
  );
};

export default Navbar;