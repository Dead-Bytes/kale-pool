# Farmer Onboarding & Pool Joining - Complete Flow Design

## 🏗️ **System Architecture Overview**

```mermaid
graph TB
    subgraph "🌐 Farmer Interface"
        REG[Registration Portal]
        POOL[Pool Selection]
        DASH[Dashboard]
    end
    
    subgraph "🗄️ Backend Services"
        API[REST API Server]
        WALLET[Custodial Wallet Manager]
        MONITOR[Balance Monitor]
        POOLMGR[Pool Manager]
    end
    
    subgraph "📊 Database"
        USERS[users table]
        FARMERS[farmers table] 
        POOLERS[poolers table]
        CONTRACTS[pool_contracts table]
    end
    
    subgraph "🔗 Blockchain"
        CUSTODIAL[Custodial Wallets]
        EXTERNAL[External Wallets]
        STELLAR[Stellar Network]
    end
    
    %% Registration Flow
    REG --> API
    API --> WALLET
    WALLET --> CUSTODIAL
    API --> USERS
    API --> FARMERS
    
    %% Pool Joining Flow
    POOL --> API
    API --> POOLMGR
    POOLMGR --> CONTRACTS
    
    %% Monitoring
    MONITOR --> STELLAR
    MONITOR --> FARMERS
```

## 🔄 **Farmer Registration Flow**

```mermaid
sequenceDiagram
    participant U as User Browser
    participant API as Backend API
    participant WM as Wallet Manager
    participant DB as Database
    participant S as Stellar Network
    
    Note over U,S: 📝 FARMER REGISTRATION WORKFLOW
    
    rect rgb(255, 248, 240)
        Note over U,S: 1️⃣ Initial Registration
        
        U->>API: POST /register<br/>{"email": "user@example.com", "externalWallet": "GXXX..."}
        API->>API: Validate email format & external wallet
        API->>DB: Check if email already exists
        
        alt Email already exists
            DB-->>API: User exists
            API-->>U: Error: Email already registered
        else New user
            DB-->>API: Email available
            
            Note over API: 🔑 Generate Custodial Wallet
            API->>WM: generateCustodialWallet()
            WM->>S: Create Stellar keypair
            S-->>WM: {publicKey, secretKey}
            WM-->>API: Wallet credentials
            
            Note over API: 💾 Store User Data
            API->>DB: INSERT users (email, external_wallet, status='registered')
            API->>DB: INSERT farmers (user_id, custodial_public, custodial_secret, status='wallet_created')
            
            API-->>U: Registration successful<br/>{"userId": "uuid", "custodialWallet": "GYYY...", "fundingRequired": true}
        end
    end
    
    rect rgb(240, 255, 240)
        Note over U,S: 2️⃣ Wallet Funding Process
        
        Note over U: User manually sends XLM to custodial wallet
        
        U->>API: POST /check-funding<br/>{"userId": "uuid"}
        API->>WM: checkAccountBalance(custodialWallet)
        WM->>S: getAccount(custodialWallet)
        
        alt Account funded
            S-->>WM: Account exists with XLM balance
            WM-->>API: Funding confirmed
            API->>DB: UPDATE farmers SET status='funded', funded_at=NOW()
            API-->>U: Funding confirmed - Ready to join pools
        else Not funded
            S-->>WM: Account not found or insufficient balance
            WM-->>API: Funding required
            API-->>U: Please fund wallet with XLM
        end
    end
```

## 🏊 **Pool Joining Flow**

