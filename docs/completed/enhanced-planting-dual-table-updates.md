# Enhanced Planting Service - Dual Table Updates

## Overview

Enhanced the planting service to properly update both the detailed `plantings` table and the cumulative audit `block_operations` table during planting operations.

## Changes Made

### 1. **Dual Table Update Strategy**

**Before:** Only updated `plantings` table
**After:** Updates both `plantings` and `block_operations` tables

- **`plantings` table**: Detailed individual planting records with farmer info, timestamps, stake amounts, transaction hashes
- **`block_operations` table**: Cumulative audit trail with block-level statistics and operation tracking

### 2. **Enhanced PlantService Methods**

#### Added `markPlantOperationStarted(blockIndex, poolerId)`
- Creates/updates `block_operations` record for the block
- Sets `plant_requested_at` timestamp
- Ensures audit trail exists before operations begin

#### Added `updateBlockOperationsAfterPlanting(blockIndex, plantResult)`
- Updates `block_operations` with planting completion statistics:
  - `plant_completed_at`: Timestamp when planting finished
  - `total_farmers`: Number of farmers that attempted planting
  - `successful_plants`: Count of successful plant operations
  - `total_staked`: Total amount staked across all successful plants
  - `status`: Block status ('active' if any success, 'failed' if all failed)

### 3. **Updated Import Structure**
```typescript
// Added blockOperationQueries import
import { farmerQueries, plantQueries, poolerQueries, blockOperationQueries } from './database';
```

### 4. **Enhanced processPlantRequest Flow**

```typescript
async processPlantRequest(blockIndex, poolerId, maxFarmersCapacity) {
  try {
    // 1. Mark operation started in block_operations
    await this.markPlantOperationStarted(blockIndex, poolerId);
    
    // 2. Execute individual plant operations (updates plantings table)
    const plantResults = await this.executePlantBatch(blockIndex, poolerId, farmers);
    
    // 3. Update block_operations with cumulative results
    await this.updateBlockOperationsAfterPlanting(blockIndex, result);
    
    return result;
  } catch (error) {
    // Error handling
  }
}
```

## Data Flow

### Individual Plant Operation
1. **`stellarWalletManager.plantForFarmer()`** - Execute Stellar transaction
2. **`plantQueries.recordPlanting()`** - Record detailed plant info in `plantings` table

### Block-Level Coordination  
1. **`blockOperationQueries.createBlockOperation()`** - Ensure block record exists
2. **`blockOperationQueries.updateBlockOperationPlantStarted()`** - Mark plant start time
3. **`blockOperationQueries.updateBlockOperationStats()`** - Update cumulative statistics

## Database Schema Context

### `plantings` Table (Detailed Records)
```sql
CREATE TABLE plantings (
    id UUID PRIMARY KEY,
    block_index INTEGER NOT NULL,
    farmer_id UUID NOT NULL REFERENCES farmers(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    custodial_wallet VARCHAR(56) NOT NULL,
    stake_amount BIGINT NOT NULL,
    transaction_hash VARCHAR(64),
    status VARCHAR(20) CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    planted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `block_operations` Table (Cumulative Audit)
```sql
CREATE TABLE block_operations (
    id UUID PRIMARY KEY,
    block_index INTEGER UNIQUE NOT NULL,
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    plant_requested_at TIMESTAMP WITH TIME ZONE,
    plant_completed_at TIMESTAMP WITH TIME ZONE,
    work_completed_at TIMESTAMP WITH TIME ZONE,
    harvest_completed_at TIMESTAMP WITH TIME ZONE,
    total_farmers INTEGER DEFAULT 0,
    successful_plants INTEGER DEFAULT 0,
    successful_works INTEGER DEFAULT 0,
    successful_harvests INTEGER DEFAULT 0,
    total_staked BIGINT DEFAULT 0,
    total_rewards BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed'))
);
```

## Benefits

1. **Complete Audit Trail**: Both detailed and summary views of planting operations
2. **Block-Level Tracking**: Easy monitoring of entire block operations lifecycle
3. **Performance Analytics**: Aggregate statistics for performance monitoring
4. **Error Resilience**: Audit table updates don't fail main operations
5. **Data Integrity**: Consistent state between detailed and summary tables

## Usage Example

```typescript
// Planting request creates both detailed and summary records
const result = await plantService.processPlantRequest(
  blockIndex: 12345,
  poolerId: 'uuid-of-pooler',
  maxFarmersCapacity: 50
);

// Results in:
// 1. Individual records in 'plantings' table for each farmer
// 2. Aggregated statistics in 'block_operations' table for the block
```

## Error Handling

- **Main Operations**: Failures in plant transactions are recorded but don't stop processing
- **Audit Updates**: Block operations table updates are wrapped in try/catch to prevent audit failures from breaking core functionality
- **Graceful Degradation**: System continues operating even if audit updates fail

This enhancement provides comprehensive tracking of planting operations while maintaining system reliability and performance.
