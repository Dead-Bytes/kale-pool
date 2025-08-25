// Block monitoring and contract interaction types for Pooler service

export interface KaleBlock {
  index: number;
  timestamp?: bigint;
  min_gap: bigint;
  min_stake: bigint;
  min_zeros: bigint;
  max_gap: bigint;
  max_stake: bigint;
  max_zeros: bigint;
  entropy?: Buffer;
  staked_total?: bigint;
  normalized_total?: bigint;
}

export interface KalePail {
  sequence: bigint;
  gap: bigint | undefined;
  stake: bigint;
  zeros: bigint | undefined;
}

export interface ContractData {
  index: number;
  block: KaleBlock | undefined;
  pail: KalePail | undefined;
}

export interface BlockDiscoveryEvent {
  previousIndex: number;
  newIndex: number;
  block: KaleBlock | undefined;
  entropy: string;
  timestamp: Date;
  blockAge: number; // seconds since block creation
}

export interface PoolerState {
  currentBlockIndex: number;
  lastBlockTimestamp: Date | null;
  isMonitoring: boolean;
  consecutiveMissedBlocks: number;
  totalBlocksDiscovered: number;
  startTime: Date;
  lastNotificationSent: Date | null;
  errorCount: number;
  maxErrorCount: number;
}

export interface BlockMonitorConfig {
  pollIntervalMs: number;
  initialDelayMs: number;
  maxMissedBlocks: number;
  retryAttempts: number;
  backendApiUrl: string;
  backendTimeout: number;
}

export interface BackendNotification {
  event: 'new_block_discovered';
  poolerId: string;
  blockIndex: number;
  blockData: {
    index: number;
    timestamp: string;
    entropy: string;
    blockAge: number;
    plantable: boolean;
    min_stake: string;
    max_stake: string;
    min_zeros: number;
    max_zeros: number;
    min_gap: number;
    max_gap: number;
  };
  metadata: {
    discoveredAt: string;
    poolerUptime: number;
    totalBlocksDiscovered: number;
  };
}

export interface BackendResponse {
  success: boolean;
  message: string;
  acknowledged: boolean;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  currentBlock: number;
  blocksDiscovered: number;
  lastBlockAge: number;
  errorCount: number;
  isMonitoring: boolean;
  lastNotification: string | null;
  contractConnection: 'connected' | 'disconnected' | 'error';
  backendConnection: 'connected' | 'disconnected' | 'error';
}