-- Migration: Add exit_count column to farmers table
-- This tracks how many times a farmer has exited from pools

-- Add exit_count column for tracking farmer pool exits
ALTER TABLE farmers 
ADD COLUMN IF NOT EXISTS exit_count INTEGER DEFAULT 0;

-- Create index for faster exit count queries
CREATE INDEX IF NOT EXISTS idx_farmers_exit_count ON farmers(exit_count);

-- Update schema documentation
COMMENT ON COLUMN farmers.exit_count IS 'Number of times farmer has exited from pools';
