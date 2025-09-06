-- Migration: Add authentication fields to users table
-- This adds password_hash, role, and entity_id columns needed for user authentication and role management

-- Add password hash column for storing hashed passwords
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add role column to distinguish between farmers, poolers, and admins
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'farmer';

-- Add entity_id column to link users to their specific entity (farmer or pooler)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index for faster entity_id lookups
CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);

-- Add constraint to ensure role values are valid
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS check_users_role 
CHECK (role IN ('farmer', 'pooler', 'admin'));

-- Update schema documentation
COMMENT ON COLUMN users.password_hash IS 'Hashed password for user authentication';
COMMENT ON COLUMN users.role IS 'User role: farmer, pooler, or admin';
COMMENT ON COLUMN users.entity_id IS 'UUID linking to farmer or pooler entity';
