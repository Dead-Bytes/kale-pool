# Farmer Stake & Rewards API - Proposed Endpoints

## Overview
Current APIs expose operational triggers (plant/work/harvest) and status, but they do not provide farmer-centric views of per-block stakes and rewards. These read-only endpoints surface event-sourced data for accurate UI/analytics without calculating on the client.

**Required Prerequisite: Poolers Endpoint**

The system currently **DOES NOT** have a poolers endpoint, which is blocking pool discovery functionality.

```bash
GET /poolers?page=1&limit=6  # Get paginated list of available poolers
```

Why this is critically needed:
- **Missing Infrastructure**: No existing endpoint to list available poolers
- **Pool Discovery Blocked**: Farmers cannot discover which poolers are available to join
- **UI Dependency**: Frontend pool discovery features require this endpoint to function
- **Multi-Pool Support**: Essential for farmers to browse and select from multiple poolers
---

## 0) Get Poolers List
GET `/poolers`

Goal:
- Return a paginated list of available poolers for farmers to discover and select from.

Query params:
- `page` (optional, default 1)
- `limit` (optional, default 6, max 50)
- `status` (optional): `active` | `inactive` | `all` (default `active`)

Response 200:
```json
{
  "page": 1,
  "limit": 6,
  "total": 12,
  "items": [
    {
      "id": "<uuid>",
      "name": "Kale Pool Alpha",
      "description": "High-performance mining pool with 24/7 uptime",
      "status": "active",
      "totalStaked": "50000000000",
      "totalStakedHuman": "5000.0000000",
      "farmersCount": 45,
      "averageReward": "125000000",
      "averageRewardHuman": "12.5000000",
      "createdAt": "2025-08-01T09:00:00Z"
    }
  ]
}
```

Why:
- Farmers need to discover available poolers before they can stake with them.
- Pool discovery is essential for the multi-pool ecosystem to function.

---

## 1) Get Farmer Stake History
GET `/farmers/:farmerId/plantings`

Goal:
- Return an accurate, paginated history of stakes by block for a given farmer.

Query params:
- `poolerId` (optional): filter to a specific pooler
- `from` (optional, ISO datetime or block index): start time/index inclusive
- `to` (optional, ISO datetime or block index): end time/index inclusive
- `page` (optional, default 1)
- `limit` (optional, default 25, max 200)
- `status` (optional): `success` | `failed` | `all` (default `success`)

Response 200:
```json
{
  "farmerId": "<uuid>",
  "page": 1,
  "limit": 25,
  "total": 123,
  "items": [
    {
      "id": "<uuid>",
      "blockIndex": 78123,
      "poolerId": "<uuid>",
      "stake_amount": "250000000",
      "stakeAmountHuman": "25.0000000",
      "transactionHash": "<hash>",
      "status": "success",
      "timestamp": "2025-08-26T10:45:02Z"
    }
  ]
}
```

Why:
- `plantings.stake_amount` is the ground truth for what was actually staked per block.

---

## 2) Get Farmer Rewards (Harvest) History
GET `/farmers/:farmerId/harvests`

Goal:
- Return an accurate, paginated history of rewards (per block) for a given farmer.

Query params:
- `poolerId` (optional)
- `from` (optional)
- `to` (optional)
- `page` (optional, default 1)
- `limit` (optional, default 25, max 200)
- `status` (optional): `success` | `failed` | `all` (default `success`)

Response 200:
```json
{
  "farmerId": "<uuid>",
  "page": 1,
  "limit": 25,
  "total": 98,
  "items": [
    {
      "id": "<uuid>",
      "blockIndex": 78123,
      "poolerId": "<uuid>",
      "reward_amount": "1250000000",
      "rewardAmountHuman": "125.0000000",
      "transactionHash": "<hash>",
      "status": "success",
      "timestamp": "2025-08-26T11:05:12Z"
    }
  ]
}
```

Why:
- Rewards are event-sourced in `harvests.reward_amount` per farmer per block.

---

## 3) Get Farmer Summary (Current + Aggregates)
GET `/farmers/:farmerId/summary`

Goal:
- Provide a compact snapshot and aggregates for dashboards without multiple round-trips.

Query params:
- `poolerId` (optional): restrict to one pooler
- `window` (optional): e.g., `24h`, `7d`, `30d` for time-windowed aggregates

