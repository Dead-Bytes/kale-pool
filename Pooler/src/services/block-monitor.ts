// KALE Block Discovery Service - Monitors mainnet for new blocks
// Based on enhanced-farmer.ts pattern from KALE-farmer reference

import { scValToNative, xdr } from '@stellar/stellar-sdk';
import { Server, Durability } from '@stellar/stellar-sdk/rpc';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { blockMonitorLogger as logger } from '../../../Shared/utils/logger';
import Config from '../../../Shared/config';
import { calculateTimingPredictions, formatISTTime, getISTDate } from '../../../Shared/utils/timing';
import type { 
  ContractData, 
  KaleBlock, 
  KalePail,
  BlockDiscoveryEvent,
  PoolerState,
  BlockMonitorConfig,
  BackendNotification,
  BackendResponse
} from '../types/block-types';

// Load environment configuration
dotenv.config({ path: '.env.mainnet' });

class BlockMonitor {
  private rpc: Server;
  private state: PoolerState;
  private config: BlockMonitorConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    // Initialize Stellar RPC connection
    this.rpc = new Server(Config.STELLAR.RPC_URL);
    
    // Initialize pooler state
    this.state = {
      currentBlockIndex: 0,
      lastBlockTimestamp: null,
      isMonitoring: false,
      consecutiveMissedBlocks: 0,
      totalBlocksDiscovered: 0,
      startTime: new Date(),
      lastNotificationSent: null,
      errorCount: 0,
      maxErrorCount: Config.BLOCK_MONITOR.MAX_ERROR_COUNT
    };

    // Initialize configuration
    this.config = {
      pollIntervalMs: Config.BLOCK_MONITOR.POLL_INTERVAL_MS,
      initialDelayMs: Config.BLOCK_MONITOR.INITIAL_DELAY_MS,
      maxMissedBlocks: Config.BLOCK_MONITOR.MAX_MISSED_BLOCKS,
      retryAttempts: Config.BLOCK_MONITOR.RETRY_ATTEMPTS,
      backendApiUrl: Config.BACKEND_API.URL,
      backendTimeout: Config.BACKEND_API.TIMEOUT_MS
    };

