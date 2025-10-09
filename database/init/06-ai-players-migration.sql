-- Migration to allow AI players in poker_seats
-- Remove the foreign key constraint for user_id to allow negative values for AI players

-- Drop the foreign key constraint
ALTER TABLE poker_seats DROP FOREIGN KEY poker_seats_ibfk_3;

-- Add a new constraint that only applies to positive user_ids (real users)
ALTER TABLE poker_seats 
ADD CONSTRAINT poker_seats_user_fk 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- However, MySQL doesn't support conditional foreign keys, so we need a different approach
-- Let's drop the constraint and handle validation in application logic instead

ALTER TABLE poker_seats DROP FOREIGN KEY poker_seats_user_fk;

-- Add a check constraint to ensure user_id is either positive (real user) or negative (AI)
-- This gives us flexibility while maintaining data integrity
ALTER TABLE poker_seats 
ADD CONSTRAINT chk_user_id 
CHECK (user_id != 0);

-- Also ensure we can identify AI vs real players clearly
ALTER TABLE poker_seats 
ADD COLUMN is_ai_player BOOLEAN GENERATED ALWAYS AS (user_id < 0) STORED;