import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bonusService, BonusStats } from '../services/bonusService';
import BonusDisplay from '../components/BonusDisplay';
import BuyCreditsModal from '../components/BuyCreditsModal';

interface UserProfileData {
  id: number;
  username: string;
  email: string;
  balance: number;
  totalWon: number;
  totalLost: number;
  createdAt: string;
}

interface UserPreferences {
  soundEnabled: boolean;
  notifications: boolean;
  autoRefreshBalance: boolean;
  theme: 'dark' | 'light';
  currency: 'USD' | 'EUR' | 'GBP';
}

const ProfileSettings: React.FC = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [bonusStats, setBonusStats] = useState<BonusStats | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    soundEnabled: true,
    notifications: true,
    autoRefreshBalance: true,
    theme: 'dark',
    currency: 'USD'
  });
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [creditPurchaseHistory, setCreditPurchaseHistory] = useState([]);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Load user profile from backend
      if (user) {
        try {
          const token = localStorage.getItem('casino_token');
          console.log('Using token for profile API:', token ? 'Token exists' : 'No token found');
          
          const response = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Profile API response:', result); // Debug log
            if (result.success && result.data) {
              setProfileData({
                id: result.data.id || user.id || 0,
                username: result.data.username || user.username || '',
                email: result.data.email || user.email || '',
                balance: result.data.balance || user.balance || 0,
                totalWon: result.data.totalWon || 0,
                totalLost: result.data.totalLost || 0,
                createdAt: result.data.createdAt || new Date().toISOString()
              });
            } else {
              console.warn('Profile API returned no data:', result);
              // Fallback to user context data
              setProfileData({
                id: user.id || 0,
                username: user.username || '',
                email: user.email || '',
                balance: user.balance || 0,
                totalWon: 0,
                totalLost: 0,
                createdAt: new Date().toISOString()
              });
            }
          } else {
            console.error('Profile API failed:', response.status, response.statusText);
            // Fallback to user context data
            setProfileData({
              id: user.id || 0,
              username: user.username || '',
              email: user.email || '',
              balance: user.balance || 0,
              totalWon: 0,
              totalLost: 0,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // Fallback to user context data
          setProfileData({
            id: user.id || 0,
            username: user.username || '',
            email: user.email || '',
            balance: user.balance || 0,
            totalWon: 0,
            totalLost: 0,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Load bonus stats
      const bonusResult = await bonusService.getBonusStats();
      if (bonusResult.success && bonusResult.data) {
        setBonusStats(bonusResult.data);
      }

      // Load user preferences from localStorage
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }

      // Load credit purchase history
      await loadCreditHistory();
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreditHistory = async () => {
    try {
      const response = await fetch('/api/credits/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCreditPurchaseHistory(result.data || []);
        }
      }
    } catch (error) {
      console.error('Error loading credit history:', error);
    }
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    const updatedPrefs = { ...preferences, [key]: value };
    setPreferences(updatedPrefs);
    localStorage.setItem('userPreferences', JSON.stringify(updatedPrefs));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      // This would call backend API to change password
      console.log('Password change requested');
      alert('Password change feature coming soon!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password');
    }
  };

  const handleCreditPurchaseSuccess = async (creditsAdded: number) => {
    // Refresh balance and history
    await loadProfileData();
    await loadCreditHistory();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLevelInfo = () => {
    if (!bonusStats) return { level: 1, levelName: 'Bronze Gambler', levelColor: '#CD7F32' };
    return bonusService.getBonusLevelInfo(bonusStats.bonusTokens);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-casino-primary to-casino-secondary p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-casino-secondary rounded mb-4"></div>
            <div className="h-64 bg-casino-secondary rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const levelInfo = getLevelInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-casino-primary to-casino-secondary p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-casino-accent hover:bg-casino-accent/80 px-6 py-3 rounded-lg text-white transition-all duration-300"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white">Profile Settings</h1>
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-casino-secondary border border-casino-accent/30 rounded-xl p-4 mb-6">
              <div className="space-y-2">
                {[
                  { id: 'overview', label: 'Overview', icon: '👤' },
                  { id: 'bonus', label: 'Bonus Stats', icon: '🎁' },
                  { id: 'credits', label: 'Buy Credits', icon: '💰' },
                  { id: 'settings', label: 'Settings', icon: '⚙️' },
                  { id: 'security', label: 'Security', icon: '🔒' },
                  { id: 'history', label: 'History', icon: '📊' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      activeTab === tab.id 
                        ? 'bg-casino-accent text-white' 
                        : 'text-gray-300 hover:bg-casino-primary hover:text-white'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Bonus Display */}
            <BonusDisplay gameId={1} className="mb-4" />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-casino-secondary border border-casino-accent/30 rounded-xl p-6">
              
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Account Overview</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Profile Info Card */}
                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4">Profile Information</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-gray-400">Username:</span>
                          <span className="text-white ml-2 font-medium">{profileData?.username}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Email:</span>
                          <span className="text-white ml-2 font-medium">{profileData?.email || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Member Since:</span>
                          <span className="text-white ml-2 font-medium">
                            {profileData?.createdAt ? formatDate(profileData.createdAt) : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <span className="text-casino-gold ml-2 font-medium" style={{ color: levelInfo.levelColor }}>
                            {levelInfo.levelName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Account Stats Card */}
                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4">Account Statistics</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Balance:</span>
                          <span className="text-casino-green font-bold">${profileData?.balance.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Won:</span>
                          <span className="text-casino-green font-bold">${profileData?.totalWon.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Lost:</span>
                          <span className="text-casino-accent font-bold">${profileData?.totalLost.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Profit:</span>
                          <span className={`font-bold ${
                            (profileData?.totalWon || 0) - (profileData?.totalLost || 0) >= 0 
                              ? 'text-casino-green' 
                              : 'text-casino-accent'
                          }`}>
                            ${((profileData?.totalWon || 0) - (profileData?.totalLost || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                    <div className="text-gray-400 text-center py-8">
                      Recent activity tracking coming soon...
                    </div>
                  </div>
                </div>
              )}

              {/* Bonus Stats Tab */}
              {activeTab === 'bonus' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Bonus Statistics</h2>
                  
                  {bonusStats ? (
                    <div>
                      {/* EXP Stats Section */}
                      <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 rounded-xl p-6 mb-8 border-2 border-purple-500">
                        <h3 className="text-xl font-bold text-white mb-4 text-center">🌟 Experience & Level Stats 🌟</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-casino-primary border border-purple-400/50 rounded-lg p-6 text-center">
                            <div className="text-4xl font-bold text-purple-400 mb-2">
                              {bonusStats.accountLevel}
                            </div>
                            <div className="text-gray-300 font-medium">Account Level</div>
                            <div className="text-xs text-purple-300 mt-1">Cross-Game Progress</div>
                          </div>
                          
                          <div className="bg-casino-primary border border-blue-400/50 rounded-lg p-6 text-center">
                            <div className="text-4xl font-bold text-blue-400 mb-2">
                              {bonusStats.totalXp.toLocaleString()}
                            </div>
                            <div className="text-gray-300 font-medium">Total EXP</div>
                            <div className="text-xs text-blue-300 mt-1">Lifetime Experience</div>
                          </div>
                          
                          <div className="bg-casino-primary border border-green-400/50 rounded-lg p-6 text-center">
                            <div className="text-4xl font-bold text-green-400 mb-2">
                              {bonusStats.globalMultiplier.toFixed(2)}x
                            </div>
                            <div className="text-gray-300 font-medium">Global Multiplier</div>
                            <div className="text-xs text-green-300 mt-1">Level Bonus</div>
                          </div>
                        </div>
                      </div>

                      {/* Regular Bonus Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-casino-gold mb-2">
                            {bonusStats.bonusTokens.toFixed(0)}
                          </div>
                          <div className="text-gray-400">Bonus Tokens</div>
                        </div>
                        
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-casino-green mb-2">
                            {bonusStats.totalBonusEarned.toFixed(0)}
                          </div>
                          <div className="text-gray-400">Total Earned</div>
                        </div>
                        
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-casino-accent mb-2">
                            {bonusStats.currentWinStreak}
                          </div>
                          <div className="text-gray-400">Win Streak</div>
                        </div>
                        
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-purple-400 mb-2">
                            {bonusStats.totalGamesPlayed}
                          </div>
                          <div className="text-gray-400">Games Played</div>
                        </div>
                        
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-yellow-400 mb-2">
                            {bonusStats.megaWinCount}
                          </div>
                          <div className="text-gray-400">Mega Wins</div>
                        </div>
                        
                        <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6 text-center">
                          <div className="text-3xl font-bold text-pink-400 mb-2">
                            {bonusStats.epicWinCount}
                          </div>
                          <div className="text-gray-400">Epic Wins</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-8">
                      Loading bonus statistics...
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Preferences</h2>
                  
                  <div className="space-y-6">
                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Audio & Visual</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Sound Effects</span>
                          <button
                            onClick={() => handlePreferenceChange('soundEnabled', !preferences.soundEnabled)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              preferences.soundEnabled ? 'bg-casino-green' : 'bg-gray-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              preferences.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Theme</span>
                          <select
                            value={preferences.theme}
                            onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                            className="bg-casino-secondary border border-casino-accent/30 rounded px-3 py-1 text-white"
                          >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Notifications</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Enable Notifications</span>
                          <button
                            onClick={() => handlePreferenceChange('notifications', !preferences.notifications)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              preferences.notifications ? 'bg-casino-green' : 'bg-gray-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Auto Refresh Balance</span>
                          <button
                            onClick={() => handlePreferenceChange('autoRefreshBalance', !preferences.autoRefreshBalance)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              preferences.autoRefreshBalance ? 'bg-casino-green' : 'bg-gray-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              preferences.autoRefreshBalance ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Security Settings</h2>
                  
                  <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-gray-300 mb-2">Current Password</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                          className="casino-input w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">New Password</label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                          className="casino-input w-full"
                          minLength={6}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                          className="casino-input w-full"
                          minLength={6}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="casino-button-primary px-6 py-3"
                      >
                        Update Password
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Credits Tab */}
              {activeTab === 'credits' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Buy Credits</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Current Balance Card */}
                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4">Current Balance</h3>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-casino-gold mb-2">
                          ${profileData?.balance.toFixed(2) || '0.00'}
                        </div>
                        <div className="text-gray-400">Available Credits</div>
                      </div>
                    </div>

                    {/* Quick Purchase */}
                    <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4">Quick Purchase</h3>
                      <button
                        onClick={() => setShowBuyCreditsModal(true)}
                        className="w-full casino-button-primary py-4 text-lg font-bold"
                      >
                        💰 Buy More Credits
                      </button>
                      <div className="text-xs text-gray-400 mt-2 text-center">
                        Secure payment • Instant delivery
                      </div>
                    </div>
                  </div>

                  {/* Purchase History */}
                  <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Recent Purchases</h3>
                    
                    {creditPurchaseHistory.length > 0 ? (
                      <div className="space-y-3">
                        {creditPurchaseHistory.slice(0, 5).map((purchase: any, index) => (
                          <div key={purchase.id || index} className="flex items-center justify-between p-4 bg-casino-secondary rounded-lg">
                            <div>
                              <div className="text-white font-medium">{purchase.packageName}</div>
                              <div className="text-gray-400 text-sm">
                                {new Date(purchase.createdAt).toLocaleDateString()} • {purchase.paymentMethod}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-casino-green font-bold">+{purchase.creditsPurchased} credits</div>
                              <div className="text-gray-400 text-sm">${purchase.amountPaid}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-center py-8">
                        <div className="text-4xl mb-4">💳</div>
                        <div className="text-lg mb-2">No purchases yet</div>
                        <div className="text-sm">Buy your first credit package to get started!</div>
                        <button
                          onClick={() => setShowBuyCreditsModal(true)}
                          className="casino-button-primary px-6 py-3 mt-4"
                        >
                          Buy Credits Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>
                  
                  <div className="bg-casino-primary border border-casino-accent/20 rounded-lg p-6">
                    <div className="text-gray-400 text-center py-8">
                      Transaction history coming soon...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        isOpen={showBuyCreditsModal}
        onClose={() => setShowBuyCreditsModal(false)}
        onSuccess={handleCreditPurchaseSuccess}
      />
    </div>
  );
};

export default ProfileSettings;