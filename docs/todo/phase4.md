# KALE Pool Mining - Phase 1 Complete Implementation Plan

*Comprehensive architecture and implementation roadmap for pooler-backend integration*

## 🎯 Executive Summary

**Objective:** Transform individual KALE farming into a scalable pooled mining system where poolers provide computational resources and farmers provide stakes via custodial wallets.

**Scope:** Phase 1 focuses exclusively on pooler-backend integration, establishing the foundation for block monitoring, coordinated planting, parallel work execution, and automated harvesting.

**Timeline:** 40 hours (1 week intensive development)

**Architecture:** Two-service system with clear separation of concerns - Backend handles all blockchain interactions and farmer account management, Pooler handles block monitoring and work coordination.

## 🏗️ System Architecture Overview

```mermaid
graph TB
    subgraph "🖥️ Pooler Service (Port 3001)"
        PM[Pooler Manager]
        BM[Block Monitor]
        WS[Work Spawner] 
        WM[Work Manager]
    end

    subgraph "🗄️ Backend Service (Port 3000)"
        API[REST API Server]
        WalletMgr[Wallet Manager]
        PlantMgr[Plant Manager]
        HarvestMgr[Harvest Manager]
        DB[(PostgreSQL)]
    end

    subgraph "🔗 Blockchain Layer"
        KALE[KALE Contract]
        STELLAR[Stellar Network]
    end

    %% Service Communication
    BM -->|POST /api/blocks/new| API
    PM -->|POST /api/plant/request| API
    API -->|Confirmation Response| PM
    PM -->|POST /api/work/complete| API

    %% Backend to Blockchain
    PlantMgr --> KALE
    HarvestMgr --> KALE
    KALE --> STELLAR

    %% Data Persistence
    API <--> DB
    WalletMgr <--> DB

    %% Work Process Flow
    BM --> PM
    PM --> WS
    WS --> WM
    WM --> KALE

    classDef pooler fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef blockchain fill:#e8f5e8
    
    class PM,BM,WS,WM pooler
    class API,WalletMgr,PlantMgr,HarvestMgr,DB backend
    class KALE,STELLAR blockchain
```

## 🔄 Complete Operational Flow

```mermaid
sequenceDiagram
    participant BM as Block Monitor
    participant PM as Pooler Manager  
    participant API as Backend API
    participant WM as Wallet Manager
    participant KALE as KALE Contract

    Note over BM: 🔍 Continuous block monitoring
    BM->>PM: Block 12345 detected
    PM->>API: POST /api/plant/request {blockIndex: 12345}
    
    Note over API: 🌱 Parallel plant execution
    API->>WM: Get active farmers list
    WM-->>API: [farmer1, farmer2, farmer3...]
    
    par Plant farmer1
        API->>KALE: plant(farmer1_wallet, stake_amount)
    and Plant farmer2  
        API->>KALE: plant(farmer2_wallet, stake_amount)
    and Plant farmer3
        API->>KALE: plant(farmer3_wallet, stake_amount)
    end

    KALE-->>API: Plant confirmations
    API->>PM: Response: {planted: [farmer1, farmer2], failed: [farmer3]}

    Note over PM: 💪 Spawn work processes for successful plants only
    PM->>PM: Spawn work processes for farmer1, farmer2
    
    par Work Process 1
        PM->>KALE: work(farmer1_wallet, hash, nonce)
    and Work Process 2
        PM->>KALE: work(farmer2_wallet, hash, nonce) 
    end

    Note over PM: ✅ Work completion notification
    PM->>API: POST /api/work/complete {blockIndex: 12345, results: [...]}

    Note over API: 🚜 Auto harvest service (independent)
    loop Every 30 seconds
        API->>API: Check farmers ready for harvest
        API->>KALE: harvest(farmer_wallet, block_index)
        KALE-->>API: Reward amount
        API->>WM: Update farmer earned_balance
    end
```

## 🛠️ Technical Specifications

### API Routes Definition

#### Backend Service (Port 3000)

