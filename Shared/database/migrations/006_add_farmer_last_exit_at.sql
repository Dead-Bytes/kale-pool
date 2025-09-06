-- Migration: Add last_exit_at column to farmers table
-- This tracks when farmers last exited from a pool

-- Add last_exit_at column for tracking farmer pool exits
ALTER TABLE farmers 
ADD COLUMN IF NOT EXISTS last_exit_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster exit tracking queries
CREATE INDEX IF NOT EXISTS idx_farmers_last_exit_at ON farmers(last_exit_at);

-- Update schema documentation
COMMENT ON COLUMN farmers.last_exit_at IS 'Timestamp when farmer last exited from a pool';
