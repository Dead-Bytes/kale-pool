// Shared types for KALE Pool Mining system
// Phase 1: Core interfaces and enums

// ======================
// CORE ENUMS
// ======================

export enum FarmerStatus {
  ACTIVE = 'active',
  LEAVING = 'leaving',
  DEPARTED = 'departed'
}

export enum OperationStatus {
  SUCCESS = 'success',
  FAILED = 'failed'
}

export enum BlockOperationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum CompensationType {
  PLANT_FAILURE = 'plant_failure',
  WORK_FAILURE = 'work_failure'
}

// ======================
// DATABASE ENTITIES
// ======================

export interface Pooler {
  id: string;
  name: string;
  public_key: string;
  api_key: string;
  api_endpoint?: string;
  max_farmers: number;
  current_farmers: number;
  is_active: boolean;
  last_seen?: Date;
  created_at: Date;
}

export interface Farmer {
  id: string;
  custodial_public_key: string;
  custodial_secret_key: string; // UNENCRYPTED in Phase 1
  pooler_id: string;
  payout_wallet_address: string;
  stake_percentage: number; // 0.0 to 1.0
  current_balance: bigint;
  is_funded: boolean;
  status: FarmerStatus;
  created_at: Date;
}

export interface Planting {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  stake_amount: bigint;
  transaction_hash?: string;
  status: OperationStatus;
  error_message?: string;
  planted_at: Date;
}

export interface Work {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  nonce: bigint;
  hash: string;
  zeros: number;
  gap: number;
  transaction_hash?: string;
  status: OperationStatus;
  error_message?: string;
  compensation_required: boolean;
  worked_at: Date;
}

export interface Harvest {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  reward_amount: bigint;
  transaction_hash?: string;
  status: OperationStatus;
  error_message?: string;
  harvested_at: Date;
}

export interface BlockOperation {
  id: string;
  block_index: number;
  pooler_id: string;
  plant_requested_at?: Date;
  plant_completed_at?: Date;
  work_completed_at?: Date;
  harvest_completed_at?: Date;
  total_farmers: number;
  successful_plants: number;
  successful_works: number;
  successful_harvests: number;
  total_staked: bigint;
  total_rewards: bigint;
  status: BlockOperationStatus;
}

// ======================
// API REQUEST/RESPONSE TYPES
// ======================

export interface PlantRequest {
  block_index: number;
  pooler_id: string;
  max_farmers_capacity: number;
  timestamp: string;
}

export interface PlantResponse {
  success: boolean;
  planted_farmers: PlantedFarmer[];
  failed_plants: FailedPlant[];
  summary: PlantSummary;
}

export interface PlantedFarmer {
  farmer_id: string;
  custodial_wallet: string;
  stake_amount: bigint;
  plant_tx_hash: string;
}

export interface FailedPlant {
  farmer_id: string;
  error: string;
  message: string;
}

export interface PlantSummary {
  total_requested: number;
  successful_plants: number;
  failed_plants: number;
  total_staked: bigint;
}

export interface WorkCompleteRequest {
  block_index: number;
  pooler_id: string;
  work_results: WorkResult[];
  timestamp: string;
}

export interface WorkResult {
  farmer_id: string;
  status: 'success' | 'failed';
  nonce?: bigint;
  hash?: string;
  zeros?: number;
  gap?: number;
  work_tx_hash?: string;
  error?: string;
  compensation_required?: boolean;
}

export interface WorkCompleteResponse {
  success: boolean;
  work_recorded: number;
  compensation_amount: bigint;
  ready_for_harvest: string[];
}

export interface HarvestRequest {
  pooler_id: string;
  harvest_blocks: HarvestBlock[];
}

export interface HarvestBlock {
  block_index: number;
  farmer_ids: string[];
}

export interface HarvestResponse {
  success: boolean;
  harvest_results: HarvestResult[];
  failed_harvests: FailedHarvest[];
  total_rewards: bigint;
}

export interface HarvestResult {
  block_index: number;
  farmer_id: string;
  reward_amount: bigint;
  harvest_tx_hash: string;
}

export interface FailedHarvest {
  block_index: number;
  farmer_id: string;
  error: string;
  message: string;
}

// ======================
// UTILITY TYPES
// ======================

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

export interface WalletKeypair {
  publicKey: string;
  secretKey: string;
}

export interface StellarTransaction {
  hash: string;
  success: boolean;
  error?: string;
}