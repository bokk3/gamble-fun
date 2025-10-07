-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    balance DECIMAL(18,2) DEFAULT 100.00,
    total_won DECIMAL(18,2) DEFAULT 0.00,
    total_lost DECIMAL(18,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('slots', 'blackjack', 'roulette', 'dice', 'crash') NOT NULL,
    min_bet DECIMAL(10,2) DEFAULT 1.00,
    max_bet DECIMAL(10,2) DEFAULT 1000.00,
    house_edge DECIMAL(5,4) DEFAULT 0.0200,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    total_bet DECIMAL(18,2) DEFAULT 0.00,
    total_won DECIMAL(18,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_session_token (session_token),
    INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create bets table
CREATE TABLE IF NOT EXISTS bets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    session_id INT,
    bet_amount DECIMAL(18,2) NOT NULL,
    win_amount DECIMAL(18,2) DEFAULT 0.00,
    multiplier DECIMAL(8,4) DEFAULT 0.0000,
    game_data JSON,
    server_seed VARCHAR(64) NOT NULL,
    client_seed VARCHAR(64) NOT NULL,
    nonce INT NOT NULL,
    result_hash VARCHAR(64) NOT NULL,
    is_win BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_win (is_win)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create transactions table for balance changes
CREATE TABLE IF NOT EXISTS transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    bet_id INT,
    type ENUM('deposit', 'withdrawal', 'bet', 'win', 'bonus') NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    balance_before DECIMAL(18,2) NOT NULL,
    balance_after DECIMAL(18,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default games
INSERT INTO games (name, type, min_bet, max_bet, house_edge) VALUES
('Lucky Slots', 'slots', 0.10, 100.00, 0.0300),
('Blackjack 21', 'blackjack', 1.00, 500.00, 0.0050),
('European Roulette', 'roulette', 0.50, 1000.00, 0.0270),
('Dice Roll', 'dice', 0.01, 50.00, 0.0100),
('Crash Game', 'crash', 0.10, 200.00, 0.0100);

-- Create demo user (password: demo123) - bcrypt hash for demo123
INSERT INTO users (username, password_hash, email, balance) VALUES
('demo', '$2b$10$Ml4Z1sj0Jdo3p304U0Eqjukau9po71SAUSrrmu/y3FQYGQogtV0Ty', 'demo@gamblem-fun.com', 1000.00),
('admin', '$2b$10$Ml4Z1sj0Jdo3p304U0Eqjukau9po71SAUSrrmu/y3FQYGQogtV0Ty', 'admin@gamble-fun.com', 10000.00);