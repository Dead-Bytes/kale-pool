-- Migration: Add last_login_at column to users table
-- This adds tracking for when users last logged in

-- Add last_login_at column for tracking user login timestamps
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster login tracking queries
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);

-- Update schema documentation
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the user last login';
