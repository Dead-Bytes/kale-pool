-- KALE Pool Mining: Farmer Exit & Reward Splitting System
-- Migration 002: Complete exit functionality with multi-wallet payouts

-- =====================================================
-- 1. EXIT SPLITS TABLE - Core exit processing
-- =====================================================

CREATE TABLE exit_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id), 
    contract_id UUID REFERENCES pool_contracts(id),
    
    -- Financial details (all amounts in KALE stroops)
    total_rewards BIGINT NOT NULL CHECK (total_rewards >= 0),
    farmer_share BIGINT NOT NULL CHECK (farmer_share >= 0),
    pooler_share BIGINT NOT NULL CHECK (pooler_share >= 0),
    platform_fee BIGINT NOT NULL CHECK (platform_fee >= 0),
    
    -- Contract terms at time of exit (for audit trail)
    reward_split DECIMAL(5,4) NOT NULL CHECK (reward_split >= 0 AND reward_split <= 1),
    platform_fee_rate DECIMAL(5,4) NOT NULL CHECK (platform_fee_rate >= 0 AND platform_fee_rate <= 1),
    
    -- Wallet information
    farmer_external_wallet VARCHAR(56) NOT NULL,
    farmer_custodial_wallet VARCHAR(56) NOT NULL,
    pooler_wallet VARCHAR(56) NOT NULL,
    platform_wallet VARCHAR(56) NOT NULL DEFAULT 'GPLATFORMWALLET123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    
    -- Transaction hashes (null until executed)
    farmer_tx_hash VARCHAR(64),
    pooler_tx_hash VARCHAR(64),
    platform_tx_hash VARCHAR(64),
    
    -- Block and harvest tracking
    blocks_included INTEGER NOT NULL DEFAULT 0,
    harvests_included INTEGER NOT NULL DEFAULT 0,
    first_harvest_date TIMESTAMP,
    last_harvest_date TIMESTAMP,
    
    -- Status and timing
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Error handling and retry logic
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_retry_at TIMESTAMP,
    
    -- Metadata
    exit_reason VARCHAR(100) DEFAULT 'farmer_initiated',
    notes TEXT,
    
    -- Financial validation constraint
    CONSTRAINT valid_split_amounts CHECK (farmer_share + pooler_share + platform_fee = total_rewards)
);

-- Indexes for exit_splits
CREATE INDEX idx_exit_splits_farmer ON exit_splits(farmer_id);
CREATE INDEX idx_exit_splits_pooler ON exit_splits(pooler_id);
CREATE INDEX idx_exit_splits_contract ON exit_splits(contract_id);
CREATE INDEX idx_exit_splits_status ON exit_splits(status);
CREATE INDEX idx_exit_splits_initiated ON exit_splits(initiated_at DESC);
CREATE INDEX idx_exit_splits_retry ON exit_splits(status, retry_count) WHERE status = 'failed';

-- =====================================================
-- 2. UPDATE EXISTING TABLES FOR EXIT TRACKING
-- =====================================================

-- Add exit tracking to harvests table
ALTER TABLE harvests ADD COLUMN IF NOT EXISTS included_in_exit BOOLEAN DEFAULT false;
ALTER TABLE harvests ADD COLUMN IF NOT EXISTS exit_split_id UUID REFERENCES exit_splits(id);

-- Index for exit processing queries
CREATE INDEX IF NOT EXISTS idx_harvests_exit_status ON harvests(farmer_id, included_in_exit) WHERE included_in_exit = false;
CREATE INDEX IF NOT EXISTS idx_harvests_exit_split ON harvests(exit_split_id) WHERE exit_split_id IS NOT NULL;

-- Add exit tracking to pool_contracts table
ALTER TABLE pool_contracts ADD COLUMN IF NOT EXISTS exit_split_id UUID REFERENCES exit_splits(id);
ALTER TABLE pool_contracts ADD COLUMN IF NOT EXISTS exited_at TIMESTAMP;
ALTER TABLE pool_contracts ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(100);

-- Update contract status to include 'completed'
-- Note: PostgreSQL doesn't allow easy enum updates, so we use CHECK constraint
ALTER TABLE pool_contracts DROP CONSTRAINT IF EXISTS pool_contracts_status_check;
ALTER TABLE pool_contracts ADD CONSTRAINT pool_contracts_status_check 
    CHECK (status IN ('pending', 'active', 'exiting', 'completed', 'cancelled'));

