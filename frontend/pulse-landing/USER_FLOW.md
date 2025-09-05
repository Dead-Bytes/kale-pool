# KALE Pool Frontend - User Flow Documentation

## 🔄 Current Frontend User Flow by Roles

### 👥 **Universal Flow (All Roles)**
**Entry Point:** All users start at the **Dashboard** (`/`) which shows system health and overview

**Role Selection:** Users can switch between roles using the dropdown in the sidebar:
- **Farmer** - Participate in mining pools
- **Pooler** - Operate mining coordination  
- **Admin** - System administration

---

## 👨‍🌾 **FARMER Role Flow**

### **1. Onboarding Journey**
```
Dashboard → Registration → Pool Discovery → My Pool
```

#### **Step 1: Registration** (`/farmer/register`)
- Register with email and external wallet
- Generate custodial wallet
- Fund wallet with XLM
- Check funding status

#### **Step 2: Pool Discovery** (`/farmer/pools`) 
- Browse available pools
- View pool details and performance
- Join pool with stake percentage
- Confirm pool contract

#### **Step 3: My Pool** (`/farmer/my-pool`) - *Placeholder*
- View current pool membership
- Monitor stake and rewards
- Track harvest intervals
- Manage pool settings

### **2. Available Features**
- **Dashboard**: System health overview
- **Network Status**: Blockchain connectivity - *Placeholder*
- **Analytics**: Performance metrics and work history

---

## 🏗️ **POOLER Role Flow**

### **1. Core Operations**
```
Dashboard → Block Notifications → Operations (Plant/Work/Harvest) → Analytics
```

#### **Step 1: Block Monitoring** (`/pooler/blocks`)
- Monitor block discoveries
- View block notifications
- Track block status and plantability

#### **Step 2: Block Operations**
- **Plant** (`/operations/plant`): Initialize farmer contracts
- **Work** (`/operations/work`): Process nonce submissions  
- **Harvest** (`/operations/harvest`): Collect and distribute rewards

#### **Step 3: Management**
- **Pooler Status** (`/pooler/status`) - *Placeholder*: Connection and performance
- **Manage Farmers** (`/pooler/farmers`) - *Placeholder*: View connected farmers

### **2. Available Features**
- **Dashboard**: System health overview
- **Network Status**: Blockchain connectivity - *Placeholder*
- **Analytics**: Performance metrics and work history

---

## 👨‍💼 **ADMIN Role Flow**

### **1. Full System Access**
```
Dashboard → All Farmer Features → All Pooler Features → Analytics
```

#### **Complete Access to:**
- All Farmer features (Registration, Pool Discovery, My Pool)
- All Pooler features (Block Notifications, Operations, Management)
- System-wide Analytics and monitoring
- Network status and configuration

### **2. Administrative Capabilities**
- **Dashboard**: System-wide health overview
- **Network Status**: Blockchain connectivity - *Placeholder*
- **Analytics**: Comprehensive performance metrics and work history
- **Role Management**: Can switch between all roles

---

## 📊 **ANALYTICS Flow (All Roles)**

### **Performance Analytics** (`/analytics/performance`)
- View performance charts and metrics
- Analyze pool success rates over time
- Compare performance across different pools
- Export performance data and reports

### **Work History** (`/analytics/work`)
- View historical work submission data
- Analyze work patterns and trends
- Track farmer participation over time
- Generate work history reports

---

## 🔧 **Navigation & UX Features**

### **Responsive Design**
- **Desktop**: Full sidebar with role-based navigation
- **Mobile**: Collapsible sidebar with hamburger menu
- **Tablet**: Adaptive layout with touch-friendly controls

### **Role-Based UI**
- **Dynamic Navigation**: Sidebar shows only relevant sections per role
- **Contextual Headers**: Header shows current role and description
- **Persistent Role**: Role selection saved in localStorage

### **Theme Support**
- **Light/Dark Mode**: Toggle in sidebar footer
- **KALE Green Accents**: Green highlights for active states only
- **Neutral Dark Theme**: Clean, professional appearance

---

## 🚧 **Current Implementation Status**

### **✅ Fully Implemented**
- Dashboard with system health
- Farmer Registration flow
- Pool Discovery and joining
- Block Operations (Plant/Work/Harvest)
- Performance Analytics
- Work History
- Role-based navigation
- Responsive layout

### **⏳ Placeholder Pages (Need Implementation)**
- Network Status (`/network`)
- My Pool (`/farmer/my-pool`)
- Pooler Status (`/pooler/status`)
- Manage Farmers (`/pooler/farmers`)

### **🔄 Next Steps**
1. Implement remaining placeholder pages
2. Add real API integration
3. Add authentication/authorization
4. Implement real-time updates
5. Add advanced filtering and search