**Plant Request**
```
POST /api/plant/request
Content-Type: application/json

Request:
{
  "blockIndex": 12345,
  "requestedFarmers": 10  // Optional: how many farmers pooler can handle
}

Response:
{
  "success": true,
  "blockIndex": 12345,
  "planted": [
    {"farmerId": "f1", "walletAddress": "GABC...", "stakeAmount": "1000000"},
    {"farmerId": "f2", "walletAddress": "GDEF...", "stakeAmount": "2000000"}
  ],
  "failed": [
    {"farmerId": "f3", "error": "insufficient_balance"}
  ]
}
```

**Work Completion**
```
POST /api/work/complete
Content-Type: application/json

Request:
{
  "blockIndex": 12345,
  "results": [
    {"farmerId": "f1", "success": true, "workHash": "abc123..."},
    {"farmerId": "f2", "success": false, "error": "timeout"}
  ]
}

Response:
{
  "success": true,
  "message": "Work results recorded"
}
```

**Health Check**
```
GET /api/health

Response:
{
  "status": "healthy",
  "database": "connected",
  "stellar": "connected",
  "activeFarmers": 25
}
```

#### Pooler Service (Port 3001)

**Status**
```
GET /pooler/status

Response:
{
  "status": "mining",
  "currentBlock": 12345,
  "activeFarmers": 8,
  "workProcesses": 8,
  "machineLoad": 0.75
}
```

### Database Schema

```sql
-- 👤 Farmers table
CREATE TABLE farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(64) UNIQUE NOT NULL,
    private_key VARCHAR(64) NOT NULL,  -- Unencrypted for Phase 1
    public_key VARCHAR(64) NOT NULL,
    balance BIGINT DEFAULT 0,
    stake_percentage DECIMAL(5,2) DEFAULT 10.00,  -- e.g., 10% of balance
    harvest_after_blocks INTEGER DEFAULT 5,
    earned_balance BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, departed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 📦 Block events (immutable event sourcing)
CREATE TABLE block_events (
    id BIGSERIAL PRIMARY KEY,
    block_index BIGINT NOT NULL,
    event_type VARCHAR(20) NOT NULL,  -- detected, plant_requested, work_complete
    farmer_id UUID,
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 🌱 Plant transactions
CREATE TABLE plant_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID REFERENCES farmers(id),
    wallet_address VARCHAR(64) NOT NULL,
    stake_amount BIGINT NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

-- 💪 Work results  
CREATE TABLE work_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID REFERENCES farmers(id),
    wallet_address VARCHAR(64) NOT NULL,
    work_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, success, failed, timeout
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 🚜 Harvest transactions
CREATE TABLE harvest_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index BIGINT NOT NULL,
    farmer_id UUID REFERENCES farmers(id),
    wallet_address VARCHAR(64) NOT NULL,
    reward_amount BIGINT,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

-- 📊 Performance indexes
CREATE INDEX idx_block_events_block_index ON block_events(block_index);
CREATE INDEX idx_plant_transactions_block_farmer ON plant_transactions(block_index, farmer_id);
CREATE INDEX idx_work_results_block_farmer ON work_results(block_index, farmer_id);
CREATE INDEX idx_harvest_transactions_farmer ON harvest_transactions(farmer_id, created_at);
CREATE INDEX idx_farmers_status ON farmers(status);

-- 🔄 Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_farmers_updated_at BEFORE UPDATE ON farmers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Project Structure

```
kale-pool-mining/
├── 📁 backend/
│   ├── 📄 package.json
│   ├── 📄 .env.example
│   └── 📁 src/
│       ├── 📄 server.ts              # Express server setup
│       ├── 📄 database.ts            # PostgreSQL connection
│       ├── 📁 routes/
│       │   ├── 📄 plant.ts           # Plant request handler
│       │   ├── 📄 work.ts            # Work completion handler  
│       │   └── 📄 health.ts          # Health check endpoint
│       ├── 📁 services/
│       │   ├── 📄 walletManager.ts   # Custodial wallet management
│       │   ├── 📄 plantManager.ts    # Parallel plant execution
│       │   └── 📄 harvestManager.ts  # Auto harvest service
│       ├── 📁 models/
│       │   ├── 📄 farmer.ts          # Farmer database model
│       │   ├── 📄 plantTransaction.ts
│       │   ├── 📄 workResult.ts
│       │   └── 📄 harvestTransaction.ts
│       └── 📁 utils/
│           ├── 📄 stellar.ts         # Stellar network helpers
│           ├── 📄 logger.ts          # Structured logging
│           └── 📄 config.ts          # Environment configuration
├── 📁 pooler/  
│   ├── 📄 package.json
│   ├── 📄 .env.example
│   └── 📁 src/
│       ├── 📄 pooler.ts              # Main pooler service
│       ├── 📄 blockMonitor.ts        # Block detection service
│       ├── 📄 workManager.ts         # Work process spawning
│       ├── 📄 apiClient.ts           # Backend communication
│       └── 📁 utils/
│           ├── 📄 config.ts          # Pooler configuration
│           └── 📄 logger.ts          # Logging utilities
├── 📁 sql/
│   ├── 📄 001_initial_schema.sql     # Database setup
│   ├── 📄 002_indexes.sql            # Performance indexes
│   └── 📄 003_test_data.sql          # Sample farmers for testing
├── 📄 README.md
├── 📄 docker-compose.yml             # PostgreSQL setup
└── 📄 .gitignore
```

### Environment Configuration

**backend/.env**
```env
# 🗄️ Database
DATABASE_URL=postgresql://kale_user:kale_pass@localhost:5432/kale_pool
DB_MAX_CONNECTIONS=20

