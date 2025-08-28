-- Complete Database Schema for KALE Pool Mining System
-- Includes all tables required for registration, farming, and harvesting

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================
-- CORE TABLES
-- ===============================

-- Users table for farmer registration
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    external_wallet VARCHAR(56) NOT NULL,
    status VARCHAR(20) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP
);

-- Poolers table
CREATE TABLE IF NOT EXISTS poolers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    public_key VARCHAR(56) NOT NULL,
    api_key VARCHAR(128) UNIQUE NOT NULL,
    api_endpoint VARCHAR(255),
    max_farmers INTEGER DEFAULT 100,
    current_farmers INTEGER DEFAULT 0,
    reward_percentage DECIMAL(5,4) DEFAULT 0.05,
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'active',
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced farmers table with all required columns
CREATE TABLE IF NOT EXISTS farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    pooler_id UUID REFERENCES poolers(id),
    custodial_public_key VARCHAR(56) UNIQUE NOT NULL,
    custodial_secret_key TEXT NOT NULL,
    payout_wallet_address VARCHAR(56) NOT NULL,
    stake_percentage DECIMAL(5,4) DEFAULT 0.1,
    current_balance DECIMAL(20,7) DEFAULT 0,
    is_funded BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active',
    status_new VARCHAR(20) DEFAULT 'wallet_created',
    created_at TIMESTAMP DEFAULT NOW(),
    funded_at TIMESTAMP,
    joined_pool_at TIMESTAMP
);

-- ===============================
-- BLOCKCHAIN OPERATION TABLES
-- ===============================

-- Block operations tracking
CREATE TABLE IF NOT EXISTS block_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT UNIQUE NOT NULL,
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    status VARCHAR(20) DEFAULT 'active',
    total_farmers INTEGER DEFAULT 0,
    successful_plants INTEGER DEFAULT 0,
    successful_works INTEGER DEFAULT 0,
    successful_harvests INTEGER DEFAULT 0,
    total_staked DECIMAL(20,7) DEFAULT 0,
    total_rewards DECIMAL(20,7) DEFAULT 0,
    plant_requested_at TIMESTAMP,
    plant_completed_at TIMESTAMP,
    work_completed_at TIMESTAMP,
    harvest_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Individual planting operations
CREATE TABLE IF NOT EXISTS plantings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    stake_amount DECIMAL(20,7) NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    planted_at TIMESTAMP DEFAULT NOW()
);

-- Individual work operations
CREATE TABLE IF NOT EXISTS works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    nonce VARCHAR(64),
    hash VARCHAR(64),
    zeros INTEGER DEFAULT 0,
    gap INTEGER DEFAULT 0,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    compensation_required BOOLEAN DEFAULT false,
    worked_at TIMESTAMP DEFAULT NOW()
);

-- Individual harvest operations
CREATE TABLE IF NOT EXISTS harvests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    reward_amount DECIMAL(20,7) DEFAULT 0,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    harvested_at TIMESTAMP DEFAULT NOW()
);

-- ===============================
-- PHASE 2 EXTENSION TABLES
-- ===============================

-- Balance check history
CREATE TABLE IF NOT EXISTS balance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    xlm_balance DECIMAL(20,7),
    is_funded BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'checking',
    checked_at TIMESTAMP DEFAULT NOW()
);

-- Pool contracts for farmer-pooler relationships
CREATE TABLE IF NOT EXISTS pool_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    stake_percentage DECIMAL(5,4) NOT NULL,
    harvest_interval INTEGER NOT NULL,
    reward_split DECIMAL(5,4) NOT NULL,
    platform_fee DECIMAL(5,4) DEFAULT 0.05,
    status VARCHAR(20) DEFAULT 'pending',
    contract_terms JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    exit_requested_at TIMESTAMP
);

-- Pool statistics and performance tracking  
CREATE TABLE IF NOT EXISTS pool_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    blocks_participated INTEGER DEFAULT 0,
    avg_plant_success_rate DECIMAL(5,4) DEFAULT 0,
    avg_work_success_rate DECIMAL(5,4) DEFAULT 0,
    avg_harvest_success_rate DECIMAL(5,4) DEFAULT 0,
    total_rewards_distributed DECIMAL(20,7) DEFAULT 0,
    avg_reward_per_farmer DECIMAL(20,7) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- ===============================
-- INDEXES FOR PERFORMANCE
-- ===============================

-- Block operations indexes
CREATE INDEX IF NOT EXISTS idx_block_operations_block_index ON block_operations(block_index);
CREATE INDEX IF NOT EXISTS idx_block_operations_pooler_id ON block_operations(pooler_id);
CREATE INDEX IF NOT EXISTS idx_block_operations_status ON block_operations(status);

-- Plantings indexes
CREATE INDEX IF NOT EXISTS idx_plantings_block_index ON plantings(block_index);
CREATE INDEX IF NOT EXISTS idx_plantings_farmer_id ON plantings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_plantings_status ON plantings(status);

-- Works indexes  
CREATE INDEX IF NOT EXISTS idx_works_block_index ON works(block_index);
CREATE INDEX IF NOT EXISTS idx_works_farmer_id ON works(farmer_id);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);

-- Harvests indexes
CREATE INDEX IF NOT EXISTS idx_harvests_block_index ON harvests(block_index);
CREATE INDEX IF NOT EXISTS idx_harvests_farmer_id ON harvests(farmer_id);
CREATE INDEX IF NOT EXISTS idx_harvests_status ON harvests(status);

-- Farmers indexes
CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON farmers(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_pooler_id ON farmers(pooler_id);
CREATE INDEX IF NOT EXISTS idx_farmers_status ON farmers(status);
CREATE INDEX IF NOT EXISTS idx_farmers_status_new ON farmers(status_new);
CREATE INDEX IF NOT EXISTS idx_farmers_is_funded ON farmers(is_funded);

-- Balance checks indexes
CREATE INDEX IF NOT EXISTS idx_balance_checks_farmer_id ON balance_checks(farmer_id);
CREATE INDEX IF NOT EXISTS idx_balance_checks_checked_at ON balance_checks(checked_at);

-- Pool contracts indexes
CREATE INDEX IF NOT EXISTS idx_pool_contracts_farmer_id ON pool_contracts(farmer_id);
CREATE INDEX IF NOT EXISTS idx_pool_contracts_pooler_id ON pool_contracts(pooler_id);
CREATE INDEX IF NOT EXISTS idx_pool_contracts_status ON pool_contracts(status);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ===============================
-- DEFAULT DATA INSERTION
-- ===============================

-- Insert default pooler user first
INSERT INTO users (
    id,
    email,
    external_wallet,
    status
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'pooler@kale.system',
    'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    'registered'
) ON CONFLICT (id) DO NOTHING;

-- Insert default pooler (required for system to function)
INSERT INTO poolers (
    id,
    name,
    public_key,
    api_key,
    api_endpoint,
    max_farmers,
    current_farmers,
    reward_percentage,
    is_active,
    status
) VALUES (
    '12345678-1234-5678-9abc-123456789000',
    'KALE Pool Pooler (Mainnet)',
    'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    'dev-api-key-for-testing-only',
    'http://localhost:3001',
    1000,
    0,
    0.05,
    true,
    'active'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    last_seen = NOW();