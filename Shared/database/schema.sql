-- KALE Pool Mining Database Schema
-- Phase 1: Complete database structure with immutable event sourcing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- CORE ENTITIES
-- ======================

CREATE TABLE poolers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    public_key VARCHAR(56) UNIQUE NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_endpoint VARCHAR(512),
    max_farmers INTEGER NOT NULL DEFAULT 100,
    current_farmers INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE farmers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    custodial_public_key VARCHAR(56) UNIQUE NOT NULL,
    custodial_secret_key TEXT NOT NULL, -- UNENCRYPTED for Phase 1
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    payout_wallet_address VARCHAR(56) NOT NULL,
    stake_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.1 CHECK (stake_percentage >= 0.0 AND stake_percentage <= 1.0),
    current_balance BIGINT NOT NULL DEFAULT 0,
    is_funded BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'leaving', 'departed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ======================
-- IMMUTABLE EVENT TABLES
-- ======================

CREATE TABLE plantings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index INTEGER NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    stake_amount BIGINT NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    planted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE works (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index INTEGER NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    nonce BIGINT NOT NULL,
    hash VARCHAR(64) NOT NULL,
    zeros INTEGER NOT NULL,
    gap INTEGER NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    compensation_required BOOLEAN NOT NULL DEFAULT false,
    worked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE harvests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index INTEGER NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    reward_amount BIGINT NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    harvested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ======================
-- BLOCK OPERATIONS TRACKING
-- ======================

CREATE TABLE block_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index INTEGER UNIQUE NOT NULL, -- The holy bible record
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    plant_requested_at TIMESTAMP WITH TIME ZONE,
    plant_completed_at TIMESTAMP WITH TIME ZONE,
    work_completed_at TIMESTAMP WITH TIME ZONE,
    harvest_completed_at TIMESTAMP WITH TIME ZONE,
    total_farmers INTEGER NOT NULL DEFAULT 0,
    successful_plants INTEGER NOT NULL DEFAULT 0,
    successful_works INTEGER NOT NULL DEFAULT 0,
    successful_harvests INTEGER NOT NULL DEFAULT 0,
    total_staked BIGINT NOT NULL DEFAULT 0,
    total_rewards BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed'))
);

-- ======================
-- COMPENSATION TRACKING
-- ======================

CREATE TABLE pooler_compensations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    block_index INTEGER NOT NULL,
    compensation_type VARCHAR(20) NOT NULL CHECK (compensation_type IN ('plant_failure', 'work_failure')),
    amount BIGINT NOT NULL,
    reason TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ======================
-- INDEXES FOR PERFORMANCE
-- ======================

-- Block operations - frequently queried by block_index
CREATE INDEX idx_plantings_block_index ON plantings(block_index);
CREATE INDEX idx_plantings_farmer_id ON plantings(farmer_id);
CREATE INDEX idx_plantings_status ON plantings(status);
CREATE INDEX idx_plantings_block_farmer ON plantings(block_index, farmer_id);

CREATE INDEX idx_works_block_index ON works(block_index);
CREATE INDEX idx_works_farmer_id ON works(farmer_id);
CREATE INDEX idx_works_status ON works(status);
CREATE INDEX idx_works_block_farmer ON works(block_index, farmer_id);

CREATE INDEX idx_harvests_block_index ON harvests(block_index);
CREATE INDEX idx_harvests_farmer_id ON harvests(farmer_id);
CREATE INDEX idx_harvests_status ON harvests(status);
CREATE INDEX idx_harvests_block_farmer ON harvests(block_index, farmer_id);

-- Farmer operations
CREATE INDEX idx_farmers_pooler_id ON farmers(pooler_id);
CREATE INDEX idx_farmers_status ON farmers(status);
CREATE INDEX idx_farmers_pooler_status ON farmers(pooler_id, status);

-- Block operations
CREATE INDEX idx_block_operations_block_index ON block_operations(block_index);
CREATE INDEX idx_block_operations_pooler_id ON block_operations(pooler_id);

-- Compensation tracking
CREATE INDEX idx_compensations_pooler_farmer ON pooler_compensations(pooler_id, farmer_id);
CREATE INDEX idx_compensations_block ON pooler_compensations(block_index);

-- ======================
-- DATABASE TRIGGERS
-- ======================

-- Update farmer count when farmers are added/removed/status changed
CREATE OR REPLACE FUNCTION update_pooler_farmer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM farmers 
            WHERE pooler_id = NEW.pooler_id AND status = 'active'
        )
        WHERE id = NEW.pooler_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update counts for both old and new pooler if changed
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM farmers 
            WHERE pooler_id = NEW.pooler_id AND status = 'active'
        )
        WHERE id = NEW.pooler_id;
        
        IF OLD.pooler_id != NEW.pooler_id THEN
            UPDATE poolers 
            SET current_farmers = (
                SELECT COUNT(*) 
                FROM farmers 
                WHERE pooler_id = OLD.pooler_id AND status = 'active'
            )
            WHERE id = OLD.pooler_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM farmers 
            WHERE pooler_id = OLD.pooler_id AND status = 'active'
        )
        WHERE id = OLD.pooler_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_farmer_count
    AFTER INSERT OR UPDATE OR DELETE ON farmers
    FOR EACH ROW EXECUTE FUNCTION update_pooler_farmer_count();

-- Update farmer balance when harvest is successful
CREATE OR REPLACE FUNCTION update_farmer_balance_on_harvest()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' THEN
        UPDATE farmers 
        SET current_balance = current_balance + NEW.reward_amount
        WHERE id = NEW.farmer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_balance_on_harvest
    AFTER INSERT ON harvests
    FOR EACH ROW EXECUTE FUNCTION update_farmer_balance_on_harvest();

-- ======================
-- VIEWS FOR ANALYTICS
-- ======================

-- Farmer performance summary
CREATE VIEW farmer_performance AS
SELECT 
    f.id,
    f.custodial_public_key,
    f.current_balance,
    COUNT(DISTINCT p.block_index) as blocks_planted,
    COUNT(DISTINCT w.block_index) as blocks_worked,
    COUNT(DISTINCT h.block_index) as blocks_harvested,
    COALESCE(SUM(p.stake_amount), 0) as total_staked,
    COALESCE(SUM(h.reward_amount), 0) as total_rewards,
    CASE 
        WHEN COUNT(DISTINCT p.block_index) > 0 
        THEN COUNT(DISTINCT w.block_index)::DECIMAL / COUNT(DISTINCT p.block_index) 
        ELSE 0 
    END as work_success_rate
FROM farmers f
LEFT JOIN plantings p ON f.id = p.farmer_id AND p.status = 'success'
LEFT JOIN works w ON f.id = w.farmer_id AND w.status = 'success'
LEFT JOIN harvests h ON f.id = h.farmer_id AND h.status = 'success'
GROUP BY f.id, f.custodial_public_key, f.current_balance;

-- Block completion status
CREATE VIEW block_completion_status AS
SELECT 
    bo.block_index,
    bo.pooler_id,
    bo.status,
    bo.total_farmers,
    bo.successful_plants,
    bo.successful_works,
    bo.successful_harvests,
    bo.total_staked,
    bo.total_rewards,
    CASE 
        WHEN bo.successful_plants > 0 
        THEN bo.successful_works::DECIMAL / bo.successful_plants 
        ELSE 0 
    END as work_completion_rate,
    CASE 
        WHEN bo.successful_works > 0 
        THEN bo.successful_harvests::DECIMAL / bo.successful_works 
        ELSE 0 
    END as harvest_completion_rate
FROM block_operations bo
ORDER BY bo.block_index DESC;