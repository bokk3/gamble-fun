-- Poker Game Database Schema
-- Complete Texas Hold'em implementation with multiplayer support

-- Poker Tables (different stakes and configurations)
CREATE TABLE IF NOT EXISTS poker_tables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    table_type ENUM('cash', 'tournament', 'sit_n_go') DEFAULT 'cash',
    max_players INT DEFAULT 8,
    min_players INT DEFAULT 2,
    small_blind DECIMAL(10,2) NOT NULL,
    big_blind DECIMAL(10,2) NOT NULL,
    min_buy_in DECIMAL(18,2) NOT NULL,
    max_buy_in DECIMAL(18,2) NOT NULL,
    rake_percentage DECIMAL(5,4) DEFAULT 0.05, -- 5% rake
    max_rake DECIMAL(10,2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_table_type (table_type),
    INDEX idx_active (is_active),
    INDEX idx_stakes (small_blind, big_blind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Active Poker Games (current games in progress)
CREATE TABLE IF NOT EXISTS poker_games (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_id INT NOT NULL,
    game_state ENUM('waiting', 'dealing', 'pre_flop', 'flop', 'turn', 'river', 'showdown', 'finished') DEFAULT 'waiting',
    dealer_position INT DEFAULT 0,
    small_blind_position INT DEFAULT 1,
    big_blind_position INT DEFAULT 2,
    current_player_position INT,
    pot_amount DECIMAL(18,2) DEFAULT 0.00,
    community_cards JSON, -- Array of 5 community cards
    deck_state JSON, -- Remaining cards in deck
    hand_number INT DEFAULT 1,
    current_bet DECIMAL(18,2) DEFAULT 0.00,
    min_raise DECIMAL(18,2),
    betting_round ENUM('pre_flop', 'flop', 'turn', 'river') DEFAULT 'pre_flop',
    last_action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    
    FOREIGN KEY (table_id) REFERENCES poker_tables(id) ON DELETE CASCADE,
    
    INDEX idx_table_game (table_id, game_state),
    INDEX idx_game_state (game_state),
    INDEX idx_last_action (last_action_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player Seats (who's sitting where at each table)
CREATE TABLE IF NOT EXISTS poker_seats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_id INT NOT NULL,
    game_id INT,
    user_id INT NOT NULL,
    seat_position INT NOT NULL, -- 0-7 for 8-max tables
    chips DECIMAL(18,2) NOT NULL, -- Player's chip stack
    hole_cards JSON, -- Player's 2 hole cards (encrypted/hashed)
    is_active BOOLEAN DEFAULT TRUE,
    is_sitting_out BOOLEAN DEFAULT FALSE,
    last_action ENUM('fold', 'check', 'call', 'bet', 'raise', 'all_in') NULL,
    current_bet DECIMAL(18,2) DEFAULT 0.00,
    total_bet_this_hand DECIMAL(18,2) DEFAULT 0.00,
    is_all_in BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    
    FOREIGN KEY (table_id) REFERENCES poker_tables(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES poker_games(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_seat (table_id, seat_position, is_active),
    INDEX idx_table_seats (table_id, is_active),
    INDEX idx_user_seats (user_id, is_active),
    INDEX idx_game_seats (game_id, seat_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Poker Hands (completed hands history)
CREATE TABLE IF NOT EXISTS poker_hands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    table_id INT NOT NULL,
    hand_number INT NOT NULL,
    dealer_position INT NOT NULL,
    small_blind DECIMAL(10,2) NOT NULL,
    big_blind DECIMAL(10,2) NOT NULL,
    total_pot DECIMAL(18,2) NOT NULL,
    rake_amount DECIMAL(18,2) DEFAULT 0.00,
    community_cards JSON, -- Final 5 community cards
    winner_user_id INT,
    winning_hand JSON, -- Description of winning hand
    side_pots JSON, -- Side pot information for all-ins
    showdown_hands JSON, -- All revealed hands at showdown
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES poker_games(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES poker_tables(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_game_hands (game_id, hand_number),
    INDEX idx_table_hands (table_id, finished_at),
    INDEX idx_winner (winner_user_id),
    INDEX idx_finished (finished_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player Actions (betting history within each hand)
CREATE TABLE IF NOT EXISTS poker_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hand_id INT NOT NULL,
    user_id INT NOT NULL,
    seat_position INT NOT NULL,
    action_type ENUM('fold', 'check', 'call', 'bet', 'raise', 'all_in', 'blind', 'ante') NOT NULL,
    amount DECIMAL(18,2) DEFAULT 0.00,
    betting_round ENUM('pre_flop', 'flop', 'turn', 'river') NOT NULL,
    action_sequence INT NOT NULL, -- Order of actions within the round
    pot_size_before DECIMAL(18,2) NOT NULL,
    chips_before DECIMAL(18,2) NOT NULL,
    chips_after DECIMAL(18,2) NOT NULL,
    is_all_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (hand_id) REFERENCES poker_hands(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_hand_actions (hand_id, betting_round, action_sequence),
    INDEX idx_user_actions (user_id, created_at),
    INDEX idx_action_type (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tournament Tables (for tournament play)
CREATE TABLE IF NOT EXISTS poker_tournaments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    tournament_type ENUM('sit_n_go', 'scheduled', 'satellite') DEFAULT 'sit_n_go',
    buy_in DECIMAL(18,2) NOT NULL,
    entry_fee DECIMAL(18,2) NOT NULL,
    starting_chips INT DEFAULT 1500,
    max_players INT NOT NULL,
    min_players INT DEFAULT 2,
    blind_structure JSON, -- Blind level increases
    status ENUM('registering', 'running', 'finished', 'cancelled') DEFAULT 'registering',
    prize_pool DECIMAL(18,2) DEFAULT 0.00,
    prize_structure JSON, -- How prizes are distributed
    starts_at TIMESTAMP,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tournament_status (status, starts_at),
    INDEX idx_tournament_type (tournament_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tournament Registrations
CREATE TABLE IF NOT EXISTS poker_tournament_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tournament_id INT NOT NULL,
    user_id INT NOT NULL,
    table_id INT,
    seat_position INT,
    chips DECIMAL(18,2),
    position_finished INT, -- Final position (1st, 2nd, etc.)
    prize_won DECIMAL(18,2) DEFAULT 0.00,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eliminated_at TIMESTAMP NULL,
    
    FOREIGN KEY (tournament_id) REFERENCES poker_tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES poker_tables(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_registration (tournament_id, user_id),
    INDEX idx_tournament_players (tournament_id, eliminated_at),
    INDEX idx_user_tournaments (user_id, registered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Player Statistics (poker-specific stats)
CREATE TABLE IF NOT EXISTS poker_player_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    hands_played INT DEFAULT 0,
    hands_won INT DEFAULT 0,
    total_winnings DECIMAL(18,2) DEFAULT 0.00,
    total_losses DECIMAL(18,2) DEFAULT 0.00,
    biggest_pot_won DECIMAL(18,2) DEFAULT 0.00,
    tournaments_played INT DEFAULT 0,
    tournaments_won INT DEFAULT 0,
    cash_games_played INT DEFAULT 0,
    voluntarily_put_in_pot DECIMAL(5,4) DEFAULT 0.0000, -- VPIP %
    preflop_raise DECIMAL(5,4) DEFAULT 0.0000, -- PFR %
    aggression_factor DECIMAL(8,4) DEFAULT 0.0000,
    showdown_win_rate DECIMAL(5,4) DEFAULT 0.0000,
    bb_per_100_hands DECIMAL(10,4) DEFAULT 0.0000, -- Big blinds won per 100 hands
    royal_flushes INT DEFAULT 0,
    straight_flushes INT DEFAULT 0,
    four_of_a_kinds INT DEFAULT 0,
    full_houses INT DEFAULT 0,
    flushes INT DEFAULT 0,
    straights INT DEFAULT 0,
    three_of_a_kinds INT DEFAULT 0,
    two_pairs INT DEFAULT 0,
    pairs INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_stats (user_id),
    INDEX idx_winnings (total_winnings),
    INDEX idx_hands_played (hands_played)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Players (computer opponents)
CREATE TABLE IF NOT EXISTS poker_ai_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255),
    playing_style ENUM('tight_passive', 'tight_aggressive', 'loose_passive', 'loose_aggressive', 'maniac') DEFAULT 'tight_aggressive',
    skill_level ENUM('beginner', 'intermediate', 'advanced', 'expert', 'professional') DEFAULT 'intermediate',
    aggression_level DECIMAL(3,2) DEFAULT 1.50, -- 0.5 = passive, 3.0+ = very aggressive
    bluff_frequency DECIMAL(5,4) DEFAULT 0.1500, -- 15% bluff rate
    fold_to_pressure DECIMAL(5,4) DEFAULT 0.7000, -- 70% fold rate under pressure
    bankroll DECIMAL(18,2) DEFAULT 10000.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_active_ai (is_active, skill_level),
    INDEX idx_playing_style (playing_style)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some default poker tables
INSERT INTO poker_tables (name, small_blind, big_blind, min_buy_in, max_buy_in) VALUES
('Micro Stakes NL2', 0.01, 0.02, 0.40, 4.00),
('Low Stakes NL10', 0.05, 0.10, 2.00, 20.00),
('Mid Stakes NL25', 0.10, 0.25, 5.00, 50.00),
('High Stakes NL100', 0.50, 1.00, 20.00, 200.00),
('VIP Table NL500', 2.50, 5.00, 100.00, 1000.00),
('Whale Table NL1000', 5.00, 10.00, 200.00, 2000.00);

-- Insert AI players with different personalities
INSERT INTO poker_ai_players (name, playing_style, skill_level, aggression_level, bluff_frequency) VALUES
('Charlie "Tight" Thompson', 'tight_aggressive', 'advanced', 2.10, 0.1200),
('Loose Lucy', 'loose_aggressive', 'intermediate', 2.80, 0.2500),
('Rock Solid Rick', 'tight_passive', 'beginner', 0.80, 0.0500),
('Maniac Mike', 'maniac', 'intermediate', 3.50, 0.4000),
('Pro Player Paul', 'tight_aggressive', 'professional', 2.00, 0.1800),
('Bluff Master Betty', 'loose_aggressive', 'expert', 3.20, 0.3500),
('Conservative Carl', 'tight_passive', 'intermediate', 0.60, 0.0300),
('Wild West Willie', 'maniac', 'advanced', 4.00, 0.5000);

-- First, modify the games table to include poker type
ALTER TABLE games MODIFY COLUMN type ENUM('slots', 'blackjack', 'roulette', 'dice', 'crash', 'poker') NOT NULL;

-- Add poker game type to the updated games table
INSERT INTO games (name, type, min_bet, max_bet, house_edge) VALUES
('Texas Hold\'em Poker', 'poker', 0.02, 2000.00, 0.0500);