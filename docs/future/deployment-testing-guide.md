# KALE Pool Mining - Deployment & Testing Guide

## 🚀 **Quick Start Guide**

### **Prerequisites**
```bash
# Required software
- Bun 1.2+ or Node.js 18+
- PostgreSQL 13+
- Git

# Optional for development
- Docker & Docker Compose
- Postman or curl for API testing
```

## 🔧 **Development Setup**

### **1. Clone and Setup**
```bash
git clone <repository>
cd kale-pool-mining

# Install dependencies
cd Backend && bun install
cd ../Shared && bun install
# cd ../Pooler && bun install  # After Phase 2 implementation
```

### **2. Database Setup**
```bash
# Create PostgreSQL database
createdb kale_pool_dev

# Set environment variables
export DATABASE_URL="postgresql://username:password@localhost:5432/kale_pool_dev"

# Run migrations
cd Backend
bun run db:migrate
```

### **3. Environment Configuration**

**Backend/.env.development**
```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/kale_pool_dev
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# Stellar Network (Testnet for development)
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
KALE_CONTRACT_ID=CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO

# API Configuration
PORT=3000
HOST=localhost
LOG_LEVEL=debug
NODE_ENV=development

# Rate Limiting
API_RATE_LIMIT=1000
REQUEST_TIMEOUT=30000
```

**Pooler/.env.development** (Phase 2)
```bash
# Service Configuration
POOLER_ID=dev-pooler-uuid
POOLER_NAME=DevelopmentPooler
PORT=3001

# Backend Integration
BACKEND_API_URL=http://localhost:3000
BACKEND_TIMEOUT=30000
RETRY_ATTEMPTS=3

# KALE Network
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
KALE_CONTRACT_ID=CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO
BLOCK_POLL_INTERVAL_MS=5000

# Performance
MAX_CONCURRENT_MINERS=50
WORK_TIMEOUT_MINUTES=5
OPTIMAL_WORK_DELAY_MS=280000
```

## 🧪 **Testing Guide**

### **Phase 1: Backend API Testing**

#### **Fix TypeScript Issues First**
```bash
cd Backend

# Check compilation issues
bun run lint

# Common fixes needed:
# 1. Fix Fastify import: import fastify from 'fastify'
# 2. Fix Stellar SDK imports
# 3. Add missing type definitions
# 4. Fix parameter type mismatches
```

#### **Start Backend Service**
```bash
cd Backend

# Development mode (with auto-reload)
bun run dev

# Production mode
bun run build && bun run start
```

#### **Health Check**
```bash
# Verify service is running
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "plant": true,
    "work": true,
    "harvest": true,
    "wallet": true
  },
  "uptime": 123,
  "timestamp": "2025-08-25T10:00:00.000Z"
}
```

#### **Service Information**
```bash
curl http://localhost:3000/info

# Expected response includes:
{
  "service": "KALE Pool Mining Backend",
  "version": "1.0.0",
  "network": {...},
  "config": {...},
  "uptime": 123
}
```

### **API Endpoint Testing**

#### **1. Farmer Registration**
```bash
curl -X POST http://localhost:3000/farmers/register \
  -H "Content-Type: application/json" \
  -d '{
    "poolerId": "123e4567-e89b-12d3-a456-426614174000",
    "stakePercentage": 0.8,
    "metadata": {"source": "test"}
  }'

# Expected response:
{
  "farmerId": "uuid",
  "custodialWallet": "GXXXXX...",
  "poolerId": "uuid",
  "status": "active",
  "currentBalance": "0",
  "registeredAt": "2025-08-25T10:00:00Z"
}
```

#### **2. Plant Operation**
```bash
curl -X POST http://localhost:3000/plant \
  -H "Content-Type: application/json" \
  -d '{
    "blockIndex": 12345,
    "poolerId": "123e4567-e89b-12d3-a456-426614174000",
    "maxFarmersCapacity": 10
  }'

# Expected response:
{
  "blockIndex": 12345,
  "poolerId": "uuid",
  "totalRequested": 5,
  "successfulPlants": 3,
  "failedPlants": 2,
  "totalStaked": "1500000000000",
  "processingTimeMs": 2340
}
```

#### **3. Work Submission**
```bash
curl -X POST http://localhost:3000/work \
  -H "Content-Type: application/json" \
  -d '{
    "blockIndex": 12345,
    "poolerId": "123e4567-e89b-12d3-a456-426614174000",
    "submissions": [
      {
        "farmerId": "farmer-uuid",
        "nonce": "123456789",
        "timestamp": 1692975600000
      }
    ]
  }'

# Expected response:
{
  "blockIndex": 12345,
  "poolerId": "uuid",
  "totalSubmissions": 1,
  "validNonces": 1,
  "submittedWork": 1,
  "totalRewards": "25000000000",
  "processingTimeMs": 1850
}
```

#### **4. Harvest Distribution**
```bash
curl -X POST http://localhost:3000/harvest \
  -H "Content-Type: application/json" \
  -d '{
    "blockIndex": 12345,
    "poolerId": "123e4567-e89b-12d3-a456-426614174000"
  }'

# Expected response:
{
  "blockIndex": 12345,
  "poolerId": "uuid",
  "totalEligible": 3,
  "successfulHarvests": 3,
  "failedHarvests": 0,
  "totalRewards": "50000000000",
  "processingTimeMs": 3200
}
```

