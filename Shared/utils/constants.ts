// Shared constants for KALE Pool Mining system
// Phase 1: Core configuration values

// ======================
// KALE CONTRACT CONSTANTS
// ======================

export const KALE_CONTRACT = {
  mainnet: {
    CONTRACT_ID: 'CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA',
    ASSET_CODE: 'KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE',
    SAC_ADDRESS: 'CB23WRDQWGSP6YPMY4UV5C4OW5CBTXKYN3XEATG7KJEZCXMJBYEHOUOV',
    NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
    RPC_URL: 'https://mainnet.sorobanrpc.com'
  },
  TESTNET: {
    CONTRACT_ID: 'CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO',
    ASSET_CODE: 'KALE:GCHPTWXMT3HYF4RLZHWBNRF4MPXLTJ76ISHMSYIWCCDXWUYOQG5MR2AB',
    SAC_ADDRESS: 'CAAVU2UQJLMZ3GUZFM56KVNHLPA3ZSSNR4VP2U53YBXFD2GI3QLIVHZZ',
    NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    RPC_URL: 'https://soroban-testnet.stellar.org'
  }
} as const;

// ======================
// POOL MINING CONSTANTS
// ======================

export const POOL_LIMITS = {
  MAX_FARMERS_PER_POOLER: 100,
  MAX_PLANT_BATCH_SIZE: 50,
  MAX_HARVEST_BATCH_SIZE: 20,
  MIN_XLM_BALANCE: 1_0000000, // 1 XLM minimum for operations
  STAKE_PERCENTAGE_MIN: 0.1,
  STAKE_PERCENTAGE_MAX: 1.0
} as const;

export const TIMING_CONSTANTS = {
  BLOCK_POLL_INTERVAL_MS: 5000, // 5 seconds
  WORK_DELAY_MINUTES: 4.7, // Optimal timing from analysis
  PLANT_TIMEOUT_MS: 30000, // 30 seconds for plant operations
  HARVEST_TIMEOUT_MS: 45000, // 45 seconds for harvest operations
  HEALTH_CHECK_INTERVAL_MS: 60000, // 1 minute
  DATABASE_CLEANUP_HOURS: 24 // Clean up old data after 24 hours
} as const;

// ======================
// DATABASE CONSTANTS
// ======================

export const DB_CONFIG = {
  CONNECTION_POOL_SIZE: 20,
  CONNECTION_TIMEOUT_MS: 30000,
  QUERY_TIMEOUT_MS: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
} as const;

// ======================
// API CONSTANTS
// ======================

export const API_CONFIG = {
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  API_KEY_LENGTH: 32,
  PAGINATION_DEFAULT_LIMIT: 50,
  PAGINATION_MAX_LIMIT: 500
} as const;

// ======================
// MINING CONSTANTS
// ======================

export const MINING_CONFIG = {
  DEFAULT_DIFFICULTY: 6, // Target number of leading zeros
  MAX_NONCE: 2147483647, // 2^31 - 1
  HASH_BATCH_SIZE: 10000000, // From kale-miner default
  MAX_CONCURRENT_WORK_PROCESSES: 20,
  WORK_TIMEOUT_MINUTES: 10,
  NONCE_COUNT_PER_PROCESS: 100000000
} as const;

// ======================
// STELLAR NETWORK CONSTANTS
// ======================

export const STELLAR_CONFIG = {
  BASE_FEE: 100, // Stroops (0.00001 XLM)
  BASE_RESERVE: 5000000, // 0.5 XLM
  TRUSTLINE_RESERVE: 5000000, // 0.5 XLM additional per trustline
  TRANSACTION_TIMEOUT: 180, // 3 minutes
  MAX_OPERATIONS_PER_TRANSACTION: 100
} as const;

// ======================
// ERROR CODES
// ======================

export const ERROR_CODES = {
  // Database errors
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',
  
  // Wallet errors
  WALLET_GENERATION_FAILED: 'WALLET_GENERATION_FAILED',
  WALLET_NOT_FUNDED: 'WALLET_NOT_FUNDED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // Plant errors
  PLANT_FAILED: 'PLANT_FAILED',
  PLANT_TIMEOUT: 'PLANT_TIMEOUT',
  INVALID_STAKE_AMOUNT: 'INVALID_STAKE_AMOUNT',
  
  // Work errors
  WORK_FAILED: 'WORK_FAILED',
  WORK_TIMEOUT: 'WORK_TIMEOUT',
  INVALID_HASH: 'INVALID_HASH',
  INSUFFICIENT_ZEROS: 'INSUFFICIENT_ZEROS',
  
  // Harvest errors
  HARVEST_FAILED: 'HARVEST_FAILED',
  HARVEST_TIMEOUT: 'HARVEST_TIMEOUT',
  NO_REWARDS_AVAILABLE: 'NO_REWARDS_AVAILABLE',
  
  // API errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST_FORMAT: 'INVALID_REQUEST_FORMAT',
  POOLER_NOT_FOUND: 'POOLER_NOT_FOUND',
  FARMER_NOT_FOUND: 'FARMER_NOT_FOUND',
  
  // Block errors
  BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',
  BLOCK_ALREADY_PROCESSED: 'BLOCK_ALREADY_PROCESSED',
  BLOCK_TOO_OLD: 'BLOCK_TOO_OLD'
} as const;

// ======================
// STATUS ENUMS (for consistency with types)
// ======================

export const FARMER_STATUS = {
  ACTIVE: 'active',
  LEAVING: 'leaving',
  DEPARTED: 'departed'
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending'
} as const;

export const BLOCK_OPERATION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

// ======================
// LOGGING CONSTANTS
// ======================

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

// ======================
// HELPER FUNCTIONS
// ======================

export const isMainnet = (network: string): boolean => {
  return network.toLowerCase() === 'mainnet' || network.toLowerCase() === 'public';
};

export const getNetworkConfig = (network: string) => {
  return isMainnet(network) ? KALE_CONTRACT.mainnet : KALE_CONTRACT.TESTNET;
};

export const stroopsToXLM = (stroops: number): number => {
  return stroops / 10_000_000;
};

export const xlmToStroops = (xlm: number): number => {
  return Math.round(xlm * 10_000_000);
};

export const formatKaleAmount = (amount: bigint): string => {
  return (Number(amount) / 10_000_000).toFixed(7);
};

export const parseKaleAmount = (amount: string): bigint => {
  return BigInt(Math.round(parseFloat(amount) * 10_000_000));
};

// ======================
// BACKEND API CONFIGURATION
// ======================

export const BACKEND_CONFIG = {
  MAX_FARMERS_PER_REQUEST: 1000,
  API_RATE_LIMIT: 100, // requests per minute
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_BATCH_SIZE: 50,
  PARALLEL_LIMIT: 10,
  DEFAULT_PORT: 3000,
  DEFAULT_HOST: '0.0.0.0'
} as const;