Response 200:
```json
{
  "farmerId": "<uuid>",
  "poolerId": "<uuid|null>",
  "contract": {
    "stakePercentage": 0.25,
    "harvestInterval": 3,
    "status": "active",
    "joinedAt": "2025-08-01T09:00:00Z"
  },
  "current": {
    "lastStakeAmount": "250000000",
    "lastStakeAmountHuman": "25.0000000",
    "lastStakeBlock": 78140,
    "lastRewardAmount": "1250000000",
    "lastRewardAmountHuman": "125.0000000",
    "lastRewardBlock": 78140
  },
  "lifetime": {
    "totalStaked": "12345000000",
    "totalStakedHuman": "1234.5000000",
    "totalRewards": "9876500000",
    "totalRewardsHuman": "987.6500000",
    "blocksParticipated": 320
  },
  "window": {
    "range": "7d",
    "staked": "1500000000",
    "stakedHuman": "150.0000000",
    "rewards": "2500000000",
    "rewardsHuman": "250.0000000",
    "blocks": 42
  }
}
```

Why:
- The UI needs both “current” (last stake/reward) and “aggregate” views quickly.
- Reduces client-side joins across multiple endpoints.

---

## 4) (Optional) Get Farmer Work History
GET `/farmers/:farmerId/works`

Goal:
- Return per-block work submissions attributed to the farmer, if tracked.

Query params: same as plantings/harvests.

Response 200 (example):
```json
{
  "farmerId": "<uuid>",
  "page": 1,
  "limit": 25,
  "total": 45,
  "items": [
    {
      "id": "<uuid>",
      "blockIndex": 78123,
      "poolerId": "<uuid>",
      "nonce": "0xabc...",
      "hash": "0xdef...",
      "zeros": 14,
      "gap": 2,
      "status": "success",
      "timestamp": "2025-08-26T10:52:11Z"
    }
  ]
}
```

Why:
- Some farmer views may show credited work signals, if attribution exists.

---

## Validation & Security

### Input Validation:
- Enforce numeric bounds on `limit`, validate UUIDs, and parse dates/block indices
- Sanitize all input parameters to prevent injection attacks
- Validate farmer ID format and existence

### Performance:
- Add indexes on `(farmer_id, block_index)`, `(farmer_id, pooler_id, block_index)` for `plantings` and `harvests`
- Implement query result caching for frequently accessed data
- Add database connection pooling for better performance

---

## Implementation Pointers

### Poolers Endpoint Implementation:
- **Endpoint**: `GET /poolers?page=1&limit=6`
- **Handler**: Add to `Backend/src/server-phase2.ts` or create `pooler-routes.ts`
- **Query**: Return paginated list of active poolers with basic info (id, name, status, etc.)
- **Response**: Include pagination metadata (page, limit, total, items)

### Farmer Endpoints Implementation:
- Handlers in `Backend/src/server-phase2.ts` or a new route module (e.g., `farmer-routes.ts`)
- Query helpers in `Backend/src/services/database-phase2.ts` (read methods over `plantings`, `harvests`, optional `works`)
- Reuse existing logging and error formats; return amounts as strings in atomic units with optional humanized fields

---

## Compatibility With Existing Endpoints
- Complements `GET /user/:userId/status` (which provides stakePercentage and balance, but not actual per-block stake/rewards).
- Does not change plant/work/harvest behavior; purely read-only analytics endpoints.

## Implementation Strategy

### Phase 1: Implement Poolers Endpoint
1. **Database Query**: Create query to fetch active poolers with pagination
2. **API Endpoint**: Implement `GET /poolers?page=1&limit=6`
3. **Response Format**: Standardize pagination response format
4. **Testing**: Test pagination and filtering functionality

### Phase 2: Implement Farmer Analytics Endpoints
1. **Database Queries**: Implement the farmer stake/rewards query functions
2. **API Endpoints**: Add the proposed farmer analytics endpoints
3. **Testing**: Comprehensive testing of all farmer analytics features

### Phase 3: Integration & Documentation
1. **Frontend Integration**: Update UI to use new poolers endpoint for pool discovery
2. **Documentation**: Update all API documentation with new endpoints
3. **Performance Optimization**: Add caching and optimize database queries
