# API Endpoint Alignment - Frontend vs Backend

## Overview
This document outlines the alignment between the frontend API client and the backend API endpoints for the KALE Pool system.

## ✅ Aligned Endpoints

### Health & Info
| Frontend | Backend | Status |
|----------|---------|--------|
| `GET /api/health` | `GET /health` | ✅ Aligned |
| `GET /api/info` | `GET /info` | ✅ Aligned |

### Registration & User Management
| Frontend | Backend | Status |
|----------|---------|--------|
| `POST /api/register` | `POST /register` | ✅ Aligned |
| `POST /api/check-funding` | `POST /check-funding` | ✅ Aligned |
| `GET /api/user/:userId/status` | `GET /user/:userId/status` | ✅ Aligned |

### Pooler Management
| Frontend | Backend | Status |
|----------|---------|--------|
| `GET /api/poolers` | `GET /poolers` | ✅ Aligned |
| `GET /api/pooler/:poolerId/details` | `GET /pooler/:poolerId/details` | ✅ Aligned |
| `POST /api/join-pool` | `POST /join-pool` | ✅ Aligned |
| `POST /api/confirm-pool-join` | `POST /confirm-pool-join` | ✅ Aligned |
| `POST /api/registerPooler` | `POST /registerPooler` | ✅ Aligned |

### Block Operations
| Frontend | Backend | Status |
|----------|---------|--------|
| `POST /api/plant` | `POST /plant` | ✅ Aligned |
| `POST /api/work` | `POST /api/work` | ✅ Aligned |
| `POST /api/harvest` | `POST /harvest` | ✅ Aligned |

### Pooler Console
| Frontend | Backend | Status |
|----------|---------|--------|
| `POST /api/pooler/block-discovered` | `POST /pooler/block-discovered` | ✅ Aligned |
| `GET /api/pooler/status` | `GET /pooler/status` | ✅ Aligned |

### Additional Endpoints
| Frontend | Backend | Status |
|----------|---------|--------|
| `POST /api/farmers/register` | `POST /farmers/register` | ✅ Aligned |
| `POST /api/register-farmer` | `POST /register-farmer` | ✅ Aligned |
| `POST /api/pooler/work-completed` | `POST /pooler/work-completed` | ✅ Aligned |

### Harvest Management
| Frontend | Backend | Status |
|----------|---------|--------|
| `POST /api/harvest/start` | `POST /harvest/start` | ✅ Aligned |
| `POST /api/harvest/stop` | `POST /harvest/stop` | ✅ Aligned |
| `GET /api/harvest/status` | `GET /harvest/status` | ✅ Aligned |
| `POST /api/harvest/trigger` | `POST /harvest/trigger` | ✅ Aligned |

## 🔧 Changes Made

### Frontend API Client Updates (`client/lib/api-client.ts`)
1. **Removed `/registration/` prefix** from all registration-related endpoints
2. **Updated endpoint paths** to match backend exactly:
   - `/registration/registerUser` → `/register`
   - `/registration/checkFunding` → `/check-funding`
   - `/registration/user/:userId/status` → `/user/:userId/status`
   - `/registration/poolers` → `/poolers`
   - `/registration/poolers/:poolerId` → `/pooler/:poolerId/details`
   - `/registration/joinPool` → `/join-pool`
   - `/registration/confirmJoin` → `/confirm-pool-join`
3. **Added missing endpoints**:
   - `registerFarmer()` for Phase 1 farmer registration
   - `registerFarmerSimple()` for Phase 2 simple farmer registration
   - `registerPooler()` for pooler registration
   - `notifyWorkCompleted()` for work completion notifications
   - Harvest management endpoints: `startHarvestService()`, `stopHarvestService()`, `getHarvestStatus()`, `triggerHarvest()`
4. **Fixed export conflicts** for `APIClientError` type

### Frontend Configuration Updates
1. **Removed frontend server completely** - Frontend now makes direct API calls to KALE Pool backend
2. **Updated API base URL** to point to KALE Pool backend: `http://localhost:3001`
3. **Removed server dependencies** from package.json:
   - `express`, `cors`, `dotenv`, `serverless-http`
   - `@types/express`, `@types/cors`
4. **Updated build configuration**:
   - Removed server build scripts
   - Simplified Vite config to remove Express plugin
   - Updated build output directory to `dist`

## 📋 Backend API Structure

### Phase 1 Backend (server.ts)
- Health and info endpoints
- Direct farmer registration
- Block operations (plant, work, harvest)
- Pooler block discovery and status

### Phase 2 Backend (registration-routes.ts)
- User registration with email validation
- Funding status checks
- Pool discovery and joining
- Pooler registration

## 🎯 API Usage Patterns

### Frontend API Client Methods
```typescript
// Health & Info
apiClient.getHealth()
apiClient.getInfo()

// Registration
apiClient.registerUser(data)
apiClient.checkFunding(data)
apiClient.getUserStatus(userId)

// Pooler Management
apiClient.getPoolers(userId, filters)
apiClient.getPoolerDetails(poolerId, userId)
apiClient.joinPool(data)
apiClient.confirmJoin(data)
apiClient.registerPooler(data)

// Block Operations
apiClient.plant(data)
apiClient.work(data)
apiClient.harvest(data)

// Pooler Console
apiClient.notifyBlockDiscovered(data)
apiClient.getPoolerStatus()
```

## 🔄 Request/Response Flow

1. **Frontend** calls API client methods
2. **API Client** makes HTTP requests directly to KALE Pool backend at `http://localhost:3001`
3. **KALE Pool Backend** handles requests and returns responses
4. **Response** flows back to frontend

## 🚀 Next Steps

1. **Test API Integration**: Verify all endpoints work correctly with the backend
2. **Add Error Handling**: Implement proper error handling for API failures
3. **Add Authentication**: Implement API key or token-based authentication
4. **Add Rate Limiting**: Implement client-side rate limiting
5. **Add Caching**: Implement response caching for better performance

## 📝 Notes

- The frontend now makes direct API calls to the KALE Pool backend
- The backend endpoints don't have the `/api/` prefix
- API base URL is configured to `http://localhost:3001` (KALE Pool backend)
- All endpoints now match between frontend and backend exactly
- Frontend server has been completely removed for simplicity