-- Index for exit queries on contracts
CREATE INDEX IF NOT EXISTS idx_contracts_exit ON pool_contracts(exit_split_id) WHERE exit_split_id IS NOT NULL;

-- Add exit tracking to farmers table  
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS last_exit_at TIMESTAMP;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS exit_count INTEGER DEFAULT 0;

-- =====================================================
-- 3. PLATFORM FEE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_split_id UUID NOT NULL REFERENCES exit_splits(id),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    fee_rate DECIMAL(5,4) NOT NULL,
    collected_at TIMESTAMP DEFAULT NOW(),
    withdrawn_at TIMESTAMP,
    withdrawal_tx_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'collected' CHECK (status IN ('collected', 'withdrawn', 'pending'))
);

CREATE INDEX idx_platform_fees_exit ON platform_fees(exit_split_id);
CREATE INDEX idx_platform_fees_status ON platform_fees(status);
CREATE INDEX idx_platform_fees_collected ON platform_fees(collected_at DESC);

-- =====================================================
-- 4. AUDIT TRAIL FOR EXIT OPERATIONS  
-- =====================================================

CREATE TABLE IF NOT EXISTS exit_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_split_id UUID NOT NULL REFERENCES exit_splits(id),
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20), 
    details JSONB,
    error_details TEXT,
    performed_by UUID, -- user_id if manual action
    performed_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_exit_audit_exit ON exit_audit_log(exit_split_id);
CREATE INDEX idx_exit_audit_action ON exit_audit_log(action);
CREATE INDEX idx_exit_audit_performed ON exit_audit_log(performed_at DESC);

-- =====================================================
-- 5. USEFUL VIEWS FOR EXIT ANALYTICS
-- =====================================================

-- View for exit summary statistics
CREATE OR REPLACE VIEW exit_summary_stats AS
SELECT 
    DATE_TRUNC('day', initiated_at) as exit_date,
    COUNT(*) as total_exits,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_exits,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_exits,
    COUNT(*) FILTER (WHERE status = 'processing') as pending_exits,
    SUM(total_rewards) as total_rewards_processed,
    SUM(platform_fee) as total_platform_fees,
    AVG(EXTRACT(EPOCH FROM (completed_at - initiated_at))) as avg_processing_time_seconds
FROM exit_splits
GROUP BY DATE_TRUNC('day', initiated_at)
ORDER BY exit_date DESC;

-- View for farmer exit history
CREATE OR REPLACE VIEW farmer_exit_history AS
SELECT 
    es.farmer_id,
    f.email as farmer_email,
    es.id as exit_split_id,
    es.total_rewards,
    es.farmer_share,
    es.status,
    es.initiated_at,
    es.completed_at,
    pc.joined_at,
    EXTRACT(EPOCH FROM (es.initiated_at - pc.joined_at)) / 86400 as days_in_pool
FROM exit_splits es
JOIN farmers f ON es.farmer_id = f.id
LEFT JOIN pool_contracts pc ON es.contract_id = pc.id
ORDER BY es.initiated_at DESC;

-- View for pooler exit analytics
CREATE OR REPLACE VIEW pooler_exit_analytics AS
SELECT 
    es.pooler_id,
    p.name as pooler_name,
    COUNT(*) as total_farmer_exits,
    SUM(es.total_rewards) as total_rewards_distributed,
    SUM(es.pooler_share) as total_pooler_earnings,
    AVG(es.pooler_share) as avg_pooler_earnings_per_exit,
    COUNT(*) FILTER (WHERE es.status = 'completed') as successful_exits,
    COUNT(*) FILTER (WHERE es.status = 'failed') as failed_exits
FROM exit_splits es
JOIN poolers p ON es.pooler_id = p.id
GROUP BY es.pooler_id, p.name
ORDER BY total_pooler_earnings DESC;

-- =====================================================
-- 6. CONFIGURATION TABLE FOR EXIT PARAMETERS
-- =====================================================

CREATE TABLE IF NOT EXISTS exit_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_name VARCHAR(50) NOT NULL UNIQUE,
    parameter_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID -- admin user_id
);