```mermaid
sequenceDiagram
    participant U as User Browser
    participant API as Backend API
    participant PM as Pool Manager
    participant DB as Database
    participant SC as Smart Contract
    
    Note over U,SC: 🏊 POOL JOINING WORKFLOW
    
    rect rgb(240, 240, 255)
        Note over U,SC: 1️⃣ Pool Discovery & Selection
        
        U->>API: GET /poolers<br/>{"userId": "uuid"}
        API->>DB: SELECT poolers with reward rates and capacity
        DB-->>API: Available poolers list
        API-->>U: Poolers with reward rates and stats
        
        U->>API: GET /pooler/:id/details
        API->>DB: SELECT pooler details, current farmers, performance
        DB-->>API: Detailed pooler information
        API-->>U: Pooler statistics and terms
    end
    
    rect rgb(255, 240, 255)
        Note over U,SC: 2️⃣ Pool Configuration & Joining
        
        U->>API: POST /join-pool<br/>{"userId": "uuid", "poolerId": "uuid", "stakePercentage": 0.8, "harvestInterval": 5}
        
        API->>DB: Validate user is funded and not in another pool
        
        alt User eligible
            Note over API: 📋 Create Pool Contract Terms
            API->>PM: createPoolContract(user, pooler, config)
            PM->>DB: INSERT pool_contracts (farmer_id, pooler_id, stake_pct, harvest_interval, reward_split, status='pending')
            
            API-->>U: Pool contract terms<br/>{"contractId": "uuid", "terms": {...}, "requiresConfirmation": true}
            
            Note over U: User reviews terms and confirms
            
            U->>API: POST /confirm-pool-join<br/>{"contractId": "uuid", "confirmed": true}
            
            API->>DB: UPDATE pool_contracts SET status='active', confirmed_at=NOW()
            API->>DB: UPDATE farmers SET pooler_id=?, status='active_in_pool'
            API->>DB: UPDATE poolers SET current_farmers=current_farmers+1
            
            API-->>U: Successfully joined pool - Will participate in next block
            
        else User not eligible
            API-->>U: Error: User not funded or already in pool
        end
    end
```

