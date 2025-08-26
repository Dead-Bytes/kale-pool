-- KALE Pool Mining Database Schema Updates - Phase 2
-- Farmer Onboarding System with Pool Contracts

-- ======================
-- NEW TABLES FOR PHASE 2
-- ======================

-- Users table for farmer registration
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    external_wallet VARCHAR(56) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'verified', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Pool contracts table for farmer-pooler agreements
CREATE TABLE pool_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    stake_percentage DECIMAL(5,4) NOT NULL CHECK (stake_percentage >= 0.0 AND stake_percentage <= 1.0),
    harvest_interval INTEGER NOT NULL CHECK (harvest_interval >= 1 AND harvest_interval <= 20),
    reward_split DECIMAL(5,4) NOT NULL,
    platform_fee DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'exiting', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    exit_requested_at TIMESTAMP WITH TIME ZONE,
    contract_terms JSONB
);

-- Balance checks table for funding monitoring
CREATE TABLE balance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    xlm_balance DECIMAL(20,7),
    is_funded BOOLEAN NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('checking', 'funded', 'insufficient'))
);

-- ======================
-- SCHEMA MODIFICATIONS
-- ======================

-- Add user relationship to farmers table
ALTER TABLE farmers ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE farmers ALTER COLUMN pooler_id DROP NOT NULL; -- Allow farmers without pools initially
ALTER TABLE farmers ADD COLUMN status_new VARCHAR(20) DEFAULT 'wallet_created' CHECK (status_new IN ('wallet_created', 'funded', 'active_in_pool', 'exiting', 'exited'));
ALTER TABLE farmers ADD COLUMN funded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE farmers ADD COLUMN joined_pool_at TIMESTAMP WITH TIME ZONE;

-- Add pool management fields to poolers table  
ALTER TABLE poolers ADD COLUMN reward_percentage DECIMAL(5,4) DEFAULT 0.50;
ALTER TABLE poolers ADD COLUMN terms JSONB;
ALTER TABLE poolers ADD COLUMN status_new VARCHAR(20) DEFAULT 'active' CHECK (status_new IN ('active', 'full', 'paused'));

-- ======================
-- INDEXES FOR NEW TABLES
-- ======================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Pool contracts indexes
CREATE INDEX idx_pool_contracts_farmer ON pool_contracts(farmer_id);
CREATE INDEX idx_pool_contracts_pooler ON pool_contracts(pooler_id);
CREATE INDEX idx_pool_contracts_status ON pool_contracts(status);
CREATE UNIQUE INDEX idx_active_farmer_contract ON pool_contracts(farmer_id) 
WHERE status = 'active';

-- Balance checks indexes
CREATE INDEX idx_balance_checks_farmer ON balance_checks(farmer_id);
CREATE INDEX idx_balance_checks_timestamp ON balance_checks(checked_at);

-- New farmer indexes
CREATE INDEX idx_farmers_user ON farmers(user_id);
CREATE INDEX idx_farmers_status_new ON farmers(status_new);

-- New pooler indexes
CREATE INDEX idx_poolers_status_new ON poolers(status_new);

-- ======================
-- NEW TRIGGERS
-- ======================

-- Update pooler current_farmers count when pool contracts change
CREATE OR REPLACE FUNCTION update_pooler_contract_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM pool_contracts 
            WHERE pooler_id = NEW.pooler_id AND status = 'active'
        )
        WHERE id = NEW.pooler_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update count for the pooler
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM pool_contracts 
            WHERE pooler_id = NEW.pooler_id AND status = 'active'
        )
        WHERE id = NEW.pooler_id;
        
        -- If pooler changed, update the old pooler too
        IF OLD.pooler_id != NEW.pooler_id THEN
            UPDATE poolers 
            SET current_farmers = (
                SELECT COUNT(*) 
                FROM pool_contracts 
                WHERE pooler_id = OLD.pooler_id AND status = 'active'
            )
            WHERE id = OLD.pooler_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE poolers 
        SET current_farmers = (
            SELECT COUNT(*) 
            FROM pool_contracts 
            WHERE pooler_id = OLD.pooler_id AND status = 'active'
        )
        WHERE id = OLD.pooler_id;
        RETURN OLD;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contract_count
    AFTER INSERT OR UPDATE OR DELETE ON pool_contracts
    FOR EACH ROW EXECUTE FUNCTION update_pooler_contract_count();

-- ======================
-- SAMPLE DATA FOR TESTING
-- ======================

-- Insert sample pooler with new fields
INSERT INTO poolers (
    id,
    name,
    public_key,
    api_key,
    reward_percentage,
    max_farmers,
    terms,
    status_new
) VALUES (
    '12345678-1234-5678-9abc-123456789000',
    'Main Pool Alpha',
    'GBXQRWQYQM4N5TWGX5HFQRYZFQJZK5E5HGJZD4B5R5LJZK5E5HGJZD4B5',
    'pool-alpha-api-key-12345',
    0.60,
    100,
    '{"exitDelay": 24, "penaltyConditions": "Standard pool terms", "performanceRequirements": "95% uptime"}',
    'active'
) ON CONFLICT (id) DO UPDATE SET
    reward_percentage = EXCLUDED.reward_percentage,
    terms = EXCLUDED.terms,
    status_new = EXCLUDED.status_new;

-- ======================
-- VIEWS FOR POOL STATISTICS
-- ======================

-- Pool statistics view for discovery interface
CREATE VIEW pool_statistics AS
SELECT 
    p.id,
    p.name,
    p.reward_percentage,
    p.current_farmers,
    p.max_farmers,
    p.status_new as status,
    COUNT(DISTINCT bo.block_index) as blocks_participated,
    CASE 
        WHEN COUNT(DISTINCT bo.block_index) > 0 
        THEN AVG(bo.successful_plants::DECIMAL / GREATEST(bo.total_farmers, 1))
        ELSE 0 
    END as success_rate,
    CASE 
        WHEN COUNT(DISTINCT bo.block_index) > 0 
        THEN AVG(bo.total_rewards::DECIMAL / GREATEST(bo.successful_harvests, 1))
        ELSE 0 
    END as avg_reward_per_block,
    p.created_at,
    p.last_seen
FROM poolers p
LEFT JOIN block_operations bo ON p.id = bo.pooler_id AND bo.status = 'completed'
WHERE p.status_new = 'active'
GROUP BY p.id, p.name, p.reward_percentage, p.current_farmers, p.max_farmers, p.status_new, p.created_at, p.last_seen;

-- Farmer contract status view
CREATE VIEW farmer_contract_status AS
SELECT 
    f.id as farmer_id,
    u.email,
    f.custodial_public_key,
    f.status_new as farmer_status,
    pc.id as contract_id,
    pc.pooler_id,
    po.name as pooler_name,
    pc.stake_percentage,
    pc.harvest_interval,
    pc.reward_split,
    pc.status as contract_status,
    pc.created_at as contract_created,
    pc.confirmed_at as contract_confirmed,
    f.current_balance,
    f.funded_at,
    f.joined_pool_at
FROM farmers f
LEFT JOIN users u ON f.user_id = u.id
LEFT JOIN pool_contracts pc ON f.id = pc.farmer_id AND pc.status = 'active'
LEFT JOIN poolers po ON pc.pooler_id = po.id;