-- Insert default configuration
INSERT INTO exit_configuration (parameter_name, parameter_value, description) VALUES
('PLATFORM_FEE_RATE', '0.05', 'Platform fee rate (5%)'),
('MAX_RETRY_ATTEMPTS', '3', 'Maximum retry attempts for failed exits'),
('RETRY_BACKOFF_BASE', '30000', 'Base retry backoff time in milliseconds'),
('EXIT_PROCESSING_TIMEOUT', '300000', 'Exit processing timeout in milliseconds'),
('PLATFORM_WALLET_ADDRESS', 'GPLATFORMWALLET123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Platform wallet address for fee collection'),
('MIN_EXIT_AMOUNT', '1000000', 'Minimum exit amount in stroops (0.1 KALE)')
ON CONFLICT (parameter_name) DO NOTHING;

-- =====================================================
-- 7. PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_exit_splits_active_processing 
    ON exit_splits(initiated_at) WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_exit_splits_failed_retries 
    ON exit_splits(last_retry_at) WHERE status = 'failed' AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_harvests_unexpited_rewards 
    ON harvests(farmer_id, reward_amount) WHERE included_in_exit = false AND status = 'success';

-- Composite index for exit calculations
CREATE INDEX IF NOT EXISTS idx_harvests_exit_calc 
    ON harvests(farmer_id, status, included_in_exit, reward_amount, harvested_at);

-- =====================================================
-- 8. DATA INTEGRITY FUNCTIONS
-- =====================================================

-- Function to validate exit split calculations
CREATE OR REPLACE FUNCTION validate_exit_split()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure split amounts add up to total
    IF NEW.farmer_share + NEW.pooler_share + NEW.platform_fee != NEW.total_rewards THEN
        RAISE EXCEPTION 'Exit split amounts do not sum to total rewards: % + % + % != %',
            NEW.farmer_share, NEW.pooler_share, NEW.platform_fee, NEW.total_rewards;
    END IF;
    
    -- Ensure rates are valid
    IF NEW.reward_split < 0 OR NEW.reward_split > 1 THEN
        RAISE EXCEPTION 'Reward split must be between 0 and 1: %', NEW.reward_split;
    END IF;
    
    IF NEW.platform_fee_rate < 0 OR NEW.platform_fee_rate > 1 THEN
        RAISE EXCEPTION 'Platform fee rate must be between 0 and 1: %', NEW.platform_fee_rate;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate exit splits
CREATE TRIGGER exit_splits_validation_trigger
    BEFORE INSERT OR UPDATE ON exit_splits
    FOR EACH ROW EXECUTE FUNCTION validate_exit_split();

-- Function to log exit status changes
CREATE OR REPLACE FUNCTION log_exit_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO exit_audit_log (exit_split_id, action, old_status, new_status, details)
        VALUES (NEW.id, 'status_change', OLD.status, NEW.status, 
                jsonb_build_object('retry_count', NEW.retry_count, 'error_message', NEW.error_message));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
CREATE TRIGGER exit_splits_audit_trigger
    AFTER UPDATE ON exit_splits
    FOR EACH ROW EXECUTE FUNCTION log_exit_status_change();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE exit_splits IS 'Core table for tracking farmer exit processes and reward splitting';
COMMENT ON COLUMN exit_splits.total_rewards IS 'Total KALE rewards being distributed (in stroops)';
COMMENT ON COLUMN exit_splits.farmer_share IS 'Amount going to farmer external wallet (in stroops)';
COMMENT ON COLUMN exit_splits.pooler_share IS 'Amount going to pooler (in stroops)';
COMMENT ON COLUMN exit_splits.platform_fee IS 'Platform fee amount (in stroops)';
COMMENT ON COLUMN exit_splits.reward_split IS 'Farmer reward percentage at time of exit (0.0-1.0)';
COMMENT ON COLUMN exit_splits.platform_fee_rate IS 'Platform fee rate at time of exit (0.0-1.0)';

COMMENT ON VIEW exit_summary_stats IS 'Daily statistics for exit processing';
COMMENT ON VIEW farmer_exit_history IS 'Complete exit history for farmers with timeline data';
COMMENT ON VIEW pooler_exit_analytics IS 'Pooler-focused exit statistics and earnings';

-- End of migration
-- Version: 002_farmer_exit_system.sql
-- Applied: Auto-timestamp