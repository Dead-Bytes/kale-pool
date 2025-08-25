# KALE Pool Mining System

> **A complete mining pool infrastructure for KALE token farming on Stellar**

## 🎯 **Quick Start**

### **Prerequisites**
- [Bun](https://bun.sh/) 1.2+ or Node.js 18+
- PostgreSQL 13+
- Git

### **1. Clone & Setup**
```bash
git clone <repository-url>
cd kale-pool-mining

# Install dependencies
bun install
```

### **2. Database Setup**
```bash
# Create database
createdb kale_pool_mainnet

# Copy environment file
cp Backend/.env.mainnet Backend/.env

# Edit database credentials in Backend/.env:
# DATABASE_URL=postgresql://your_user:your_pass@localhost:5432/kale_pool_mainnet

# Run migrations
bun run db:setup
```

### **3. Start the System**
```bash
# Start everything with beautiful logs
bun run start
```

You should see:
```
╔══════════════════════════════════════════════════════════════════════╗
║   ██╗  ██╗ █████╗ ██╗     ███████╗    ██████╗  ██████╗  ██████╗ ██╗  ║
║   KALE POOL MINING SYSTEM                                           ║
╚══════════════════════════════════════════════════════════════════════╝

🚀 Starting KALE Pool Mining System...
✅ Backend API started on port 3000
🎉 System ready!

QUICK START:
  Backend API:  http://localhost:3000
  Health Check: http://localhost:3000/health
```

## 📡 **API Endpoints**

### **Health Check**
```bash
curl http://localhost:3000/health
```

### **Register Farmer**
```bash
curl -X POST http://localhost:3000/farmers/register \
  -H "Content-Type: application/json" \
  -d '{"poolerId": "test-pooler", "stakePercentage": 0.8}'
```

### **Plant Operation**
```bash
curl -X POST http://localhost:3000/plant \
  -H "Content-Type: application/json" \
  -d '{"blockIndex": 12345, "poolerId": "test-pooler", "maxFarmersCapacity": 10}'
```

## 🏗️ **System Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │     Pooler      │    │    Backend      │
│   Miners        │    │   (Phase 2)     │    │  ✅ Complete    │
│                 │    │                 │    │                 │
│ • Submit Work   │◄──►│ • Block Monitor │◄──►│ • Plant Service │
│ • Get Tasks     │    │ • Coordination  │    │ • Work Service  │
│ • Statistics    │    │ • Distribution  │    │ • Harvest Svc   │
└─────────────────┘    └─────────────────┘    │ • Wallet Mgmt   │
                                              └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   PostgreSQL    │
                                              │ ✅ Event Logs   │
                                              │ ✅ Audit Trail  │
                                              └─────────────────┘
```

## 📦 **What's Included**

### ✅ **Phase 1: Backend (Complete)**
- **REST API Server** - All farming endpoints ready
- **Custodial Wallet Management** - Stellar SDK integration
- **Database Event Sourcing** - Immutable audit trails
- **Plant/Work/Harvest Services** - Core mining operations
- **Health Monitoring** - Service status and metrics

### 🔄 **Phase 2: Pooler Service (Planned)**
- **Block Monitoring** - Detect new KALE blocks
- **External Miner API** - REST endpoints for miners
- **Work Distribution** - Coordinate across miners
- **Backend Integration** - Complete system workflow

## 🧪 **Development**

### **Backend Only**
```bash
# Start just the backend
bun run backend

# Run tests
bun run test

# Check TypeScript
bun run lint
```

### **Database Operations**
```bash
# Run migrations
bun run db:setup

# Connect to database
psql postgresql://kale_user:kale_pass@localhost:5432/kale_pool_mainnet

# Check tables
\dt
```

## 📊 **Monitoring**

### **Service Health**
```bash
# Check all services
curl http://localhost:3000/health

# Get detailed info
curl http://localhost:3000/info
```

### **Database Status**
```sql
-- Check recent activity
SELECT COUNT(*) FROM farmers;
SELECT COUNT(*) FROM plantings;
SELECT COUNT(*) FROM works;
SELECT COUNT(*) FROM harvests;
```

### **Logs**
All services log to console with structured output:
```
[Backend API] ✅ Service started on port 3000
[Backend API] 📊 Database connected successfully
[Backend API] 🌟 KALE contract integration ready
```

## 🔧 **Configuration**

### **Environment Variables**
Edit `Backend/.env`:
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kale_pool_mainnet

# Stellar Network
STELLAR_NETWORK=PUBLIC  # or TESTNET for development
RPC_URL=https://mainnet.sorobanrpc.com
KALE_CONTRACT_ID=CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA

# API Settings
PORT=3000
LOG_LEVEL=info
```

### **Performance Tuning**
```bash
# Increase farmer capacity
MAX_FARMERS_PER_POOLER=100

# Adjust batch sizes
MAX_PLANT_BATCH_SIZE=50
MAX_HARVEST_BATCH_SIZE=20

# Database connections
DB_POOL_SIZE=20
```

## 📖 **Documentation**

- [`docs/completed/`](docs/completed/) - Implementation details
- [`docs/architecture/`](docs/architecture/) - System design
- [`docs/future/`](docs/future/) - Phase 2 plans
- [`references/`](references/) - KALE contract & miner references

## 🚀 **Production Deployment**

### **Docker Compose** (Recommended)
```yaml
# docker-compose.yml included
docker-compose up -d
```

### **Manual Deployment**
```bash
# Build for production
bun run build

# Start with PM2
pm2 start dist/server.js --name kale-backend

# Monitor
pm2 logs kale-backend
pm2 status
```

## 🔗 **Integration**

### **External Miners**
Phase 2 will provide endpoints for external miners:
```bash
# Register miner (Phase 2)
POST /miner/register

# Get work assignment (Phase 2)
GET /miner/work

# Submit solution (Phase 2)
POST /miner/submit
```

### **KALE Network**
System integrates directly with:
- **Mainnet Contract**: `CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA`
- **Testnet Contract**: `CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO`
- **Stellar Horizon**: Account management and transaction submission
- **Soroban RPC**: Smart contract interactions

## 🎯 **Current Status**

| Component | Status | Completion |
|-----------|---------|------------|
| **Backend API** | ✅ Complete | 100% |
| **Database** | ✅ Complete | 100% |
| **Wallet Management** | ✅ Complete | 100% |
| **Plant Service** | ✅ Complete | 100% |
| **Work Service** | ✅ Complete | 100% |
| **Harvest Service** | ✅ Complete | 100% |
| **Pooler Service** | 🔄 Planned | 0% |
| **Miner API** | 🔄 Planned | 0% |
| **Integration Tests** | 🔄 Planned | 0% |

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow VibeSafe methodology (see `claude/` directory)
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- [KALE Project](https://github.com/kalepail/KALE-sc) - Original KALE token implementation
- [Stellar](https://stellar.org) - Blockchain infrastructure
- [VibeSafe](claude/) - Development methodology and governance

---

**Built with 🥬 by the KALE Pool Mining Team**

*Ready for local deployment and Phase 2 development*
