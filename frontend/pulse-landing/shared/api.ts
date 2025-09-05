/**
 * KALE Pool System API Types
 * Shared types between client and server for the KALE Pool coordination system
 */

// ==================== Health & Info ====================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    plant: ServiceStatus;
    work: ServiceStatus;
    harvest: ServiceStatus;
    wallet: ServiceStatus;
  };
  uptime: number;
  version: string;
  timestamp: string;
}

export interface ServiceStatus {
  status: 'online' | 'offline' | 'error';
  lastCheck: string;
  responseTime?: number;
  error?: string;
}

export interface InfoResponse {
  service: string;
  version: string;
  network: {
    name: string;
    horizon_url: string;
    passphrase: string;
  };
  config: {
    max_farmers_per_pool: number;
    default_harvest_interval: number;
    min_stake_percentage: number;
  };
}

// ==================== Registration ====================

export interface RegisterUserRequest {
  email: string;
  password: string;
  externalWallet: string;
}

export interface RegisterUserResponse {
  userId: string;
  custodialWallet: {
    publicKey: string;
    accountId: string;
  };
  message: string;
  fundingRequired: number; // XLM amount needed
}

export interface CheckFundingRequest {
  userId: string;
}

export interface CheckFundingResponse {
  userId: string;
  funded: boolean;
  balance: number;
  minimumRequired: number;
  timestamp: string;
}

export interface UserStatusResponse {
  user: {
    userId: string;
    email: string;
    externalWallet: string;
    custodialWallet: string;
    status: 'pending' | 'funded' | 'active';
  };
  farmer: {
    registered: boolean;
    contractAddress?: string;
    stakeAmount?: number;
  };
  contract: {
    deployed: boolean;
    address?: string;
    balance?: number;
  };
  funding: {
    required: number;
    current: number;
    funded: boolean;
  };
}

// ==================== Poolers ====================

export interface PoolerSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  rewardPercentage: number;
  maxFarmers: number;
  currentFarmers: number;
  totalStaked: string;
  totalStakedHuman: string;
  averageReward: string;
  averageRewardHuman: string;
  successRate: number;
  createdAt: string;
  lastSeen: string;
}

export interface PoolerDetails extends PoolerSummary {
  terms: {
    minimumStake: string;
    harvestPolicy: string;
    exitDelay: number;
  };
  performance: {
    successRate: number;
    averageBlockTime: number;
    totalBlocksMined: number;
    uptime: number;
  };
  statistics: {
    totalStaked: string;
    totalRewards: string;
    averageRewardPerBlock: string;
    farmersJoined: number;
    farmersActive: number;
  };
}

export interface JoinPoolRequest {
  userId: string;
  poolerId: string;
  stakePercentage: number;
  harvestInterval: number;
}

export interface JoinPoolResponse {
  contractId: string;
  poolerId: string;
  userId: string;
  stakePercentage: number;
  harvestInterval: number;
  estimatedRewards: number;
  requiresConfirmation: boolean;
  message: string;
}

export interface ConfirmJoinRequest {
  contractId: string;
  confirmed: boolean;
}

export interface ConfirmJoinResponse {
  success: boolean;
  contractId: string;
  status: 'active_in_pool' | 'pending' | 'rejected';
  message: string;
}

// ==================== Block Operations ====================

export interface BlockDiscoveredEvent {
  event: 'new_block_discovered';
  poolerId: string;
  blockIndex: number;
  blockData: {
    hash: string;
    difficulty: string;
    timestamp: number;
    entropy: string;
    age: number;
  };
  metadata: {
    plantable: boolean;
    estimatedReward: number;
    ranges: {
      start: number;
      end: number;
    }[];
  };
}

export interface BlockDiscoveredResponse {
  success: boolean;
  message: string;
  acknowledged: boolean;
  actions?: string[];
  timestamp: string;
}

export interface PoolerStatusResponse {
  poolerId: string;
  connections: {
    farmers: number;
    active: number;
    inactive: number;
  };
  lastNotification: {
    blockIndex: number;
    timestamp: string;
    acknowledged: boolean;
  };
  blocksDiscovered: {
    total: number;
    last24h: number;
    pending: number;
  };
  performance: {
    uptime: number;
    avgResponseTime: number;
    successRate: number;
  };
}

// ==================== Plant Operation ====================

export interface PlantRequest {
  blockIndex: number;
  poolerId: string;
  maxFarmersCapacity: number;
}

export interface PlantResponse {
  blockIndex: number;
  poolerId: string;
  totalRequested: number;
  successfulPlants: FarmerPlantResult[];
  failedPlants: FarmerPlantResult[];
  totalStaked: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface FarmerPlantResult {
  farmerId: string;
  success: boolean;
  txnHash?: string;
  stakeAmount?: number;
  error?: string;
  timestamp: string;
}

// ==================== Work Operation ====================

export interface WorkSubmission {
  farmerId: string;
  nonce: string;
  blockIndex: number;
  timestamp: number;
}

export interface WorkRequest {
  blockIndex: number;
  poolerId: string;
  submissions: WorkSubmission[];
}

export interface WorkResponse {
  blockIndex: number;
  poolerId: string;
  totalSubmissions: number;
  validNonces: WorkResult[];
  invalidNonces: WorkResult[];
  submittedWork: WorkResult[];
  totalRewards: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface WorkResult {
  farmerId: string;
  nonce: string;
  valid: boolean;
  reward?: number;
  txnHash?: string;
  reason?: string;
  timestamp: string;
}

// ==================== Harvest Operation ====================

export interface HarvestRequest {
  blockIndex: number;
  poolerId: string;
}

export interface HarvestResponse {
  blockIndex: number;
  poolerId: string;
  totalEligible: number;
  successfulHarvests: HarvestResult[];
  failedHarvests: HarvestResult[];
  totalRewards: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface HarvestResult {
  farmerId: string;
  success: boolean;
  reward?: number;
  txnHash?: string;
  error?: string;
  timestamp: string;
}

// ==================== API Error Types ====================

export interface APIError {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: string;
}

// ==================== Utility Types ====================

export type Role = 'farmer' | 'pooler' | 'admin';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FilterParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}