---

## 📱 **Route Structure**

### **Main Routes**
```
/                           # Dashboard (All roles)
/network                    # Network Status (All roles)
```

### **Farmer Routes**
```
/farmer/register           # Registration
/farmer/pools              # Pool Discovery
/farmer/my-pool            # My Pool (Placeholder)
```

### **Pooler Routes**
```
/pooler/blocks             # Block Notifications
/pooler/status             # Pooler Status (Placeholder)
/pooler/farmers            # Manage Farmers (Placeholder)
```

### **Block Operations**
```
/operations/plant          # Plant Operations
/operations/work           # Work Operations
/operations/harvest        # Harvest Operations
```

### **Analytics**
```
/analytics/performance     # Performance Analytics
/analytics/work            # Work History
```

---

## 🎯 **User Journey Examples**

### **New Farmer Onboarding**
1. **Landing**: Dashboard overview
2. **Register**: Create account and fund wallet
3. **Discover**: Browse and compare pools
4. **Join**: Select pool and confirm contract
5. **Monitor**: Track performance in My Pool
6. **Analyze**: View work history and earnings

### **Pooler Daily Operations**
1. **Monitor**: Check block notifications
2. **Plant**: Initialize farmer contracts for new blocks
3. **Work**: Process nonce submissions
4. **Harvest**: Distribute rewards to farmers
5. **Analyze**: Review performance metrics
6. **Manage**: Monitor farmer connections

### **Admin System Overview**
1. **Dashboard**: System-wide health check
2. **Network**: Monitor blockchain connectivity
3. **Farmers**: Review registration and pool activity
4. **Poolers**: Check block operations and performance
5. **Analytics**: Generate comprehensive reports
6. **Troubleshoot**: Address system issues

---

## 🔐 **Role Permissions Matrix**

| Feature | Farmer | Pooler | Admin |
|---------|--------|--------|-------|
| Dashboard | ✅ | ✅ | ✅ |
| Network Status | ✅ | ✅ | ✅ |
| Registration | ✅ | ❌ | ✅ |
| Pool Discovery | ✅ | ❌ | ✅ |
| My Pool | ✅ | ❌ | ✅ |
| Block Notifications | ❌ | ✅ | ✅ |
| Pooler Status | ❌ | ✅ | ✅ |
| Manage Farmers | ❌ | ✅ | ✅ |
| Plant Operations | ❌ | ✅ | ✅ |
| Work Operations | ❌ | ✅ | ✅ |
| Harvest Operations | ❌ | ✅ | ✅ |
| Performance Analytics | ✅ | ✅ | ✅ |
| Work History | ✅ | ✅ | ✅ |

---

## 🎨 **Design System**

### **Color Palette**
- **Background**: Neutral dark (`#121212`)
- **Surfaces**: Dark grays (`#171717`, `#1f1f1f`)
- **Text**: White primary, gray secondary (`#a6a6a6`)
- **Accents**: KALE green (`#95c697`) for active states
- **Success**: Bright green (`#0bda3c`)
- **Error**: Red (`#fa4f38`)

### **Typography**
- **Font**: Inter (primary), JetBrains Mono (code)
- **Hierarchy**: H1-H4, Body, Caption, Mono
- **Weights**: 400, 500, 600, 700, 800

### **Components**
- **Cards**: Rounded corners, subtle borders
- **Buttons**: Primary, secondary, ghost variants
- **Tables**: Sortable, filterable, paginated
- **Forms**: Validation, error states, loading
- **Charts**: Line, bar, area visualizations

---

## 📈 **Performance Considerations**

### **Optimization**
- **Code Splitting**: Route-level lazy loading
- **Caching**: React Query for API data
- **Virtualization**: Large table rendering
- **Debouncing**: Search and filter inputs

### **Accessibility**
- **WCAG AA**: Compliance targets
- **Keyboard**: Full navigation support
- **Screen Readers**: Proper ARIA labels
- **Focus Management**: Visible focus states

---

## 🔄 **Future Enhancements**

### **Phase 1: Core Features**
- [ ] Implement remaining placeholder pages
- [ ] Add real-time WebSocket connections
- [ ] Integrate with backend APIs
- [ ] Add form validation and error handling

### **Phase 2: Advanced Features**
- [ ] Add authentication and authorization
- [ ] Implement advanced filtering and search
- [ ] Add data export capabilities
- [ ] Create mobile app version

### **Phase 3: Enterprise Features**
- [ ] Multi-tenant support
- [ ] Advanced analytics and reporting
- [ ] API rate limiting and monitoring
- [ ] Audit logging and compliance

---

*Last updated: January 2024*
*Version: 1.0.0*
