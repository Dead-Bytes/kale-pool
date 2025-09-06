-- Migration: Complete User Authentication System
-- This migration adds the complete users table and updates farmers table
-- to support user authentication and role-based access

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    external_wallet VARCHAR(56) NOT NULL,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'verified', 'suspended')),
    role VARCHAR(20) DEFAULT 'farmer' CHECK (role IN ('farmer', 'pooler', 'admin')),
    entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Add user_id column to farmers table if it doesn't exist
ALTER TABLE farmers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);

-- Create index for farmers user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON farmers(user_id);

-- Add foreign key constraint for farmers.user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'farmers_user_id_fkey' 
        AND table_name = 'farmers'
    ) THEN
        ALTER TABLE farmers ADD CONSTRAINT farmers_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END $$;

-- Update schema documentation
COMMENT ON TABLE users IS 'User accounts for authentication and role management';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.password_hash IS 'Hashed password for authentication';
COMMENT ON COLUMN users.external_wallet IS 'User external Stellar wallet for payouts';
COMMENT ON COLUMN users.status IS 'User account status: registered, verified, suspended';
COMMENT ON COLUMN users.role IS 'User role: farmer, pooler, or admin';
COMMENT ON COLUMN users.entity_id IS 'UUID linking to farmer or pooler entity';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.verified_at IS 'Account verification timestamp';

COMMENT ON COLUMN farmers.user_id IS 'Reference to users table for authentication';