## 🗄️ **Database Schema Updates**

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK "User email for authentication"
        string external_wallet "GXXX... farmer's payout wallet"
        enum status "registered|verified|suspended"
        timestamp created_at
        timestamp verified_at
    }
    
    FARMERS {
        uuid id PK
        uuid user_id FK "References users table"
        string custodial_public_key UK "GYYY... generated wallet"
        text custodial_secret_key "SXXX... unencrypted for now"
        uuid pooler_id FK "NULL if not joined any pool"
        enum status "wallet_created|funded|active_in_pool|exiting|exited"
        bigint current_balance "KALE balance in custodial wallet"
        timestamp created_at
        timestamp funded_at "When XLM funding confirmed"
        timestamp joined_pool_at
    }
    
    POOLERS {
        uuid id PK
        string name "Display name"
        string public_key UK "Pooler's wallet"
        decimal reward_percentage "e.g., 0.55 = 55% to farmers, 45% to pooler"
        int max_farmers "Maximum capacity"
        int current_farmers "Currently active farmers"
        enum status "active|full|paused"
        json terms "Pool-specific terms and conditions"
        timestamp created_at
        timestamp last_seen
    }
    
    POOL_CONTRACTS {
        uuid id PK
        uuid farmer_id FK
        uuid pooler_id FK
        decimal stake_percentage "0.0-1.0, farmer's choice"
        int harvest_interval "Blocks between harvests"
        decimal reward_split "Agreed reward percentage"
        decimal platform_fee "5% platform fee"
        enum status "pending|active|exiting|completed"
        timestamp created_at
        timestamp confirmed_at
        timestamp exit_requested_at
        json contract_terms "Full contract details"
    }
    
    BALANCE_CHECKS {
        uuid id PK
        uuid farmer_id FK
        string custodial_wallet
        decimal xlm_balance
        boolean is_funded
        timestamp checked_at
        enum status "checking|funded|insufficient"
    }
    
    %% Relationships
    USERS ||--o{ FARMERS : owns
    FARMERS ||--o| POOLERS : joined
    FARMERS ||--o{ POOL_CONTRACTS : has
    POOLERS ||--o{ POOL_CONTRACTS : offers
    FARMERS ||--o{ BALANCE_CHECKS : monitored
```

## 🎯 **Pool Selection Interface Data**

```mermaid
graph LR
    subgraph "📊 Pooler Statistics Display"
        POOL1["🏊 Pooler Alpha<br/>Reward: 60% to farmers<br/>Capacity: 45/100<br/>Success Rate: 96%<br/>Avg Reward/Block: 2.3 KALE"]
        POOL2["🏊 Pooler Beta<br/>Reward: 55% to farmers<br/>Capacity: 80/150<br/>Success Rate: 94%<br/>Avg Reward/Block: 2.1 KALE"]
        POOL3["🏊 Pooler Gamma<br/>Reward: 65% to farmers<br/>Capacity: 12/50<br/>Success Rate: 98%<br/>Avg Reward/Block: 2.5 KALE"]
    end
    
    subgraph "⚙️ Configuration Options"
        STAKE["Stake Percentage<br/>🎚️ 20% - 100%<br/>Higher = More rewards & risk"]
        HARVEST["Harvest Interval<br/>🎚️ 1 - 20 blocks<br/>How often to collect"]
        TERMS["Contract Terms<br/>📋 Platform fee: 5%<br/>Exit delay: 24 hours"]
    end
    
    POOL1 --> STAKE
    POOL2 --> STAKE
    POOL3 --> STAKE
    STAKE --> HARVEST
    HARVEST --> TERMS
```

## ⚡ **Planting Integration Flow**

```mermaid
sequenceDiagram
    participant PM as Pooler Service
    participant API as Backend API
    participant DB as Database
    participant WM as Wallet Manager
    participant KALE as KALE Contract
    
    Note over PM,KALE: 🌱 ENHANCED PLANTING WITH POOL CONTRACTS
    
    PM->>API: POST /plant<br/>{"blockIndex": 12345, "poolerId": "uuid"}
    
    API->>DB: SELECT farmers FROM pool_contracts<br/>WHERE pooler_id=? AND status='active'
    DB-->>API: Active farmers with stake percentages
    
    loop For each active farmer
        API->>DB: GET farmer balance and stake percentage
        DB-->>API: Farmer config {balance: 1000, stakePct: 0.8}
        
        API->>WM: Calculate stake amount = balance * stakePct
        Note over WM: 1000 * 0.8 = 800 KALE to stake
        
        API->>WM: plantForFarmer(custodialSecret, stakeAmount)
        WM->>KALE: plant(custodialWallet, 800_KALE)
        KALE-->>WM: Transaction success/failure
        WM-->>API: Plant result
        
        API->>DB: INSERT plantings (farmer_id, stake_amount, status, contract_id)
    end
    
    API-->>PM: Plant summary with active farmers results
```

## 🔄 **Complete User Journey**

```mermaid
stateDiagram-v2
    [*] --> Unregistered
    
    Unregistered --> Registered : Email + External Wallet
    Registered --> WalletCreated : Generate Custodial Wallet
    WalletCreated --> FundingPending : Display funding instructions
    
    FundingPending --> FundingPending : Check funding status
    FundingPending --> Funded : XLM detected in custodial wallet
    
    Funded --> BrowsingPools : View available poolers
    BrowsingPools --> ConfiguringJoin : Select pooler + set stake/harvest
    ConfiguringJoin --> PendingConfirmation : Review contract terms
    
    PendingConfirmation --> ActiveInPool : Confirm pool join
    PendingConfirmation --> BrowsingPools : Cancel/try different pool
    
    ActiveInPool --> ActiveInPool : Auto-participate in blocks
    ActiveInPool --> ExitingPool : Request exit
    ExitingPool --> Funded : Exit completed, back to available
    
    note right of ActiveInPool
        Farmer participates in:
        - Plant operations (automatic)
        - Work coordination (via pooler)
        - Harvest distribution (per interval)
    end note
```

## 🎯 **API Endpoints Required**

### **Registration & Onboarding**
```http
POST /register
POST /check-funding
GET /user/status
```

### **Pool Management**
```http
GET /poolers
GET /pooler/:id/details
POST /join-pool
POST /confirm-pool-join
POST /exit-pool
```

### **Enhanced Plant Endpoint**
```http
POST /plant
# Now uses pool_contracts table to determine:
# - Which farmers are active in the pool
# - Individual stake percentages per farmer
# - Contract-specific terms and conditions
```

## 🔧 **Configuration Management**

### **Pooler Configuration**
```json
{
  "pooler": {
    "rewardPercentage": 0.60,
    "maxFarmers": 100,
    "minimumStake": 100000000,
    "platformFee": 0.05,
    "terms": {
      "exitDelay": 24,
      "penaltyConditions": "...",
      "performanceRequirements": "..."
    }
  }
}
```

### **Farmer Configuration**
```json
{
  "farmer": {
    "stakePercentage": 0.80,
    "harvestInterval": 5,
    "autoReinvest": false,
    "exitStrategy": "immediate"
  }
}
```

## 🎯 **Implementation Priority**

### **Phase 1: Core Registration (Week 1)**
1. User registration with email and external wallet
2. Custodial wallet generation and storage
3. Balance monitoring and funding confirmation
4. Basic user status management

### **Phase 2: Pool Discovery (Week 2)**
1. Pooler listing with reward rates and statistics
2. Pool selection interface and configuration
3. Pool contract creation and confirmation
4. Integration with existing plant operations

### **Phase 3: Advanced Features (Week 3)**
1. Pool performance analytics and comparison
2. Dynamic configuration updates
3. Exit flow and contract termination
4. Email verification system

---

This comprehensive design provides the complete farmer onboarding and pool joining workflow, integrating seamlessly with your existing Backend and Pooler services while maintaining the custodial wallet approach and flexible reward structures.