# KALE Pool Mining System - Technical Architecture

*Documentation of implemented system architecture and data flows*

## 🏗️ System Architecture Overview

### **High-Level Architecture**
```
┌─────────────────────────────────────────────────────────────────┐
│                    KALE Pool Mining System                     │
│                         Phase 1                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │     Pooler      │    │    Backend      │
│   Miners        │    │   (Future)      │    │  (Completed)    │
│                 │    │                 │    │                 │
│ • Submit Nonces │───►│ • Block Monitor │◄──►│ • REST API      │
│ • Get Work      │    │ • Work Coord.   │    │ • Plant Service │
│ • Join Pool     │    │ • Farmer Mgmt   │    │ • Work Service  │
└─────────────────┘    └─────────────────┘    │ • Harvest Svc   │
                                              │ • Wallet Mgr    │
                                              └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   PostgreSQL    │
                                              │                 │
                                              │ • Event Logs    │
                                              │ • Audit Trail   │
                                              │ • State Mgmt    │
                                              └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Stellar Network                         │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ Custodial       │    │ KALE Contract   │    │   Horizon   │ │
│  │ Wallets         │    │                 │    │   Server    │ │
│  │                 │    │ • plant()       │    │             │ │
│  │ • Farmer Keys   │◄──►│ • work()        │◄──►│ • Tx Submit │ │
│  │ • Auto Mgmt     │    │ • harvest()     │    │ • Account   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 **Data Flow Diagrams**

### **1. Farmer Registration Flow**
```
External Miner
     │
     │ POST /farmers/register
     │ { poolerId, stakePercentage }
     ▼
Backend API Server
     │
     │ validateRequest()
     ▼
Wallet Manager
     │
     │ generateWallet()
     ▼
Stellar Network
     │
     │ createKeypair()
     ▼
Database Service
     │
     │ farmerQueries.createFarmer()
     ▼
PostgreSQL
     │
     │ INSERT farmers table
     ▼
Response
{ farmerId, custodialWallet, status }
```

### **2. Plant Coordination Flow**
```
Pooler Service
     │
     │ POST /plant
     │ { blockIndex, poolerId, maxCapacity }
     ▼
Plant Service
     │
     ├─ getEligibleFarmers()
     │  │
     │  ▼
     │  Database Query → Funded Farmers List
     │
     ├─ executePlantBatch()
     │  │
     │  ▼
     │  Parallel Processing (10 threads)
     │  │
     │  ├─ stellarWalletManager.plantForFarmer()
     │  │  │
     │  │  ▼
     │  │  Stellar Network → KALE Contract plant()
     │  │
     │  └─ plantQueries.recordPlanting()
     │     │
     │     ▼
     │     Database → Immutable Event Log
     │
     ▼
Response Summary
{ successfulPlants, failedPlants, totalStaked }
```

### **3. Work Submission Flow**
```
Multiple External Miners
     │
     │ Submit Nonces
     ▼
Pooler Service (Future)
     │
     │ POST /work
     │ { blockIndex, poolerId, submissions[] }
     ▼
Work Service
     │
     ├─ validateNonces()
     │  │
     │  ▼
     │  Parallel Validation (timeout protected)
     │
     ├─ processValidWork()
     │  │
     │  ▼
     │  Batch Processing
     │  │
     │  ├─ stellarWalletManager.workForFarmer()
     │  │  │
     │  │  ▼
     │  │  Stellar Network → KALE Contract work()
     │  │
     │  └─ workQueries.recordWork()
     │     │
     │     ▼
     │     Database → Work Event Log
     │
     ▼
Response Summary
{ validNonces, submittedWork, totalRewards }
```

### **4. Harvest Distribution Flow**
```
Block Completion Event
     │
     ▼
Pooler Service (Future)
     │
     │ POST /harvest
     │ { blockIndex, poolerId }
     ▼
Harvest Service
     │
     ├─ getHarvestableFarmers()
     │  │
     │  ▼
     │  Database Query → Workers in Block
     │
     ├─ calculateRewards()
     │  │
     │  ▼
     │  Work Count × Base Reward × Multipliers
     │
     ├─ executeHarvestBatch()
     │  │
     │  ▼
     │  Parallel Processing
     │  │
     │  ├─ stellarWalletManager.harvestForFarmer()
     │  │  │
     │  │  ▼
     │  │  Stellar Network → KALE Contract harvest()
     │  │
     │  ├─ harvestQueries.recordHarvest()
     │  │  │
     │  │  ▼
     │  │  Database → Harvest Event Log
     │  │
     │  └─ farmerQueries.updateBalance()
     │     │
     │     ▼
     │     Database → Updated Farmer Balance
     │
     ▼
