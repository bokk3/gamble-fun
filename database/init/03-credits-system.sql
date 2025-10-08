-- Credit Purchase System Tables

-- Create credit_purchases table for tracking all credit purchases
CREATE TABLE IF NOT EXISTS credit_purchases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    package_id VARCHAR(50) NOT NULL,
    package_name VARCHAR(100) NOT NULL,
    credits_purchased DECIMAL(18,2) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method ENUM('card', 'paypal', 'crypto', 'apple') NOT NULL,
    payment_id VARCHAR(255) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_payment_method (payment_method),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create payment_methods table for storing available payment options
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    method_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    min_amount DECIMAL(10,2) DEFAULT 5.00,
    max_amount DECIMAL(10,2) DEFAULT 1000.00,
    processing_fee_percent DECIMAL(5,4) DEFAULT 0.0000,
    processing_fee_fixed DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_method_id (method_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default payment methods
INSERT INTO payment_methods (method_id, name, description, icon, processing_fee_percent) VALUES
('card', 'Credit/Debit Card', 'Visa, MasterCard, American Express', '💳', 0.029),
('paypal', 'PayPal', 'Pay with your PayPal account', '🅿️', 0.034),
('crypto', 'Cryptocurrency', 'Bitcoin, Ethereum, and more', '₿', 0.015),
('apple', 'Apple Pay', 'Quick and secure payment', '🍎', 0.029)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    icon = VALUES(icon);

-- Create credit_packages table for managing available packages
CREATE TABLE IF NOT EXISTS credit_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    package_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    credits INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    bonus_credits INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_package_id (package_id),
    INDEX idx_is_active (is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default credit packages
INSERT INTO credit_packages (package_id, name, credits, price, bonus_credits, is_popular, display_order, description) VALUES
('starter', 'Starter Pack', 100, 9.99, 0, FALSE, 1, 'Perfect for beginners'),
('popular', 'Popular Pack', 500, 39.99, 50, TRUE, 2, 'Most popular choice with bonus credits'),
('premium', 'Premium Pack', 1000, 69.99, 150, FALSE, 3, 'Best value with substantial bonus'),
('vip', 'VIP Pack', 2500, 149.99, 500, FALSE, 4, 'Maximum credits for serious players')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    credits = VALUES(credits),
    price = VALUES(price),
    bonus_credits = VALUES(bonus_credits),
    is_popular = VALUES(is_popular),
    description = VALUES(description);

-- Add indexes to existing transactions table for better credit purchase queries
ALTER TABLE transactions 
ADD INDEX idx_type_user (type, user_id),
ADD INDEX idx_amount_created (amount, created_at);

-- Update users table to track total credits purchased (optional enhancement)
ALTER TABLE users 
ADD COLUMN total_credits_purchased DECIMAL(18,2) DEFAULT 0.00 AFTER total_lost,
ADD COLUMN last_credit_purchase TIMESTAMP NULL AFTER total_credits_purchased;