    this.log('BlockMonitor initialized', {
      rpc_url: Config.STELLAR.RPC_URL,
      contract_id: Config.STELLAR.CONTRACT_ID,
      poll_interval: this.config.pollIntervalMs,
      backend_url: this.config.backendApiUrl
    });
  }

  /**
   * Start block monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.state.isMonitoring) {
      this.log('Block monitoring already running');
      return;
    }

    this.log('🔍 Starting KALE block monitoring...', { 
      network: Config.STELLAR.NETWORK,
      contract: Config.STELLAR.CONTRACT_ID
    });

    try {
      // Get initial block index
      const initialData = await this.getContractData();
      this.state.currentBlockIndex = initialData.index;
      this.state.isMonitoring = true;
      
      this.log('📊 Initial block state', {
        block_index: initialData.index,
        has_block_data: !!initialData.block,
        has_pail_data: !!initialData.pail
      });

      // Start monitoring loop with initial delay
      setTimeout(() => {
        this.monitoringInterval = setInterval(() => {
          this.checkForNewBlocks().catch(error => {
            this.logError('Monitoring loop error', error);
          });
        }, this.config.pollIntervalMs);

        // Run first check immediately after delay
        this.checkForNewBlocks().catch(error => {
          this.logError('Initial block check error', error);
        });
      }, this.config.initialDelayMs);

      this.log('✅ Block monitoring started successfully');
    } catch (error) {
      this.logError('Failed to start block monitoring', error);
      this.state.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop block monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.state.isMonitoring) {
      return;
    }

    this.isShuttingDown = true;
    this.log('🛑 Stopping block monitoring...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.state.isMonitoring = false;
    this.log('✅ Block monitoring stopped');
  }

  /**
   * Check for new blocks (main monitoring loop)
   */
  private async checkForNewBlocks(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      // Get current contract state
      const contractData = await this.getContractData();
      
      // Check for new block
      if (contractData.index > this.state.currentBlockIndex) {
        await this.handleNewBlockDiscovered(contractData);
      } else if (contractData.index < this.state.currentBlockIndex) {
        // Handle potential chain reorganization
        this.log('⚠️ Block index decreased - possible chain reorg', {
          previous: this.state.currentBlockIndex,
          current: contractData.index
        });
        this.state.currentBlockIndex = contractData.index;
      }

      // Reset error count on successful check
      if (this.state.errorCount > 0) {
        this.state.errorCount = 0;
        this.log('✅ Error count reset after successful block check');
      }

    } catch (error) {
      await this.handleMonitoringError(error);
    }
  }

  /**
   * Handle new block discovery
   */
  private async handleNewBlockDiscovered(contractData: ContractData): Promise<void> {
    const previousIndex = this.state.currentBlockIndex;
    const newIndex = contractData.index;
    
    this.log(chalk.magenta.bold(`🔔 NEW BLOCK DISCOVERED: ${previousIndex} → ${newIndex}`));
    
    // Calculate block age and metadata
    const now = new Date();
    const blockTimestamp = contractData.block?.timestamp 
      ? new Date(Number(contractData.block.timestamp) * 1000) 
      : now;
    const blockAge = Math.floor((now.getTime() - blockTimestamp.getTime()) / 1000);
    const entropy = contractData.block?.entropy?.toString('hex') || Buffer.alloc(32).toString('hex');
    
    // Calculate timing predictions for plant/work/harvest cycle
    const timingPredictions = calculateTimingPredictions(
      Number(contractData.block?.timestamp || Math.floor(now.getTime() / 1000)),
      30,  // planting delay: 30 seconds
      150, // work delay: 2.5 minutes after planting
      30   // harvest delay: 30 seconds after work completion
    );
    
    // Log timing predictions in IST
    this.log(chalk.cyan.bold('📅 TIMING PREDICTIONS (IST):'), {
      current_time: timingPredictions.currentTimeIST,
      block_discovered: timingPredictions.blockDiscoveredTimeIST,
      planting_scheduled: timingPredictions.plantingTimeIST,
      work_scheduled: timingPredictions.workTimeIST,
      harvest_eligible: timingPredictions.harvestTimeIST,
      cycle_details: {
        planting_in: '30 seconds from block discovery',
        work_in: '2.5 minutes after planting starts',
        harvest_in: '30 seconds after work completion'
      }
    });
    
    // Update state
    this.state.currentBlockIndex = newIndex;
    this.state.lastBlockTimestamp = blockTimestamp;
    this.state.totalBlocksDiscovered++;
    this.state.consecutiveMissedBlocks = 0;

    // Create block discovery event
    const blockEvent: BlockDiscoveryEvent = {
      previousIndex,
      newIndex,
      block: contractData.block,
      entropy,
      timestamp: now,
      blockAge
    };

    this.log('📊 Block discovered details', {
      block_index: newIndex,
      block_age_seconds: blockAge,
      entropy_preview: entropy.substring(0, 16) + '...',
      plantable: blockAge >= 30 && blockAge < 240,
      total_discovered: this.state.totalBlocksDiscovered
    });

    // Notify backend
    await this.notifyBackend(blockEvent);

    // Log discovery summary
    this.logBlockSummary(contractData, blockEvent);
  }

  /**
   * Notify backend of new block discovery
   */
  private async notifyBackend(blockEvent: BlockDiscoveryEvent): Promise<void> {
    try {
      const notification: BackendNotification = {
        event: 'new_block_discovered',
        poolerId: Config.POOLER.ID,
        blockIndex: blockEvent.newIndex,
        blockData: {
          index: blockEvent.newIndex,
          timestamp: blockEvent.timestamp.toISOString(),
          entropy: blockEvent.entropy,
          blockAge: blockEvent.blockAge,
          plantable: blockEvent.blockAge >= 30 && blockEvent.blockAge < 240,
          min_stake: blockEvent.block?.min_stake?.toString() || '0',
          max_stake: blockEvent.block?.max_stake?.toString() || '0',
          min_zeros: Number(blockEvent.block?.min_zeros) || 0,
          max_zeros: Number(blockEvent.block?.max_zeros) || 0,
          min_gap: Number(blockEvent.block?.min_gap) || 0,
          max_gap: Number(blockEvent.block?.max_gap) || 0,
        },
        metadata: {
          discoveredAt: blockEvent.timestamp.toISOString(),
          poolerUptime: Date.now() - this.state.startTime.getTime(),
          totalBlocksDiscovered: this.state.totalBlocksDiscovered
        }
      };

      this.log('📡 Notifying backend...', {
        backend_url: this.config.backendApiUrl,
        block_index: blockEvent.newIndex
      });

      const response = await fetch(`${this.config.backendApiUrl}/pooler/block-discovered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KALE-Pool-Pooler/1.0.0'
        },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(this.config.backendTimeout)
      });

      if (response.ok) {
        const result: BackendResponse = await response.json();
        this.state.lastNotificationSent = new Date();
        this.log('✅ Backend notified successfully', {
          acknowledged: result.acknowledged,
          message: result.message
        });
      } else {
        throw new Error(`Backend responded with status ${response.status}: ${await response.text()}`);
      }

    } catch (error) {
      this.logError('Failed to notify backend', error, {
        block_index: blockEvent.newIndex,
        backend_url: this.config.backendApiUrl
      });
    }
  }

  /**
   * Get current contract data (index, block, pail) - public method for startup checks
   */
  async getCurrentContractData(): Promise<ContractData> {
    return this.getContractData();
  }

  /**
   * Get current contract data (index, block, pail)
   */
  private async getContractData(): Promise<ContractData> {
    const contractId = Config.STELLAR.CONTRACT_ID;
    let index = 0;
    let block: KaleBlock | undefined;
    let pail: KalePail | undefined;

    try {
      // Get farm index
      index = await this.getIndex(contractId);
      
      // Get block data if index > 0
      if (index > 0) {
        block = await this.getBlock(contractId, index);
        // Note: We don't get pail data in pooler as we don't have a specific farmer address
      }
    } catch (error) {
      // Log but don't throw - allow partial data
      this.logError('Error getting contract data', error);
    }

    return { index, block, pail };
  }

  /**
   * Get current farm index from contract
   */
  private async getIndex(contractId: string): Promise<number> {
    const response = await this.rpc.getContractData(
      contractId,
      xdr.ScVal.scvLedgerKeyContractInstance()
    );

    const storage = response.val
      .contractData()
      .val()
      .instance()
      .storage();

    let index = 0;
    storage?.forEach((entry) => {
      const key: string = scValToNative(entry.key())[0];
      if (key === 'FarmIndex') {
        index = entry.val().u32();
      }
    });

    return index;
  }

  /**
   * Get block data for specific index
   */
  private async getBlock(contractId: string, index: number): Promise<KaleBlock | undefined> {
    try {
      const response = await this.rpc.getContractData(
        contractId, 
        xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol('Block'),
          xdr.ScVal.scvU32(index)
        ]), 
        Durability.Temporary
      );

      const blockData = scValToNative(response.val.contractData().val());
      return {
        index,
        ...blockData
      } as KaleBlock;
    } catch (error) {
      this.logError('Failed to get block data', error, { index });
      return undefined;
    }
  }

  /**
   * Handle monitoring errors
   */
  private async handleMonitoringError(error: any): Promise<void> {
    this.state.errorCount++;
    this.logError('Block monitoring error', error, {
      error_count: this.state.errorCount,
      max_errors: this.state.maxErrorCount
    });

    if (this.state.errorCount >= this.state.maxErrorCount) {
      this.log('❌ Too many consecutive errors - stopping monitoring');
      await this.stopMonitoring();
    }
  }

  /**
   * Log block discovery summary
   */
  private logBlockSummary(contractData: ContractData, blockEvent: BlockDiscoveryEvent): void {
    console.log(chalk.green.bold('📈 BLOCK DISCOVERY SUMMARY'));
    console.log(`   Block Index: ${blockEvent.newIndex}`);
    console.log(`   Block Age: ${blockEvent.blockAge}s`);
    console.log(`   Plantable: ${blockEvent.blockAge >= 30 && blockEvent.blockAge < 240 ? '✅ Yes' : '❌ No'}`);
    console.log(`   Total Discovered: ${this.state.totalBlocksDiscovered}`);
    console.log(`   Pooler Uptime: ${Math.floor((Date.now() - this.state.startTime.getTime()) / 1000)}s`);
    if (contractData.block) {
      console.log(`   Min Stake: ${Number(contractData.block.min_stake) / 10**7} KALE`);
      console.log(`   Max Stake: ${Number(contractData.block.max_stake) / 10**7} KALE`);
      console.log(`   Zeros Range: ${contractData.block.min_zeros} - ${contractData.block.max_zeros}`);
    }
    console.log('');
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    const uptime = Date.now() - this.state.startTime.getTime();
    const lastBlockAge = this.state.lastBlockTimestamp 
      ? Math.floor((Date.now() - this.state.lastBlockTimestamp.getTime()) / 1000)
      : -1;

    return {
      status: this.state.isMonitoring ? 
        (this.state.errorCount < this.state.maxErrorCount ? 'healthy' : 'degraded') : 
        'unhealthy',
      uptime: Math.floor(uptime / 1000),
      currentBlock: this.state.currentBlockIndex,
      blocksDiscovered: this.state.totalBlocksDiscovered,
      lastBlockAge,
      errorCount: this.state.errorCount,
      isMonitoring: this.state.isMonitoring,
      lastNotification: this.state.lastNotificationSent?.toISOString() || null,
      contractConnection: 'connected', // TODO: Add actual connection checking
      backendConnection: 'connected'    // TODO: Add actual connection checking
    };
  }

  /**
   * Logging helper
   */
  private log(message: string, data?: any): void {
    logger.info(message, data);
  }

  /**
   * Error logging helper
   */
  private logError(message: string, error: any, data?: any): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(message, errorObj, data);
  }
}

export default BlockMonitor;