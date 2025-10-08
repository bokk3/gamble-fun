import React, { useState, useEffect } from 'react';
import { bonusService, BonusStats, BonusTransaction } from '../services/bonusService';

interface BonusDisplayProps {
  gameId: number;
  className?: string;
  showHistory?: boolean;
  onBonusUpdate?: (bonusStats: BonusStats) => void;
}

const BonusDisplay: React.FC<BonusDisplayProps> = ({ 
  gameId, 
  className = '', 
  showHistory = false,
  onBonusUpdate 
}) => {
  const [bonusStats, setBonusStats] = useState<BonusStats | null>(null);
  const [bonusHistory, setBonusHistory] = useState<BonusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    loadBonusData();
    // Refresh bonus data every 30 seconds
    const interval = setInterval(loadBonusData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadBonusData = async () => {
    try {
      const statsResult = await bonusService.getBonusStats();
      if (statsResult.success && statsResult.data) {
        setBonusStats(statsResult.data);
        onBonusUpdate?.(statsResult.data);
      }

      if (showHistory) {
        const historyResult = await bonusService.getBonusHistory(10);
        if (historyResult.success && historyResult.data) {
          setBonusHistory(historyResult.data);
        }
      }
    } catch (error) {
      console.error('Error loading bonus data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpendTokens = async (
    transactionType: string,
    amount: number,
    description: string,
    triggerData: any = {}
  ) => {
    try {
      const result = await bonusService.spendBonusTokens(
        gameId,
        transactionType,
        amount,
        triggerData,
        description
      );

      if (result.success) {
        // Refresh bonus stats after spending
        await loadBonusData();
        return true;
      } else {
        alert(result.message);
        return false;
      }
    } catch (error) {
      console.error('Error spending bonus tokens:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <div className={`bonus-display ${className}`}>
        <div className="animate-pulse">
          <div className="h-16 bg-casino-secondary rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!bonusStats) {
    return null;
  }

  const levelInfo = bonusService.getBonusLevelInfo(bonusStats.bonusTokens);

  return (
    <div className={`bonus-display ${className}`}>
      {/* Main Bonus Stats Card */}
      <div className="bg-gradient-to-br from-casino-primary to-casino-secondary border border-casino-accent/30 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <h3 className="text-lg font-bold text-white">Bonus Bank</h3>
          </div>
          {showHistory && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-casino-accent hover:text-casino-gold transition-colors text-sm"
            >
              History
            </button>
          )}
        </div>

        {/* Token Balance */}
        <div className="text-center mb-3">
          <div className="text-3xl font-bold text-casino-gold">
            {bonusStats.bonusTokens.toFixed(0)}
          </div>
          <div className="text-sm text-gray-300">Bonus Tokens</div>
        </div>

        {/* Level Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span style={{ color: levelInfo.levelColor }} className="font-semibold">
              {levelInfo.levelName}
            </span>
            <span className="text-gray-300">
              Level {levelInfo.level}
            </span>
          </div>
          {levelInfo.tokensToNext > 0 && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-casino-accent to-casino-gold h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.max(10, (bonusStats.bonusTokens % 100) || 10)}%` 
                }}
              />
            </div>
          )}
          {levelInfo.tokensToNext > 0 && (
            <div className="text-xs text-gray-400 mt-1 text-center">
              {levelInfo.tokensToNext} tokens to next level
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-center">
            <div className="text-casino-green font-semibold">
              {bonusStats.totalBonusEarned.toFixed(0)}
            </div>
            <div className="text-gray-400 text-xs">Total Earned</div>
          </div>
          <div className="text-center">
            <div className="text-casino-accent font-semibold">
              {bonusStats.currentWinStreak}
            </div>
            <div className="text-gray-400 text-xs">Win Streak</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 space-y-2">
          <BonusActionButton
            icon="🎰"
            label="Auto-Spin (10 tokens)"
            cost={10}
            currentTokens={bonusStats.bonusTokens}
            onClick={() => handleSpendTokens('spent_auto_spin', 10, 'Purchase 10 auto-spins', { spins: 10 })}
          />
          <BonusActionButton
            icon="⚡"
            label="2x Multiplier (25 tokens)"
            cost={25}
            currentTokens={bonusStats.bonusTokens}
            onClick={() => handleSpendTokens('spent_multiplier', 25, 'Purchase 2x win multiplier', { multiplier: 2 })}
          />
        </div>
      </div>

      {/* Bonus History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-casino-primary border border-casino-accent/50 rounded-xl max-w-md w-full max-h-96 overflow-hidden">
            <div className="p-4 border-b border-casino-accent/30 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Bonus History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-64">
              {bonusHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No bonus transactions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {bonusHistory.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-2 bg-casino-secondary rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          {bonusService.formatTransactionType(transaction.transactionType)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {transaction.description}
                        </div>
                      </div>
                      <div className={`font-bold ${
                        transaction.bonusAmount > 0 ? 'text-casino-green' : 'text-casino-accent'
                      }`}>
                        {transaction.bonusAmount > 0 ? '+' : ''}{transaction.bonusAmount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BonusActionButtonProps {
  icon: string;
  label: string;
  cost: number;
  currentTokens: number;
  onClick: () => Promise<boolean>;
}

const BonusActionButton: React.FC<BonusActionButtonProps> = ({
  icon,
  label,
  cost,
  currentTokens,
  onClick
}) => {
  const [loading, setLoading] = useState(false);
  const canAfford = currentTokens >= cost;

  const handleClick = async () => {
    if (!canAfford || loading) return;
    
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!canAfford || loading}
      className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
        canAfford && !loading
          ? 'bg-casino-accent hover:bg-casino-accent/80 text-white'
          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
      ) : (
        <span className="text-xs">{cost} 🎁</span>
      )}
    </button>
  );
};

export default BonusDisplay;