# 🔗 Stellar Network  
STELLAR_NETWORK=testnet  # or mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
KALE_CONTRACT_ID=CDQKZ76ZS7LYDOZ2E7OG5LUJEWDDUNYBVYRJTBJK6645DZBNJWA7DXCR

# 🏦 Master funding wallet (for account activation)
MASTER_WALLET_SECRET=SXXX...  # Keep secure!
MASTER_WALLET_ADDRESS=GXXX...

# ⚙️ Service Configuration
PORT=3000
LOG_LEVEL=info
HARVEST_INTERVAL_SECONDS=30

# 🤝 Pooler Communication
POOLER_API_URL=http://localhost:3001
```

**pooler/.env**  
```env
# 🤝 Backend Communication
BACKEND_API_URL=http://localhost:3000
API_TIMEOUT_MS=10000

# 🔗 Blockchain
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
KALE_CONTRACT_ID=CDQKZ76ZS7LYDOZ2E7OG5LUJEWDDUNYBVYRJTBJK6645DZBNJWA7DXCR

# ⚙️ Pooler Configuration
PORT=3001
BLOCK_MONITOR_INTERVAL_MS=5000  # Check for new blocks every 5s
MAX_WORK_PROCESSES=50
MACHINE_CPU_CORES=8
LOG_LEVEL=info

