-- Migration: Add block data fields to block_operations table
-- This adds entropy and other block metadata fields needed for proper work execution

ALTER TABLE block_operations 
ADD COLUMN IF NOT EXISTS entropy TEXT,
ADD COLUMN IF NOT EXISTS block_hash TEXT,
ADD COLUMN IF NOT EXISTS previous_hash TEXT,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS block_age INTEGER,
ADD COLUMN IF NOT EXISTS plantable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_stake BIGINT,
ADD COLUMN IF NOT EXISTS max_stake BIGINT,
ADD COLUMN IF NOT EXISTS min_zeros INTEGER,
ADD COLUMN IF NOT EXISTS max_zeros INTEGER,
ADD COLUMN IF NOT EXISTS discovered_by UUID REFERENCES poolers(id),
ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster entropy lookups
CREATE INDEX IF NOT EXISTS idx_block_operations_entropy ON block_operations(entropy);
CREATE INDEX IF NOT EXISTS idx_block_operations_discovered_at ON block_operations(discovered_at);

-- Update schema documentation
COMMENT ON COLUMN block_operations.entropy IS 'Block entropy value for work computation';
COMMENT ON COLUMN block_operations.block_hash IS 'Current block hash';
COMMENT ON COLUMN block_operations.previous_hash IS 'Previous block hash';
COMMENT ON COLUMN block_operations.timestamp IS 'Block timestamp';
COMMENT ON COLUMN block_operations.block_age IS 'Block age in seconds at discovery';
COMMENT ON COLUMN block_operations.plantable IS 'Whether block was plantable at discovery';
COMMENT ON COLUMN block_operations.discovered_by IS 'Pooler that discovered this block';
COMMENT ON COLUMN block_operations.discovered_at IS 'When the block was discovered';
