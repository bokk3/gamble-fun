import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBonus, setShowBonus] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!formData.username.match(/^[a-zA-Z0-9]+$/)) {
      setError('Username can only contain letters and numbers');
      return;
    }

    setIsLoading(true);

    try {
      const success = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      
      if (success) {
        setShowBonus(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000); // Show bonus message for 3 seconds
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showBonus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="casino-card max-w-md w-full mx-4 p-8 text-center">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h1 className="casino-font text-3xl font-bold text-casino-gold mb-4">
            Welcome to Gamble Fun!
          </h1>
          <div className="bg-green-600/20 border-2 border-green-400 rounded-xl p-6 mb-6">
            <div className="text-4xl mb-2">💰</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">$500.00</h2>
            <p className="text-green-300">Welcome Bonus Added!</p>
          </div>
          <p className="text-gray-300 mb-4">
            Your account has been created successfully and you've received a generous welcome bonus!
          </p>
          <div className="flex items-center justify-center text-casino-accent">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-casino-accent mr-2"></div>
            Redirecting to dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="casino-card max-w-md w-full mx-4 p-8">
        <div className="text-center mb-8">
          <h1 className="casino-font text-3xl font-bold text-casino-gold mb-2">
            🎰 Join the Fun!
          </h1>
          <p className="text-gray-300">Create your account and get started</p>
        </div>

        {/* Welcome Bonus Banner */}
        <div className="bg-gradient-to-r from-green-600/20 to-yellow-600/20 border-2 border-green-400 rounded-xl p-4 mb-6 text-center">
          <div className="text-3xl mb-2">🎁</div>
          <h3 className="text-xl font-bold text-green-400 mb-1">$500 Welcome Bonus!</h3>
          <p className="text-sm text-green-300">Get $500 free credits when you sign up today!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username *
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="casino-input w-full"
              placeholder="Choose a username (letters and numbers only)"
              required
              disabled={isLoading}
              minLength={3}
              maxLength={30}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="casino-input w-full"
              placeholder="Enter your email address"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="casino-input w-full"
              placeholder="Create a password (min 6 characters)"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="casino-input w-full"
              placeholder="Confirm your password"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="casino-button w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Account...
              </div>
            ) : (
              '🎉 Create Account & Get $500 Bonus!'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-casino-accent hover:text-casino-gold transition-colors">
              Sign in here
            </Link>
          </p>
        </div>

        {/* Daily Login Bonus Info */}
        <div className="mt-6 p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg">
          <div className="text-center">
            <div className="text-2xl mb-2">💎</div>
            <h4 className="text-sm font-bold text-blue-300 mb-1">Daily Login Bonus</h4>
            <p className="text-xs text-blue-200">
              Come back daily to earn $50 bonus credits!
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our terms of service and confirm you are 18+ years old.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;