# 💻 Work Management
WORK_TIMEOUT_MS=120000  # 2 minutes per work attempt
MAX_RETRY_ATTEMPTS=3
```

## 📋 Implementation Deliverables

### Week 1: Foundation & Integration (40 Hours)

**Days 1-2 (16 hours): Database & Backend Setup**
- [ ] PostgreSQL database setup with Docker
- [ ] Database schema deployment and testing
- [ ] Backend Express server with health check endpoint
- [ ] Database connection pooling and error handling
- [ ] Structured logging implementation
- [ ] Environment configuration management

**Days 3-4 (16 hours): Custodial Wallet System**
- [ ] Wallet manager service for keypair generation
- [ ] Account creation with master wallet funding
- [ ] Unencrypted private key storage (Phase 1)
- [ ] Balance checking and validation
- [ ] Farmer model with database operations
- [ ] Test farmer account creation flow

**Day 5 (8 hours): Plant & Work Integration**  
- [ ] Plant request API endpoint
- [ ] Parallel plant execution for multiple farmers
- [ ] Work completion result recording
- [ ] Error handling and failure attribution
- [ ] Block event sourcing implementation

### Additional Components (If Time Permits)

**Pooler Service Components**
- [ ] Block monitor service (detect new blocks every 5s)
- [ ] Backend API client for communication
- [ ] Work manager with process spawning
- [ ] Work result reporting to backend

**Harvest System**
- [ ] Auto harvest service (runs every 30s)
- [ ] Farmer harvest configuration handling
- [ ] Reward balance tracking and distribution
- [ ] Batch harvest optimization

## 🎯 Success Metrics

**Technical Goals:**
- [ ] Backend can handle 50+ farmers planting simultaneously
- [ ] Block detection latency < 10 seconds from Stellar
- [ ] Database can store 10,000+ transactions without performance issues
- [ ] 99%+ uptime for both backend and pooler services

**Business Goals:**
- [ ] Complete plant → work → harvest cycle in under 5 minutes
- [ ] Zero farmer fund loss due to technical failures
- [ ] Clear audit trail for all transactions
- [ ] Pooler can coordinate 20+ farmers per block

## ⚠️ Risk Assessment & Mitigation

**🔥 Critical Risks**

1. **Custodial Wallet Security**
   - Risk: Unencrypted private keys in database
   - Mitigation: Phase 1 acceptable for testnet/low-value meme coin
   - Future: Implement encryption + HSM in Phase 2

2. **Master Wallet Depletion**  
   - Risk: Running out of XLM for account activation
   - Mitigation: Balance monitoring + automated alerts
   - Buffer: Maintain 100+ XLM minimum balance

3. **Database Corruption**
   - Risk: Loss of farmer keys or transaction history
   - Mitigation: Hourly automated backups + immutable event sourcing
   - Recovery: Point-in-time restore capabilities

**⚡ Medium Risks**

4. **Pooler-Backend Communication Failures**
   - Risk: Plant requests timeout or fail
   - Mitigation: Retry logic + circuit breaker pattern
   - Monitoring: Health check endpoints

5. **Work Process Resource Exhaustion**
   - Risk: Too many work processes crash the pooler machine  
   - Mitigation: Max process limits + resource monitoring
   - Fallback: Reject excess farmers gracefully

6. **Harvest Timing Issues**
   - Risk: Missing optimal harvest windows
   - Mitigation: 30-second harvest interval + block-based triggers
   - Buffer: Harvest multiple blocks in batch

## 🚀 Deployment Strategy

**Phase 1A: Local Development (Hours 1-20)**
- Docker PostgreSQL + local backend/pooler services
- Test with 3-5 mock farmers on testnet
- Validate complete plant → work → harvest cycle

**Phase 1B: Testnet Deployment (Hours 21-35)**
- Deploy backend + pooler to VPS/cloud instance
- Test with 20+ real farmer accounts
- Load testing and performance optimization

**Phase 1C: Mainnet Ready (Hours 36-40)**  
- Production environment configuration
- Security review of custodial wallet management
- Master wallet funding and monitoring setup
- Go/no-go decision for mainnet deployment

## 🔄 Next Phase Planning

**Phase 2: Farmer Web Interface (Future)**
- Browser-based farmer dashboard
- Wallet connection and balance management
- Pooler selection and configuration
- Real-time mining statistics

**Phase 3: Advanced Features (Future)**
- Multiple pooler support and load balancing
- Encrypted custodial wallet storage
- Smart contract-based reward splitting
- Farmer reputation and staking tiers

---

**🎯 Bottom Line:** This Phase 1 plan delivers a working pooled KALE mining system in 40 hours that can immediately start coordinating farmers and poolers on mainnet. The architecture is intentionally simple but scalable, with clear upgrade paths for future phases.

**🚨 Critical Success Factor:** Nail the pooler-backend communication protocol and parallel plant execution. Everything else builds on this foundation.