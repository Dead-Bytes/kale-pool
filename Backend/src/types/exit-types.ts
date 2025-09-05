// KALE Pool Mining - Farmer Exit System Types
// Comprehensive type definitions for exit processing and reward splitting

export interface ExitCalculation {
  totalRewards: bigint;
  farmerShare: bigint;
  poolerShare: bigint; 
  platformFee: bigint;
  rewardSplit: number; // From contract (e.g., 0.50 = 50% to farmer)
  platformFeeRate: number; // 0.05 = 5%
}

export interface ExitSplitRecord {
  id: string;
  farmerId: string;
  poolerId: string;
  contractId: string;
  
  // Financial details
  totalRewards: string; // bigint as string
  farmerShare: string;
  poolerShare: string;
  platformFee: string;
  
  // Contract terms
  rewardSplit: number;
  platformFeeRate: number;
  
  // Wallet information  
  farmerExternalWallet: string;
  farmerCustodialWallet: string;
  poolerWallet: string;
  platformWallet: string;
  
  // Transaction hashes
  farmerTxHash?: string;
  poolerTxHash?: string;
  platformTxHash?: string;
  
  // Statistics
  blocksIncluded: number;
  harvestsIncluded: number;
  firstHarvestDate?: string;
  lastHarvestDate?: string;
  
  // Status and timing
  status: ExitStatus;
  initiatedAt: string;
  completedAt?: string;
  
  // Error handling
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: string;
  
  // Metadata
  exitReason: string;
  notes?: string;
}

export enum ExitStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ExitInitiationRequest {
  farmerId: string;
  externalWallet: string;
  immediate?: boolean; // true = exit now, false = after next harvest cycle
}

export interface ExitInitiationResult {
  exitRequestId: string;
  status: ExitStatus;
  estimatedRewards: {
    totalRewards: string;
    totalRewardsHuman: string;
    farmerShare: string;
    farmerShareHuman: string;
    poolerShare: string;
    poolerShareHuman: string;
    platformFee: string;
    platformFeeHuman: string;
  };
  processingTime: string;
  externalWallet: string;
}

export interface PayoutOperation {
  farmerId: string;
  contractId: string;
  custodialWallet: string;
  farmerExternalWallet: string;
  poolerWallet: string;
  platformWallet: string;
  amounts: ExitCalculation;
}

export interface PayoutResult {
  farmerTxHash?: string;
  poolerTxHash?: string;
  platformTxHash?: string;
  totalAmount: bigint;
  success: boolean;
  errors: PayoutError[];
}

export interface PayoutError {
  type: 'farmer' | 'pooler' | 'platform';
  message: string;
  retryable: boolean;
}

export interface ExitStatusResponse {
  farmerId: string;
  exitSplit: {
    id: string;
    status: ExitStatus;
    totalRewards: string;
    farmerShare: string;
    poolerShare: string;
    platformFee: string;
    transactions: {
      farmer?: string;
      pooler?: string;
      platform?: string;
    };
    initiatedAt: string;
    completedAt?: string;
  } | null;
}

export interface PoolerExitsResponse {
  poolerId: string;
  page: number;
  limit: number;
  total: number;
  items: PoolerExitSummary[];
}

export interface PoolerExitSummary {
  id: string;
  farmerId: string;
  farmerEmail: string;
  totalRewards: string;
  poolerShare: string;
  status: ExitStatus;
  initiatedAt: string;
  completedAt?: string;
}

export interface ExitRewardsCalculation {
  totalRewards: bigint;
  harvestCount: number;
  blocksCount: number;
  firstHarvest?: Date;
  lastHarvest?: Date;
}

export interface ContractTerms {
  rewardSplit: number; // Farmer's share percentage
  platformFee: number; // Platform fee percentage
  minimumStake: string;
  harvestPolicy: string;
  exitDelay: number; // Hours
}

export interface ExitConfiguration {
  platformFeeRate: number;
  maxRetryAttempts: number;
  retryBackoffBase: number; // milliseconds
  exitProcessingTimeout: number; // milliseconds
  platformWalletAddress: string;
  minExitAmount: string; // stroops
}

export interface ExitAuditLog {
  id: string;
  exitSplitId: string;
  action: string;
  oldStatus?: ExitStatus;
  newStatus?: ExitStatus;
  details?: Record<string, any>;
  errorDetails?: string;
  performedBy?: string; // user_id
  performedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PlatformFee {
  id: string;
  exitSplitId: string;
  amount: string;
  feeRate: number;
  collectedAt: string;
  withdrawnAt?: string;
  withdrawalTxHash?: string;
  status: 'collected' | 'withdrawn' | 'pending';
}

// Admin interfaces
export interface AdminExitStats {
  totalExits: number;
  successfulExits: number;
  failedExits: number;
  pendingExits: number;
  totalRewardsProcessed: string;
  totalPlatformFees: string;
  avgProcessingTimeSeconds: number;
}

export interface AdminExitManagement {
  id: string;
  farmerId: string;
  farmerEmail: string;
  status: ExitStatus;
  totalRewards: string;
  retryCount: number;
  lastError?: string;
  initiatedAt: string;
  canRetry: boolean;
  canCancel: boolean;
}

// Background job interfaces
export interface ExitJobData {
  exitSplitId: string;
  retryAttempt?: number;
}

export interface ExitJobResult {
  success: boolean;
  exitSplitId: string;
  transactionHashes?: {
    farmer?: string;
    pooler?: string;
    platform?: string;
  };
  error?: string;
  shouldRetry: boolean;
}

// Validation interfaces
export interface WalletValidation {
  address: string;
  isValid: boolean;
  network: 'mainnet' | 'testnet';
  accountExists: boolean;
}

export interface ExitEligibility {
  eligible: boolean;
  reason?: string;
  activeContract?: {
    id: string;
    poolerId: string;
    joinedAt: string;
    status: string;
  };
  pendingExit?: {
    id: string;
    status: ExitStatus;
    initiatedAt: string;
  };
}

// Query parameter interfaces
export interface ExitListParams {
  status?: ExitStatus | 'all';
  from?: string; // ISO datetime
  to?: string; // ISO datetime
  page: number;
  limit: number;
}

export interface ExitSearchParams {
  farmerId?: string;
  poolerId?: string;
  status?: ExitStatus;
  minAmount?: string;
  maxAmount?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Utility type guards
export const isValidExitStatus = (status: string): status is ExitStatus => {
  return Object.values(ExitStatus).includes(status as ExitStatus);
};

export const isExitProcessing = (status: ExitStatus): boolean => {
  return status === ExitStatus.PROCESSING;
};

export const isExitCompleted = (status: ExitStatus): boolean => {
  return status === ExitStatus.COMPLETED;
};

export const isExitFailed = (status: ExitStatus): boolean => {
  return status === ExitStatus.FAILED;
};

export const canRetryExit = (exitRecord: ExitSplitRecord): boolean => {
  return exitRecord.status === ExitStatus.FAILED && exitRecord.retryCount < 3;
};

// Constants
export const EXIT_CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_BASE_MS: 30000, // 30 seconds
  PROCESSING_TIMEOUT_MS: 300000, // 5 minutes
  MIN_EXIT_AMOUNT_STROOPS: '1000000', // 0.1 KALE
  PLATFORM_FEE_RATE: 0.05, // 5%
  DEFAULT_REWARD_SPLIT: 0.5, // 50% to farmer
} as const;

export type ExitConstantKeys = keyof typeof EXIT_CONSTANTS;