Response Summary
{ successfulHarvests, totalRewards, processingTime }
```

## 🗄️ **Database Schema Architecture**

### **Event Sourcing Design**
```sql
-- Core Entities
farmers (id, pooler_id, custodial_keys, balance, status)
poolers (id, name, configuration, last_seen)

-- Immutable Event Tables
plantings (id, block_index, farmer_id, stake_amount, tx_hash, timestamp)
works (id, block_index, farmer_id, nonce, hash, zeros, tx_hash, timestamp)
harvests (id, block_index, farmer_id, reward_amount, tx_hash, timestamp)

-- Event sourcing benefits:
✅ Complete audit trail
✅ Immutable history
✅ Easy debugging and reconciliation
✅ Performance optimized queries
```

### **Key Database Patterns**
- **UUID Primary Keys**: Security and distributed system compatibility
- **Timestamp Tracking**: All events have precise timing
- **Status Enums**: Consistent state management
- **Foreign Key Constraints**: Data integrity
- **Indexed Queries**: Performance optimization

## 🔧 **Service Architecture Details**

### **Wallet Manager Service**
```typescript
class StellarWalletManager {
  // Core wallet operations
  generateWallet() → WalletKeypair
  isAccountFunded(publicKey) → boolean
  
  // KALE contract operations  
  plantForFarmer(secretKey, stakeAmount) → TransactionResult
  workForFarmer(secretKey, nonce, hash) → TransactionResult
  harvestForFarmer(secretKey, blockIndex) → TransactionResult
  
  // Batch operations for efficiency
  batchPlantOperations(operations[]) → BatchResult[]
  batchWorkOperations(operations[]) → BatchResult[]
  batchHarvestOperations(operations[]) → BatchResult[]
}
```

### **Plant Service Architecture**
```typescript
class PlantService {
  // Main coordination
  processPlantRequest(blockIndex, poolerId, maxCapacity) → PlantServiceResult
  
  // Internal operations
  getEligibleFarmers(poolerId, maxCapacity) → FarmerRow[]
  executePlantBatch(farmers[]) → PlantAttempt[]
  calculateStakeAmount(farmer) → string
  
  // Configuration
  MAX_BATCH_SIZE = 50
  PARALLEL_LIMIT = 10
}
```

### **Work Service Architecture**
```typescript
class WorkService {
  // Main coordination
  processWorkSubmissions(blockIndex, poolerId, submissions[]) → WorkServiceResult
  
  // Processing pipeline
  executeWorkBatch(submissions[]) → WorkAttempt[]
  validateNonce(nonce, blockIndex) → boolean
  calculateWorkReward(farmer) → string
  
  // Performance settings
  NONCE_VALIDATION_TIMEOUT = 5000ms
  PARALLEL_LIMIT = 10
}
```

### **Harvest Service Architecture**
```typescript
class HarvestService {
  // Main coordination
  processHarvestRequest(blockIndex, poolerId) → HarvestServiceResult
  
  // Reward logic
  getHarvestableFarmers(blockIndex, poolerId) → FarmerRow[]
  calculateHarvestReward(blockIndex, farmerId) → string
  getWorkerWorkCount(blockIndex, farmerId) → number
  
  // Parallel processing
  executeHarvestBatch(farmers[]) → HarvestAttempt[]
}
```

## 🌐 **REST API Architecture**

### **Endpoint Specifications**

#### **POST /farmers/register**
```json
Request: {
  "poolerId": "uuid",
  "stakePercentage": 0.8,
  "metadata": { "minerInfo": "..." }
}

Response: {
  "farmerId": "uuid",
  "custodialWallet": "GXXXXX...",
  "poolerId": "uuid",
  "status": "active",
  "currentBalance": "0",
  "registeredAt": "2025-08-25T10:00:00Z"
}
```

#### **POST /plant**
```json
Request: {
  "blockIndex": 12345,
  "poolerId": "uuid", 
  "maxFarmersCapacity": 100
}

Response: {
  "blockIndex": 12345,
  "poolerId": "uuid",
  "totalRequested": 85,
  "successfulPlants": 82,
  "failedPlants": 3,
  "totalStaked": "1500000000000",
  "processingTimeMs": 2340
}
```

#### **POST /work**
```json
Request: {
  "blockIndex": 12345,
  "poolerId": "uuid",
  "submissions": [
    {
      "farmerId": "uuid",
      "nonce": "123456789",
      "timestamp": 1692975600000
    }
  ]
}

Response: {
  "blockIndex": 12345,
  "poolerId": "uuid", 
  "totalSubmissions": 50,
  "validNonces": 35,
  "submittedWork": 32,
  "totalRewards": "25000000000",
  "processingTimeMs": 1850
}
```

#### **POST /harvest**
```json
Request: {
  "blockIndex": 12345,
  "poolerId": "uuid"
}

