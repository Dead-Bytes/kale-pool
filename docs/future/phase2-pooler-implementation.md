# Phase 2: Pooler Service Implementation Plan

## 📋 **Executive Summary**

**Objective**: Complete the KALE Pool Mining System by implementing the Pooler service that coordinates with external miners and the Backend API.

**Scope**: Block monitoring, work distribution, miner management, and Backend integration

**Timeline**: 10 working days (following Phase 1 completion)

**Status**: Ready to begin after Phase 1 TypeScript compilation fixes

## 🎯 **Phase 2 Goals**

### **Primary Objectives**
1. **Block Monitoring Service**: Detect new KALE blocks and trigger mining operations
2. **External Miner API**: REST endpoints for miners to join pool and submit work
3. **Work Distribution**: Coordinate mining work across multiple external miners
4. **Backend Integration**: Seamless communication with Phase 1 Backend services
5. **Farmer Lifecycle Management**: Handle farmer registration, status, and rewards

### **Integration Targets**
- **Backend API**: Complete integration with /plant, /work, /harvest endpoints
- **KALE Network**: Direct monitoring of blockchain for block changes
- **External Miners**: API for existing kale-miner implementations
- **Monitoring Systems**: Real-time dashboards and performance metrics

## 🏗️ **System Architecture**

### **Pooler Service Components**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pooler Service Architecture                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │     Pooler      │    │    Backend      │
│   Miners        │    │   Service       │    │     API         │
│                 │    │                 │    │                 │
│ • Get Work      │◄──►│ • Block Monitor │◄──►│ • Plant/Work    │
│ • Submit Nonces │    │ • Work Manager  │    │ • Harvest       │
│ • Join/Leave    │    │ • Miner API     │    │ • Farmer Mgmt   │
│ • Get Stats     │    │ • Coordinator   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ KALE Blockchain │
                       │                 │
                       │ • Block Monitor │
                       │ • Contract Data │
                       └─────────────────┘
```

## 📦 **Component Specifications**

### **1. Block Monitor Service** 
**File**: `Pooler/src/services/block-monitor.ts`

**Responsibilities**:
- Poll KALE blockchain every 5 seconds for new blocks
- Detect block index changes and trigger mining operations
- Fetch block entropy and mining parameters
- Handle network errors and reconnection

**Key Functions**:
```typescript
class BlockMonitor {
  startMonitoring(): void
  getCurrentBlockData(): Promise<KaleBlockData>
  onNewBlock(callback: (block: KaleBlockData) => void): void
  stopMonitoring(): void
}
```

### **2. Work Manager Service**
**File**: `Pooler/src/services/work-manager.ts`

**Responsibilities**:
- Coordinate work distribution across active miners
- Manage mining work assignments and load balancing
- Handle miner capacity and performance tracking
- Process work submissions and validate nonces

**Key Functions**:
```typescript
class WorkManager {
  assignWork(block: KaleBlockData): Promise<WorkAssignment[]>
  submitNonce(minerId: string, nonce: string): Promise<SubmissionResult>
  getActiveMiners(): MinerInfo[]
  balanceWorkload(): void
}
```

### **3. Plant Coordinator**
**File**: `Pooler/src/services/plant-coordinator.ts`

**Responsibilities**:
- Call Backend API for coordinated planting operations
- Handle plant request responses and farmer coordination
- Manage timing for optimal plant execution
- Error handling and retry logic for plant failures

**Key Functions**:
```typescript
class PlantCoordinator {
  executePlantPhase(block: KaleBlockData): Promise<PlantResult>
  handlePlantResponse(response: PlantResponse): void
  scheduleOptimalPlanting(blockIndex: number): void
}
```

### **4. Harvest Controller**
**File**: `Pooler/src/services/harvest-controller.ts`

**Responsibilities**:
- Trigger harvest operations for completed blocks
- Coordinate reward distribution through Backend API
- Handle batch harvesting for multiple blocks
- Process harvest responses and update tracking

**Key Functions**:
```typescript
class HarvestController {
  executeHarvestPhase(blockIndex: number): Promise<HarvestResult>
  processBatchHarvest(blockIndices: number[]): Promise<BatchHarvestResult>
  handleHarvestResponse(response: HarvestResponse): void
}
```

### **5. External Miner API**
**File**: `Pooler/src/routes/miner-api.ts`

**Responsibilities**:
- Provide REST endpoints for external miners
- Handle miner registration and authentication
- Serve work assignments and receive submissions
- Provide mining statistics and performance metrics

**API Endpoints**:
```typescript
POST   /miner/register     // Register new miner
GET    /miner/work        // Get current mining work
POST   /miner/submit      // Submit nonce solution
GET    /miner/stats       // Get mining statistics
POST   /miner/leave       // Leave mining pool
GET    /health            // Service health check
```

## 🔄 **Complete System Workflow**

### **Block Cycle Flow**
```
1. Block Detection
   BlockMonitor detects new block N
   ↓
2. Plant Phase
   PlantCoordinator → Backend API /plant
   ↓
3. Work Distribution  
   WorkManager assigns work to external miners
   ↓
4. Mining Period
   External miners submit nonces via /miner/submit
   ↓
5. Work Submission
   WorkManager → Backend API /work with valid nonces
   ↓
6. Harvest Phase
   HarvestController → Backend API /harvest
   ↓
