-- Cross-Game Bonus System Tables

-- Create user_bonus_stats table for account-wide bonus tracking
CREATE TABLE IF NOT EXISTS user_bonus_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    
    -- Bonus Bank System
    bonus_tokens DECIMAL(18,2) DEFAULT 0.00,
    total_bonus_earned DECIMAL(18,2) DEFAULT 0.00,
    total_bonus_spent DECIMAL(18,2) DEFAULT 0.00,
    
    -- Cross-Game Achievement Tracking
    total_games_played INT DEFAULT 0,
    total_auto_spins INT DEFAULT 0,
    perfect_sessions INT DEFAULT 0,
    jackpot_hits INT DEFAULT 0,
    
    -- Bonus Multiplier System (account-wide)
    account_level INT DEFAULT 1,
    total_xp DECIMAL(18,2) DEFAULT 0.00,
    global_multiplier DECIMAL(6,4) DEFAULT 1.0000,
    
    -- Streak Tracking
    current_win_streak INT DEFAULT 0,
    longest_win_streak INT DEFAULT 0,
    current_bonus_streak INT DEFAULT 0,
    
    -- Milestone Achievements
    mega_win_count INT DEFAULT 0, -- 10x+ multiplier wins
    epic_win_count INT DEFAULT 0, -- 50x+ multiplier wins
    legendary_win_count INT DEFAULT 0, -- 100x+ multiplier wins
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_bonus_earned TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_account_level (account_level),
    INDEX idx_bonus_tokens (bonus_tokens),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create bonus_transactions table for detailed bonus history
CREATE TABLE IF NOT EXISTS bonus_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NULL,
    bet_id INT NULL,
    
    -- Transaction Details
    transaction_type ENUM(
        'earned_spin', 'earned_win', 'earned_streak', 'earned_milestone',
        'earned_daily', 'earned_level_up', 'earned_achievement',
        'spent_auto_spin', 'spent_multiplier', 'spent_insurance'
    ) NOT NULL,
    
    bonus_amount DECIMAL(18,2) NOT NULL, -- positive for earned, negative for spent
    balance_before DECIMAL(18,2) NOT NULL,
    balance_after DECIMAL(18,2) NOT NULL,
    
    -- Context Data
    trigger_data JSON, -- Store game-specific context like win amount, multiplier, etc.
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create game_specific_stats table for per-game bonus tracking
CREATE TABLE IF NOT EXISTS game_specific_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    
    -- Game-Specific Bonus Stats
    game_level INT DEFAULT 1,
    game_xp DECIMAL(18,2) DEFAULT 0.00,
    game_multiplier DECIMAL(6,4) DEFAULT 1.0000,
    
    -- Auto-Spin Specific Stats
    auto_spin_sessions INT DEFAULT 0,
    total_auto_spins INT DEFAULT 0,
    auto_spin_profit DECIMAL(18,2) DEFAULT 0.00,
    best_auto_spin_streak INT DEFAULT 0,
    
    -- Game Performance
    perfect_games INT DEFAULT 0,
    bonus_rounds_triggered INT DEFAULT 0,
    jackpots_won INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_game (user_id, game_id),
    INDEX idx_user_id (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_game_level (game_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize bonus stats for existing users
INSERT INTO user_bonus_stats (user_id, bonus_tokens, total_bonus_earned)
SELECT id, 100.00, 100.00 -- Give existing users 100 bonus tokens to start
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM user_bonus_stats WHERE user_bonus_stats.user_id = users.id
);

-- Initialize game-specific stats for existing users and all games
INSERT INTO game_specific_stats (user_id, game_id)
SELECT u.id, g.id
FROM users u
CROSS JOIN games g
WHERE NOT EXISTS (
    SELECT 1 FROM game_specific_stats gss 
    WHERE gss.user_id = u.id AND gss.game_id = g.id
);