// Blockchain and KALE contract specific types
// Phase 1: Integration with Stellar and KALE smart contract

// ======================
// KALE CONTRACT TYPES
// ======================

export interface KaleBlockData {
  index: number;
  timestamp: number;
  entropy: string; // Base64 encoded previous block hash
  min_gap: number;
  min_stake: bigint;
  min_zeros: number;
  max_gap: number;
  max_stake: bigint;
  max_zeros: number;
  staked_total: bigint;
  normalized_total: bigint;
}

export interface KalePailData {
  sequence: number;
  gap?: number;
  stake: bigint;
  zeros?: number;
}

// ======================
// MINING TYPES
// ======================

export interface MiningInput {
  block_index: number;
  entropy: string; // Base64 encoded
  farmer_address: string;
  target_zeros: number;
  start_nonce: bigint;
  max_iterations: number;
}

export interface MiningResult {
  found: boolean;
  nonce?: bigint;
  hash?: string;
  zeros?: number;
  iterations_completed: number;
  elapsed_ms: number;
}

export interface HashCalculation {
  block_index: number;
  nonce: bigint;
  entropy: Buffer; // 32 bytes
  farmer_address: Buffer; // Last 32 bytes of XDR
}

// ======================
// STELLAR NETWORK TYPES
// ======================

export interface StellarConfig {
  network: 'PUBLIC' | 'TESTNET';
  rpc_url: string;
  network_passphrase: string;
  kale_contract_id: string;
  base_fee: number;
}

export interface AccountInfo {
  account_id: string;
  sequence: string;
  balances: AccountBalance[];
  exists: boolean;
}

export interface AccountBalance {
  balance: string;
  asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  asset_code?: string;
  asset_issuer?: string;
}

// ======================
// CONTRACT OPERATION TYPES
// ======================

export interface PlantOperation {
  farmer_address: string;
  amount: bigint;
  block_index?: number; // Auto-determined by contract
}

export interface WorkOperation {
  farmer_address: string;
  hash: Buffer; // 32 bytes
  nonce: bigint;
}

export interface HarvestOperation {
  farmer_address: string;
  block_index: number;
}

// ======================
// CONTRACT RESPONSE TYPES
// ======================

export interface ContractResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  transaction_hash?: string;
  fee_charged?: bigint;
}

export interface PlantResult {
  block_index: number;
  stake_amount: bigint;
}

export interface WorkResult {
  gap: number; // Ledgers between plant and work
  normalized_contribution: {
    gap: bigint;
    stake: bigint;
    zeros: bigint;
  };
}

export interface HarvestResult {
  reward_amount: bigint;
  stake_returned: bigint;
  total_payout: bigint;
}

// ======================
// ERROR TYPES
// ======================

export enum KaleContractError {
  HomesteadExists = 1,
  HomesteadMissing = 2,
  FarmBlockMissing = 3,
  FarmPaused = 4,
  FarmNotPaused = 5,
  PlantAmountTooLow = 6,
  ZeroCountTooLow = 7,
  PailExists = 8,
  PailMissing = 9,
  WorkMissing = 10,
  BlockMissing = 11,
  BlockInvalid = 12,
  HashInvalid = 13,
  HarvestNotReady = 14,
  GapCountTooLow = 15
}

export interface ContractError {
  code: KaleContractError;
  message: string;
  details?: any;
}

// ======================
// TRANSACTION BUILDING
// ======================

export interface TransactionBuilder {
  source_account: string;
  fee: bigint;
  sequence: bigint;
  operations: ContractOperation[];
  memo?: string;
  timeout?: number;
}

export interface ContractOperation {
  contract_id: string;
  function_name: string;
  args: any[];
  auth?: string[];
}

// ======================
// NETWORK CONSTANTS
// ======================

export const mainnet_CONFIG: StellarConfig = {
  network: 'PUBLIC',
  rpc_url: 'https://mainnet.sorobanrpc.com',
  network_passphrase: 'Public Global Stellar Network ; September 2015',
  kale_contract_id: 'CDL74RF5BLYR2YBLCCI7F5FB6TPSCLKEJUBSD2RSVWZ4YHF3VMFAIGWA',
  base_fee: 10000000 // 1 XLM in stroops
};

export const TESTNET_CONFIG: StellarConfig = {
  network: 'TESTNET',
  rpc_url: 'https://soroban-testnet.stellar.org',
  network_passphrase: 'Test SDF Network ; September 2015',
  kale_contract_id: 'CDSWUUXGPWDZG76ISK6SUCVPZJMD5YUV66J2FXFXFGDX25XKZJIEITAO',
  base_fee: 10000000
};

// KALE token precision (7 decimal places)
export const KALE_PRECISION = 7;
export const KALE_STROOP_MULTIPLIER = BigInt(10 ** KALE_PRECISION);

// Mining constants
export const BLOCK_INTERVAL_SECONDS = 300; // 5 minutes
export const OPTIMAL_WORK_DELAY_SECONDS = 280; // 4.67 minutes