Response: {
  "blockIndex": 12345,
  "poolerId": "uuid",
  "totalEligible": 45,
  "successfulHarvests": 43,
  "failedHarvests": 2,
  "totalRewards": "50000000000",
  "processingTimeMs": 3200
}
```

## ⚡ **Performance Architecture**

### **Parallel Processing Strategy**
```
Plant Operations:
├─ Batch Size: 50 farmers maximum
├─ Parallel Threads: 10 concurrent operations
├─ Timeout Protection: 30 seconds per operation
└─ Error Recovery: Individual failure handling

Work Submissions:
├─ Batch Processing: Configurable batch sizes
├─ Nonce Validation: 5 second timeout per nonce
├─ Parallel Execution: 10 concurrent validations
└─ Result Aggregation: Success/failure statistics

Harvest Distribution:
├─ Eligibility Check: Database query optimization
├─ Reward Calculation: Cached multipliers
├─ Parallel Harvests: 10 concurrent distributions
└─ Balance Updates: Atomic database transactions
```

### **Database Optimization**
```sql
-- Performance Indexes
CREATE INDEX idx_farmers_pooler_status ON farmers(pooler_id, status);
CREATE INDEX idx_plantings_block_farmer ON plantings(block_index, farmer_id);
CREATE INDEX idx_works_block_pooler ON works(block_index, pooler_id);
CREATE INDEX idx_harvests_block_farmer ON harvests(block_index, farmer_id);

-- Query Optimization
- Connection pooling for concurrent requests
- Prepared statements for repeated queries  
- Transaction batching for bulk operations
- Read replicas for analytics (future)
```

## 🔒 **Security Architecture**

### **Custodial Wallet Security**
- **Key Generation**: Cryptographically secure Stellar keypairs
- **Secret Storage**: Encrypted storage in database
- **Access Control**: Service-to-service authentication only
- **Audit Trail**: All wallet operations logged immutably

### **API Security**
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Configurable per-endpoint limits
- **Error Handling**: No sensitive data in error responses
- **Health Monitoring**: Service status without secrets

### **Database Security**
- **Connection Security**: TLS encrypted connections
- **Access Control**: Role-based database permissions
- **Audit Logging**: All database operations tracked
- **Backup Strategy**: Encrypted backup procedures

## 📊 **Monitoring & Observability**

### **Health Monitoring**
```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'unhealthy',
  services: {
    plant: boolean,
    work: boolean, 
    harvest: boolean,
    wallet: boolean
  },
  uptime: number,
  timestamp: string
}
```

### **Service Metrics**
```typescript
GET /info → {
  service: 'KALE Pool Mining Backend',
  version: '1.0.0',
  network: { type: 'testnet', horizon: 'url' },
  config: { maxFarmers: 1000, rateLimit: 100 },
  uptime: 86400,
  services: { /* detailed service info */ }
}
```

### **Structured Logging**
- **Request/Response Logging**: All API calls tracked
- **Service Operation Logging**: Internal service calls
- **Error Context Logging**: Detailed error information
- **Performance Logging**: Operation timing and metrics

## 🚀 **Deployment Architecture**

### **Environment Configuration**
```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/kale_pool
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Stellar Network
STELLAR_NETWORK=testnet  # or mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
KALE_CONTRACT_ID=CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K

# API Configuration  
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=production

# Rate Limiting
API_RATE_LIMIT=100
REQUEST_TIMEOUT=30000
```

### **Runtime Requirements**
- **Runtime**: Bun 1.2+ (or Node.js 18+)
- **Database**: PostgreSQL 13+
- **Memory**: 512MB minimum, 2GB recommended
- **CPU**: 2 cores minimum, 4 cores recommended
- **Storage**: 10GB minimum for logs and database

### **Container Ready**
```dockerfile
# Ready for containerization
FROM oven/bun:1.2-slim
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## 🎯 **Integration Points**

### **Future Pooler Service Integration**
```typescript
// Expected Pooler → Backend API calls
POST /farmers/register  // Register new miners
POST /plant            // Coordinate block planting
POST /work             // Submit miner work
POST /harvest          // Distribute rewards
GET /health           // Monitor service status
```

### **External Miner Integration**
```typescript
// Miners → Pooler API calls (future)
GET /work             // Get mining work
POST /submit          // Submit nonce solution  
GET /stats           // Get mining statistics
POST /join           // Join mining pool
```

### **Blockchain Integration**
- **Stellar Network**: Direct integration via Horizon API
- **KALE Contract**: Smart contract operations for plant/work/harvest
- **Transaction Management**: Robust error handling and retry logic
- **Account Monitoring**: Real-time balance and status tracking

---

*This technical architecture documentation represents the complete Phase 1 Backend implementation, ready for Pooler service integration and external miner connectivity.*
