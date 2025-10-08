-- Add last_login column to users table
ALTER TABLE users 
ADD COLUMN last_login TIMESTAMP NULL AFTER updated_at;

-- Add index for last_login for performance
ALTER TABLE users 
ADD INDEX idx_last_login (last_login);