-- Migration: Add refresh_tokens table for JWT refresh token management
-- This table stores refresh tokens for user authentication sessions

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, is_revoked, expires_at);

-- Update schema documentation
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for user authentication sessions';
COMMENT ON COLUMN refresh_tokens.user_id IS 'Reference to users table';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hashed refresh token value';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN refresh_tokens.created_at IS 'Token creation timestamp';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Whether the token has been revoked';