7. Cycle Complete
   Return to Block Detection for next block
```

### **Miner Integration Flow**
```
1. Miner Registration
   External miner → POST /miner/register
   ↓
2. Work Request
   Miner → GET /miner/work → Current block data
   ↓
3. Mining Process
   Miner performs local hashing/mining
   ↓
4. Solution Submission
   Miner → POST /miner/submit → Valid nonce
   ↓
5. Statistics
   Miner → GET /miner/stats → Performance metrics
```

## 🛠️ **Technical Implementation Details**

### **Dependencies**
```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^12.1.0",
    "fastify": "^4.24.3",
    "@fastify/cors": "^9.0.1",
    "axios": "^1.6.0",
    "ws": "^8.14.2",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  }
}
```

### **Environment Configuration**
```bash
# Service Configuration
POOLER_ID=generated-uuid
POOLER_NAME=MainnetPooler01
PORT=3001

# Backend Integration
BACKEND_API_URL=http://localhost:3000
BACKEND_TIMEOUT=30000
RETRY_ATTEMPTS=3

# KALE Network
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
KALE_CONTRACT_ID=CONTRACT_ADDRESS
BLOCK_POLL_INTERVAL_MS=5000

# Performance
MAX_CONCURRENT_MINERS=100
WORK_TIMEOUT_MINUTES=5
OPTIMAL_WORK_DELAY_MS=280000
```

### **Error Handling Strategy**
- **Network Failures**: Exponential backoff with maximum retry limits
- **Backend API Errors**: Graceful degradation and error reporting
- **Miner Disconnections**: Automatic work reassignment
- **Block Monitoring Failures**: Restart monitoring with state preservation

## 📊 **Performance Requirements**

### **Throughput Targets**
- **Block Detection**: < 1 second after blockchain update
- **Plant Coordination**: Complete within 30 seconds
- **Work Distribution**: Handle 100+ concurrent miners
- **Nonce Processing**: < 100ms per submission
- **Harvest Execution**: Complete within 60 seconds

### **Scalability Features**
- **Horizontal Scaling**: Multiple Pooler instances with load balancing
- **Miner Capacity**: Dynamic scaling based on block complexity
- **Connection Management**: WebSocket support for real-time updates
- **Resource Monitoring**: CPU/memory usage optimization

## 🔗 **Integration Points**

### **Backend API Integration**
```typescript
// Required Backend API calls
POST /farmers/register  // Register miners as farmers
POST /plant            // Coordinate block planting
POST /work             // Submit validated work
POST /harvest          // Distribute rewards
GET  /health           // Monitor Backend status
```

### **KALE Blockchain Integration**
```typescript
// Direct blockchain monitoring
getCurrentBlock(): Promise<KaleBlockData>
getBlockEntropy(index: number): Promise<string>
getContractState(): Promise<ContractState>
subscribeToBlocks(callback): void
```

### **External Miner Integration**
```typescript
// Miner-facing API endpoints
GET  /miner/work       // Current mining parameters
POST /miner/submit     // Nonce submissions
GET  /miner/stats      // Performance statistics
POST /miner/register   // Pool registration
```

## 🧪 **Testing Strategy**

### **Unit Testing**
- Block monitor state management
- Work distribution algorithms
- API request/response handling
- Error recovery mechanisms

### **Integration Testing**
- Backend API communication
- KALE blockchain interactions
- External miner workflows
- End-to-end mining cycles

### **Performance Testing**
- Concurrent miner handling
- Block detection latency
- API response times
- Resource utilization

## 📈 **Implementation Timeline**

### **Week 1: Core Services (Days 1-5)**
- **Day 1-2**: Block Monitor implementation
- **Day 3-4**: Plant Coordinator and Backend integration
- **Day 5**: Work Manager foundation

### **Week 2: Integration & Testing (Days 6-10)**
- **Day 6-7**: Harvest Controller and external API
- **Day 8**: Complete integration testing
- **Day 9**: Performance optimization
- **Day 10**: Documentation and deployment preparation

## ✅ **Success Criteria**

### **Functional Requirements**
- ✅ Block detection within 5 seconds of blockchain update
- ✅ Successful plant/work/harvest cycle coordination
- ✅ Handle 50+ concurrent external miners
- ✅ Complete integration with Backend API
- ✅ Real-time miner statistics and monitoring

### **Non-Functional Requirements**
- ✅ 99%+ uptime during mining operations
- ✅ < 1% work assignment failures
- ✅ Graceful handling of network errors
- ✅ Comprehensive logging and monitoring
- ✅ Production deployment readiness

## 🚀 **Deployment Strategy**

### **Development Environment**
1. Local Backend API running on port 3000
2. PostgreSQL database with test data
3. Testnet KALE contract for safe testing
4. Mock external miners for integration testing

### **Production Deployment**
1. Containerized Pooler service
2. Load balancer for multiple instances
3. Redis for shared state management
4. Comprehensive monitoring and alerting

---

**Phase 2 represents the completion of the KALE Pool Mining System, enabling external miners to join pools and participate in coordinated KALE farming operations. This implementation will provide a complete, production-ready mining pool infrastructure.**

*Implementation Plan: Phase 2 - Pooler Service*  
*Created: August 25, 2025*  
*Status: Ready for implementation after Phase 1 TypeScript fixes*