### **Database Verification**
```sql
-- Check farmer registration
SELECT id, custodial_public_key, pooler_id, status, current_balance 
FROM farmers;

-- Check plant operations
SELECT block_index, farmer_id, stake_amount, status, planted_at
FROM plantings
ORDER BY planted_at DESC;

-- Check work submissions  
SELECT block_index, farmer_id, nonce, zeros, status, worked_at
FROM works
ORDER BY worked_at DESC;

-- Check harvest distributions
SELECT block_index, farmer_id, reward_amount, status, harvested_at
FROM harvests
ORDER BY harvested_at DESC;
```

## 🏭 **Production Deployment**

### **Environment Setup**

**Backend/.env.production**
```bash
# Database (Production PostgreSQL)
DATABASE_URL=postgresql://user:pass@prod-db:5432/kale_pool_prod
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Stellar Network (Mainnet)
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
KALE_CONTRACT_ID=CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA

# API Configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=production

# Security
API_RATE_LIMIT=100
REQUEST_TIMEOUT=30000
```

### **Docker Deployment**

**docker-compose.yml**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: kale_pool_prod
      POSTGRES_USER: kale_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./Shared/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  backend:
    build: ./Backend
    environment:
      DATABASE_URL: postgresql://kale_user:${POSTGRES_PASSWORD}@postgres:5432/kale_pool_prod
      STELLAR_NETWORK: ${STELLAR_NETWORK:-testnet}
      STELLAR_HORIZON_URL: ${STELLAR_HORIZON_URL}
      KALE_CONTRACT_ID: ${KALE_CONTRACT_ID}
      PORT: 3000
      LOG_LEVEL: info
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  pooler:
    build: ./Pooler
    environment:
      BACKEND_API_URL: http://backend:3000
      STELLAR_NETWORK: ${STELLAR_NETWORK:-testnet}
      STELLAR_HORIZON_URL: ${STELLAR_HORIZON_URL}
      KALE_CONTRACT_ID: ${KALE_CONTRACT_ID}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - backend
    restart: unless-stopped
    # Phase 2 implementation

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - pooler
    restart: unless-stopped

volumes:
  postgres_data:
```

**Backend/Dockerfile**
```dockerfile
FROM oven/bun:1.2-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY ../Shared/package.json ../Shared/

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .
COPY ../Shared ../Shared

# Build application
RUN bun run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["bun", "run", "start"]
```

### **Database Migration**
```bash
# Production database setup
export DATABASE_URL="postgresql://user:pass@prod-host:5432/kale_pool_prod"

# Run initial migration
cd Backend
bun run db:migrate

# Verify tables created
psql $DATABASE_URL -c "\\dt"
```

## 📊 **Monitoring & Observability**

### **Health Monitoring**
```bash
# Service health checks
curl http://backend:3000/health
curl http://pooler:3001/health  # Phase 2

# Database connection test
psql $DATABASE_URL -c "SELECT 1"

# Network connectivity
curl -I https://horizon.stellar.org
```

### **Logging**
```bash
# Application logs
docker-compose logs -f backend
docker-compose logs -f pooler  # Phase 2

# Database logs
docker-compose logs -f postgres

# System metrics
docker stats
```

### **Performance Monitoring**
```bash
# API response times
time curl http://localhost:3000/health

# Database query performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"

# Connection pool status
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database"
```

## 🔍 **Troubleshooting**

### **Common Issues**

#### **TypeScript Compilation Errors**
```bash
# Fix import statements
# In src/server.ts: import fastify from 'fastify'
# In wallet-manager.ts: import { Server } from '@stellar/stellar-sdk'

# Fix type definitions
# Add proper interfaces for request bodies
# Fix parameter type mismatches
```

#### **Database Connection Issues**
```bash
# Verify database is running
pg_isready -h localhost -p 5432

# Check connection string
echo $DATABASE_URL

# Test direct connection
psql $DATABASE_URL -c "SELECT version()"
```

#### **Stellar Network Issues**
```bash
# Test Horizon connectivity
curl https://horizon-testnet.stellar.org/

# Verify contract address
# Testnet: CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO
# Mainnet: CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA
```

#### **API Endpoint Errors**
```bash
# Enable debug logging
LOG_LEVEL=debug bun run dev

# Check error responses
curl -v http://localhost:3000/health

# Verify request format
curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/test
```

## ✅ **Deployment Checklist**

### **Pre-Deployment**
- [ ] All TypeScript compilation errors fixed
- [ ] Unit tests passing
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates ready (production)
- [ ] Monitoring systems configured

### **Deployment**
- [ ] Database deployed and migrated
- [ ] Backend service deployed and healthy
- [ ] Pooler service deployed and healthy (Phase 2)
- [ ] Load balancer configured
- [ ] Health checks responding
- [ ] API endpoints tested

### **Post-Deployment**
- [ ] End-to-end API testing completed
- [ ] Performance monitoring active
- [ ] Error alerts configured
- [ ] Backup systems verified
- [ ] Documentation updated
- [ ] Team access verified

---

**This guide provides complete deployment and testing procedures for the KALE Pool Mining System, ensuring reliable operation from development through production deployment.**

*Deployment Guide: KALE Pool Mining System*  
*Created: August 25, 2025*  
*Status: Ready for Phase 1 deployment after TypeScript fixes*