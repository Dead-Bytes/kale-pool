-- API Optimization Indexes for KALE Pool Mining System
-- These indexes support the new API endpoints with efficient pagination and filtering

-- Enable UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================
-- PAGINATION AND FILTERING INDEXES
-- ===============================

-- Pool contracts indexes for API endpoints
CREATE INDEX IF NOT EXISTS idx_pool_contracts_pooler_status ON pool_contracts(pooler_id, status);
CREATE INDEX IF NOT EXISTS idx_pool_contracts_farmer_status ON pool_contracts(farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_pool_contracts_created_at ON pool_contracts(created_at DESC);

-- Plantings indexes for farmer analytics
CREATE INDEX IF NOT EXISTS idx_plantings_farmer_block ON plantings(farmer_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_plantings_pooler_block ON plantings(pooler_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_plantings_timestamp ON plantings(planted_at DESC);
CREATE INDEX IF NOT EXISTS idx_plantings_status ON plantings(status);

-- Harvests indexes for farmer analytics
CREATE INDEX IF NOT EXISTS idx_harvests_farmer_block ON harvests(farmer_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_pooler_block ON harvests(pooler_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_timestamp ON harvests(harvested_at DESC);
CREATE INDEX IF NOT EXISTS idx_harvests_status ON harvests(status);

-- Works indexes for pooler analytics
CREATE INDEX IF NOT EXISTS idx_works_pooler_block ON works(pooler_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_works_farmer_block ON works(farmer_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_works_timestamp ON works(worked_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);

-- Poolers indexes for discovery
CREATE INDEX IF NOT EXISTS idx_poolers_status ON poolers(status);
CREATE INDEX IF NOT EXISTS idx_poolers_is_active ON poolers(is_active);
CREATE INDEX IF NOT EXISTS idx_poolers_current_farmers ON poolers(current_farmers);
CREATE INDEX IF NOT EXISTS idx_poolers_reward_percentage ON poolers(reward_percentage);
CREATE INDEX IF NOT EXISTS idx_poolers_created_at ON poolers(created_at DESC);

-- Farmers indexes for analytics
CREATE INDEX IF NOT EXISTS idx_farmers_pooler_status ON farmers(pooler_id, status);
CREATE INDEX IF NOT EXISTS idx_farmers_status_new ON farmers(status_new);
CREATE INDEX IF NOT EXISTS idx_farmers_is_funded ON farmers(is_funded);
CREATE INDEX IF NOT EXISTS idx_farmers_created_at ON farmers(created_at DESC);

-- Users indexes for authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ===============================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ===============================

-- For farmer analytics - plantings by farmer with status and time
CREATE INDEX IF NOT EXISTS idx_plantings_farmer_status_time ON plantings(farmer_id, status, planted_at DESC);

-- For farmer analytics - harvests by farmer with status and time  
CREATE INDEX IF NOT EXISTS idx_harvests_farmer_status_time ON harvests(farmer_id, status, harvested_at DESC);

-- For pooler analytics - works by pooler with status and time
CREATE INDEX IF NOT EXISTS idx_works_pooler_status_time ON works(pooler_id, status, worked_at DESC);

-- For contract filtering - contracts by pooler with status and time
CREATE INDEX IF NOT EXISTS idx_pool_contracts_pooler_status_time ON pool_contracts(pooler_id, status, created_at DESC);

-- For contract filtering - contracts by farmer with status and time
CREATE INDEX IF NOT EXISTS idx_pool_contracts_farmer_status_time ON pool_contracts(farmer_id, status, created_at DESC);

-- For block operations analytics
CREATE INDEX IF NOT EXISTS idx_block_operations_pooler_status ON block_operations(pooler_id, status);
CREATE INDEX IF NOT EXISTS idx_block_operations_block_index ON block_operations(block_index DESC);
CREATE INDEX IF NOT EXISTS idx_block_operations_created_at ON block_operations(created_at DESC);

-- ===============================
-- AGGREGATION SUPPORT INDEXES
-- ===============================

-- For pooler dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_works_pooler_success_time ON works(pooler_id, status, worked_at) 
WHERE status IN ('success', 'recovered');

-- For farmer summary aggregations
CREATE INDEX IF NOT EXISTS idx_harvests_farmer_success_time ON harvests(farmer_id, status, harvested_at)
WHERE status = 'success';

-- For reward calculations
CREATE INDEX IF NOT EXISTS idx_harvests_reward_amount ON harvests(reward_amount) WHERE reward_amount > 0;
CREATE INDEX IF NOT EXISTS idx_plantings_stake_amount ON plantings(stake_amount) WHERE stake_amount > 0;

-- ===============================
-- PERFORMANCE MONITORING
-- ===============================

-- Add performance statistics table for monitoring query performance
CREATE TABLE IF NOT EXISTS query_performance_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(255) NOT NULL,
    query_type VARCHAR(100) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    rows_returned INTEGER DEFAULT 0,
    query_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_performance_endpoint ON query_performance_stats(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_time ON query_performance_stats(execution_time_ms DESC);

-- ===============================
-- AUTHENTICATION EXTENSIONS
-- ===============================

-- Add password hash field to users table for authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'farmer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Index for authentication queries
CREATE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);

-- Add refresh tokens table for JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ===============================
-- ANALYTICS VIEWS FOR PERFORMANCE
-- ===============================

-- Pooler performance view
CREATE OR REPLACE VIEW pooler_performance_view AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.current_farmers,
    p.max_farmers,
    p.reward_percentage,
    p.is_active,
    p.created_at,
    p.last_seen,
    COALESCE(stats.total_blocks, 0) as blocks_participated,
    COALESCE(stats.successful_works, 0) as successful_works,
    COALESCE(stats.total_works, 0) as total_works,
    COALESCE(stats.total_rewards, 0) as total_rewards_distributed,
    CASE 
        WHEN stats.total_works > 0 
        THEN ROUND(stats.successful_works::decimal / stats.total_works, 4)
        ELSE 0
    END as success_rate
FROM poolers p
LEFT JOIN (
    SELECT 
        pooler_id,
        COUNT(DISTINCT block_index) as total_blocks,
        COUNT(*) FILTER (WHERE status IN ('success', 'recovered')) as successful_works,
        COUNT(*) as total_works,
        SUM(COALESCE((SELECT SUM(reward_amount) FROM harvests h WHERE h.pooler_id = w.pooler_id AND h.block_index = w.block_index), 0)) as total_rewards
    FROM works w
    WHERE worked_at >= NOW() - INTERVAL '30 days'
    GROUP BY pooler_id
) stats ON p.id = stats.pooler_id;

-- Farmer summary view
CREATE OR REPLACE VIEW farmer_summary_view AS
SELECT 
    f.id,
    f.user_id,
    f.pooler_id,
    f.custodial_public_key,
    f.payout_wallet_address,
    f.stake_percentage,
    f.current_balance,
    f.is_funded,
    f.status,
    f.created_at,
    u.email,
    p.name as pooler_name,
    COALESCE(plant_stats.total_plants, 0) as lifetime_plants,
    COALESCE(plant_stats.successful_plants, 0) as successful_plants,
    COALESCE(harvest_stats.total_harvests, 0) as lifetime_harvests,
    COALESCE(harvest_stats.total_rewards, 0) as lifetime_rewards,
    COALESCE(plant_stats.total_staked, 0) as lifetime_staked
FROM farmers f
JOIN users u ON f.user_id = u.id
LEFT JOIN poolers p ON f.pooler_id = p.id
LEFT JOIN (
    SELECT 
        farmer_id,
        COUNT(*) as total_plants,
        COUNT(*) FILTER (WHERE status = 'success') as successful_plants,
        SUM(COALESCE(stake_amount, 0)) as total_staked
    FROM plantings
    GROUP BY farmer_id
) plant_stats ON f.id = plant_stats.farmer_id
LEFT JOIN (
    SELECT 
        farmer_id,
        COUNT(*) as total_harvests,
        SUM(COALESCE(reward_amount, 0)) as total_rewards
    FROM harvests
    WHERE status = 'success'
    GROUP BY farmer_id
) harvest_stats ON f.id = harvest_stats.farmer_id;