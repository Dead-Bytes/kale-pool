// API request/response types for KALE Pool Mining Backend
// Phase 1: REST API interface definitions

// Import shared types - will be resolved by build system
export interface FarmerStatus {
  ACTIVE: 'active';
  LEAVING: 'leaving';
  DEPARTED: 'departed';
}

export interface OperationStatus {
  SUCCESS: 'success';
  FAILED: 'failed';
  PENDING: 'pending';
}

// ======================
// POOLER API REQUESTS
// ======================

export interface PlantRequestBody {
  block_index: number;
  pooler_id: string;
  max_farmers_capacity: number;
  timestamp: string;
}

export interface WorkCompleteRequestBody {
  block_index: number;
  pooler_id: string;
  work_results: WorkSubmission[];
  timestamp: string;
}

export interface WorkSubmission {
  farmer_id: string;
  status: 'success' | 'failed';
  nonce?: number;
  hash?: string;
  zeros?: number;
  gap?: number;
  work_tx_hash?: string;
  error?: string;
  compensation_required?: boolean;
}

export interface HarvestRequestBody {
  pooler_id: string;
  harvest_blocks: HarvestBlockRequest[];
}

export interface HarvestBlockRequest {
  block_index: number;
  farmer_ids: string[];
}

// ======================
// POOLER API RESPONSES
// ======================

export interface PlantResponse {
  success: boolean;
  planted_farmers: PlantedFarmer[];
  failed_plants: FailedPlant[];
  summary: PlantSummary;
}

export interface PlantedFarmer {
  farmer_id: string;
  custodial_wallet: string;
  stake_amount: string; // bigint as string
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
  total_staked: string; // bigint as string
}

export interface WorkCompleteResponse {
  success: boolean;
  work_recorded: number;
  compensation_amount: string; // bigint as string
  ready_for_harvest: string[]; // farmer_ids
}

export interface HarvestResponse {
  success: boolean;
  harvest_results: HarvestResultDetail[];
  failed_harvests: FailedHarvest[];
  total_rewards: string; // bigint as string
}

export interface HarvestResultDetail {
  block_index: number;
  farmer_id: string;
  reward_amount: string; // bigint as string
  harvest_tx_hash: string;
}

export interface FailedHarvest {
  block_index: number;
  farmer_id: string;
  error: string;
  message: string;
}

// ======================
// FARMER MANAGEMENT API
// ======================

export interface FarmerRegistrationRequest {
  pooler_id: string;
  payout_wallet: string;
  stake_percentage: number;
}

export interface FarmerRegistrationResponse {
  success: boolean;
  farmer_id: string;
  custodial_wallet: string;
  needs_funding: boolean;
  message: string;
}

export interface FarmerFundingConfirmRequest {
  farmer_id: string;
}

export interface FarmerFundingConfirmResponse {
  success: boolean;
  status: FarmerStatus;
  current_balance: string; // XLM balance as string
  kale_balance: string; // KALE balance as string
  message: string;
}

export interface FarmerDetailsResponse {
  farmer_id: string;
  custodial_wallet: string;
  payout_wallet: string;
  pooler_id: string;
  stake_percentage: number;
  current_balance: string;
  status: FarmerStatus;
  is_funded: boolean;
  created_at: string;
  last_activity: string;
}

// ======================
// POOLER MANAGEMENT API
// ======================

export interface PoolerRegistrationRequest {
  name: string;
  public_key: string;
  api_endpoint: string;
  max_farmers: number;
}

export interface PoolerRegistrationResponse {
  success: boolean;
  pooler_id: string;
  api_key: string;
  message: string;
}

export interface PoolerDetailsResponse {
  pooler_id: string;
  name: string;
  public_key: string;
  api_endpoint: string;
  max_farmers: number;
  current_farmers: number;
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

// ======================
// HEALTH & MONITORING API
// ======================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: ServiceHealthCheck[];
  metrics?: HealthMetrics;
}

export interface ServiceHealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  response_time_ms?: number;
  last_check: string;
}

export interface HealthMetrics {
  uptime_seconds: number;
  total_requests: number;
  active_farmers: number;
  active_poolers: number;
  database_connections: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
}

// ======================
// ANALYTICS API
// ======================

export interface FarmerAnalyticsResponse {
  farmer_id: string;
  total_blocks_participated: number;
  successful_plants: number;
  successful_works: number;
  successful_harvests: number;
  total_rewards_earned: string; // bigint as string
  average_stake_amount: string;
  success_rates: {
    plant_success_rate: number;
    work_success_rate: number;
    harvest_success_rate: number;
  };
  recent_activity: RecentActivity[];
}

export interface RecentActivity {
  block_index: number;
  operation_type: 'plant' | 'work' | 'harvest';
  status: OperationStatus;
  amount?: string; // for rewards/stakes
  timestamp: string;
}

export interface PoolerAnalyticsResponse {
  pooler_id: string;
  total_blocks_processed: number;
  total_farmers_managed: number;
  total_rewards_distributed: string;
  performance_metrics: {
    average_farmers_per_block: number;
    plant_success_rate: number;
    work_success_rate: number;
    harvest_success_rate: number;
    average_response_time_ms: number;
  };
  compensation_tracking: {
    total_compensation_owed: string;
    compensation_paid: string;
    outstanding_compensation: string;
  };
}

// ======================
// ERROR RESPONSES
// ======================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}

// ======================
// PAGINATION
// ======================

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// ======================
// COMMON REQUEST HEADERS
// ======================

export interface AuthenticatedRequestHeaders {
  authorization: string; // Bearer <api_key>
  'content-type': 'application/json';
  'user-agent'?: string;
}

// ======================
// VALIDATION SCHEMAS (for runtime validation)
// ======================

export const PlantRequestSchema = {
  type: 'object',
  required: ['block_index', 'pooler_id', 'max_farmers_capacity', 'timestamp'],
  properties: {
    block_index: { type: 'number', minimum: 0 },
    pooler_id: { type: 'string', format: 'uuid' },
    max_farmers_capacity: { type: 'number', minimum: 1, maximum: 100 },
    timestamp: { type: 'string', format: 'date-time' }
  },
  additionalProperties: false
} as const;

export const WorkCompleteRequestSchema = {
  type: 'object',
  required: ['block_index', 'pooler_id', 'work_results', 'timestamp'],
  properties: {
    block_index: { type: 'number', minimum: 0 },
    pooler_id: { type: 'string', format: 'uuid' },
    timestamp: { type: 'string', format: 'date-time' },
    work_results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['farmer_id', 'status'],
        properties: {
          farmer_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['success', 'failed'] },
          nonce: { type: 'number', minimum: 0 },
          hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
          zeros: { type: 'number', minimum: 0, maximum: 20 },
          gap: { type: 'number', minimum: 0 },
          work_tx_hash: { type: 'string' },
          error: { type: 'string' },
          compensation_required: { type: 'boolean' }
        }
      }
    }
  },
  additionalProperties: false
} as const;

export const HarvestRequestSchema = {
  type: 'object',
  required: ['pooler_id', 'harvest_blocks'],
  properties: {
    pooler_id: { type: 'string', format: 'uuid' },
    harvest_blocks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['block_index', 'farmer_ids'],
        properties: {
          block_index: { type: 'number', minimum: 0 },
          farmer_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' }
          }
        }
      }
    }
  },
  additionalProperties: false
} as const;
