// Harvest service for KALE Pool Mining Backend
// Phase 1: Coordinated harvest operations for farmers

import { stellarWalletManager } from './wallet-manager';
import { farmerQueries, harvestQueries, poolerQueries } from './database';
import type { FarmerRow } from './database';
import Config from '../../../Shared/config';

// Logger implementation
class HarvestLogger {
  constructor(private component: string) {}

  info(message: string, context?: any): void {
    console.log(`[${new Date().toISOString()}] INFO [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
  }

  warn(message: string, context?: any): void {
    console.warn(`[${new Date().toISOString()}] WARN [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
  }

  error(message: string, error?: Error, context?: any): void {
    console.error(`[${new Date().toISOString()}] ERROR [${this.component}] ${message} ${error?.message || ''} ${context ? JSON.stringify(context) : ''}`);
  }

  debug(message: string, context?: any): void {
    if (Config.LOG_LEVEL === 'debug') {
      console.debug(`[${new Date().toISOString()}] DEBUG [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
    }
  }
}

const logger = new HarvestLogger('HarvestService');

// Harvest operation interfaces
export interface HarvestAttempt {
  farmerId: string;
  custodialWallet: string;
  rewardAmount: string;
  status: 'success' | 'failed';
  transactionHash?: string;
  error?: string;
}

export interface HarvestServiceResult {
  blockIndex: number;
  poolerId: string;
  totalEligible: number;
  successfulHarvests: HarvestAttempt[];
  failedHarvests: HarvestAttempt[];
  totalRewards: string;
  processingTimeMs: number;
}

// ======================
// HARVEST SERVICE
// ======================

export class HarvestService {
  private readonly MAX_BATCH_SIZE = 50;
  private readonly PARALLEL_LIMIT = 10;

  // ======================
  // MAIN HARVEST COORDINATION
  // ======================

  async processHarvestRequest(
    blockIndex: number,
    poolerId: string
  ): Promise<HarvestServiceResult> {
    const startTime = Date.now();

    logger.info('Starting harvest request processing', {
      block_index: blockIndex,
      pooler_id: poolerId
    });

    try {
      // Update pooler last seen
      await poolerQueries.updatePoolerLastSeen(poolerId);

      // Get farmers eligible for harvest
      const eligibleFarmers = await this.getHarvestableFarmers(blockIndex, poolerId);

      if (eligibleFarmers.length === 0) {
        logger.warn('No farmers eligible for harvest', {
          pooler_id: poolerId,
          block_index: blockIndex
        });

        return {
          blockIndex,
          poolerId,
          totalEligible: 0,
          successfulHarvests: [],
          failedHarvests: [],
          totalRewards: '0',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Process harvests in parallel batches
      const harvestResults = await this.executeHarvestBatch(blockIndex, poolerId, eligibleFarmers);

      // Calculate totals
      const successful = harvestResults.filter(result => result.status === 'success');
      const failed = harvestResults.filter(result => result.status === 'failed');
      
      const totalRewards = successful.reduce((sum, result) => {
        return (BigInt(sum) + BigInt(result.rewardAmount)).toString();
      }, '0');

      const result: HarvestServiceResult = {
        blockIndex,
        poolerId,
        totalEligible: eligibleFarmers.length,
        successfulHarvests: successful,
        failedHarvests: failed,
        totalRewards,
        processingTimeMs: Date.now() - startTime
      };

      logger.info('Harvest request processing completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        total_eligible: result.totalEligible,
        successful: successful.length,
        failed: failed.length,
        total_rewards: totalRewards,
        processing_time_ms: result.processingTimeMs
      });

      return result;

    } catch (error) {
      logger.error('Harvest request processing failed', error as Error, {
        block_index: blockIndex,
        pooler_id: poolerId,
        processing_time_ms: Date.now() - startTime
      });

      throw new Error(`Harvest processing failed: ${(error as Error).message}`);
    }
  }

  // ======================
  // FARMER ELIGIBILITY
  // ======================

  private async getHarvestableFarmers(blockIndex: number, poolerId: string): Promise<FarmerRow[]> {
    try {
      // Get farmers who have worked in this block
      const farmerIds = await harvestQueries.getHarvestableFarmers(blockIndex, poolerId);
      
      if (farmerIds.length === 0) {
        return [];
      }

      // Get full farmer records
      const farmers: FarmerRow[] = [];
      
      for (const farmerId of farmerIds) {
        try {
          const farmer = await farmerQueries.getFarmerById(farmerId);
          if (farmer && farmer.status === 'active') {
            farmers.push(farmer);
          }
        } catch (error) {
          logger.error('Failed to get farmer for harvest', error as Error, {
            farmer_id: farmerId
          });
        }
      }

      logger.debug('Retrieved harvestable farmers', {
        block_index: blockIndex,
        pooler_id: poolerId,
        total_farmers: farmers.length
      });

      return farmers;

    } catch (error) {
      logger.error('Failed to get harvestable farmers', error as Error, {
        block_index: blockIndex,
        pooler_id: poolerId
      });
      throw error;
    }
  }

  // ======================
  // HARVEST EXECUTION
  // ======================

  private async executeHarvestBatch(
    blockIndex: number,
    poolerId: string,
    farmers: FarmerRow[]
  ): Promise<HarvestAttempt[]> {
    logger.info('Starting harvest batch execution', {
      block_index: blockIndex,
      pooler_id: poolerId,
      farmer_count: farmers.length
    });

    const results: HarvestAttempt[] = [];

    // Process farmers in parallel batches
    for (let i = 0; i < farmers.length; i += this.PARALLEL_LIMIT) {
      const batch = farmers.slice(i, i + this.PARALLEL_LIMIT);
      
      const batchPromises = batch.map(farmer => 
        this.executeSingleHarvest(blockIndex, poolerId, farmer)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process settled promises
      batchResults.forEach((result, index) => {
        const farmer = batch[index];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Harvest operation promise failed', result.reason, {
            farmer_id: farmer.id,
            block_index: blockIndex
          });
          
          results.push({
            farmerId: farmer.id,
            custodialWallet: farmer.custodial_public_key,
            rewardAmount: '0',
            status: 'failed',
            error: result.reason?.message || 'Promise rejection'
          });
        }
      });
    }

    return results;
  }

  private async executeSingleHarvest(
    blockIndex: number,
    poolerId: string,
    farmer: FarmerRow
  ): Promise<HarvestAttempt> {
    const harvestStartTime = Date.now();

    try {
      // Calculate harvest reward
      const rewardAmount = await this.calculateHarvestReward(blockIndex, farmer.id);

      logger.debug('Executing harvest for farmer', {
        farmer_id: farmer.id,
        custodial_wallet: farmer.custodial_public_key,
        reward_amount: rewardAmount,
        block_index: blockIndex
      });

      // Execute harvest transaction
      const harvestResult = await stellarWalletManager.harvestForFarmer(
        farmer.custodial_secret_key,
        blockIndex
      );

      if (harvestResult.success && harvestResult.transactionHash) {
        // Record successful harvest in database
        await harvestQueries.recordHarvest(
          blockIndex,
          farmer.id,
          poolerId,
          farmer.custodial_public_key,
          rewardAmount,
          harvestResult.transactionHash,
          'success'
        );

        // Update farmer balance
        await farmerQueries.updateFarmerBalance(
          farmer.id,
          (BigInt(farmer.current_balance || '0') + BigInt(rewardAmount)).toString()
        );

        logger.debug('Harvest operation successful', {
          farmer_id: farmer.id,
          transaction_hash: harvestResult.transactionHash,
          reward_amount: rewardAmount,
          duration_ms: Date.now() - harvestStartTime
        });

        return {
          farmerId: farmer.id,
          custodialWallet: farmer.custodial_public_key,
          rewardAmount,
          status: 'success',
          transactionHash: harvestResult.transactionHash
        };

      } else {
        // Record failed harvest in database
        await harvestQueries.recordHarvest(
          blockIndex,
          farmer.id,
          poolerId,
          farmer.custodial_public_key,
          rewardAmount,
          'failed_transaction',
          'failed',
          harvestResult.error
        );

        logger.warn('Harvest operation failed', {
          farmer_id: farmer.id,
          error: harvestResult.error,
          reward_amount: rewardAmount,
          duration_ms: Date.now() - harvestStartTime
        });

        return {
          farmerId: farmer.id,
          custodialWallet: farmer.custodial_public_key,
          rewardAmount,
          status: 'failed',
          error: harvestResult.error
        };
      }

    } catch (error) {
      // Record failed harvest in database
      try {
        await harvestQueries.recordHarvest(
          blockIndex,
          farmer.id,
          poolerId,
          farmer.custodial_public_key,
          '0',
          'error_before_tx',
          'failed',
          (error as Error).message
        );
      } catch (dbError) {
        logger.error('Failed to record harvest failure in database', dbError as Error, {
          farmer_id: farmer.id,
          block_index: blockIndex
        });
      }

      logger.error('Harvest operation exception', error as Error, {
        farmer_id: farmer.id,
        block_index: blockIndex,
        duration_ms: Date.now() - harvestStartTime
      });

      return {
        farmerId: farmer.id,
        custodialWallet: farmer.custodial_public_key,
        rewardAmount: '0',
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  // ======================
  // REWARD CALCULATION
  // ======================

  private async calculateHarvestReward(blockIndex: number, farmerId: string): Promise<string> {
    try {
      // Get work count for this farmer in this block
      const workCount = await this.getWorkerWorkCount(blockIndex, farmerId);
      
      if (workCount === 0) {
        return '0';
      }

      // Base reward per work (configurable)
      const baseRewardPerWork = BigInt('500000000'); // 500 KALE per work
      
      // Calculate total reward
      const totalReward = baseRewardPerWork * BigInt(workCount);

      logger.debug('Harvest reward calculation completed', {
        farmer_id: farmerId,
        block_index: blockIndex,
        work_count: workCount,
        base_reward_per_work: baseRewardPerWork.toString(),
        total_reward: totalReward.toString()
      });

      return totalReward.toString();

    } catch (error) {
      logger.error('Harvest reward calculation failed', error as Error, {
        farmer_id: farmerId,
        block_index: blockIndex
      });

      // Return 0 reward on calculation error
      return '0';
    }
  }

  private async getWorkerWorkCount(blockIndex: number, farmerId: string): Promise<number> {
    try {
      // This would query the works table for successful works by this farmer in this block
      // For now, return a mock value
      return 1; // TODO: Implement actual query
    } catch (error) {
      logger.error('Failed to get worker work count', error as Error, {
        farmer_id: farmerId,
        block_index: blockIndex
      });
      return 0;
    }
  }

  // ======================
  // HARVEST HISTORY
  // ======================

  async getRecentHarvestActivity(poolerId: string, limit: number = 100) {
    try {
      // TODO: Implement harvestQueries.getRecentHarvestByPooler
      const recentHarvests: any[] = []; // Mock for now
      
      logger.debug('Retrieved recent harvest activity', {
        pooler_id: poolerId,
        harvest_count: recentHarvests.length,
        limit
      });

      return recentHarvests;

    } catch (error) {
      logger.error('Failed to get recent harvest activity', error as Error, {
        pooler_id: poolerId
      });
      throw error;
    }
  }

  async getHarvestStatistics(poolerId: string, hours: number = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // TODO: Implement harvestQueries.getHarvestStatistics
      const harvestStats = {
        total_harvests: 0,
        total_rewards: '0',
        average_reward: '0',
        unique_farmers: 0
      };
      
      logger.debug('Retrieved harvest statistics', {
        pooler_id: poolerId,
        hours,
        stats: harvestStats
      });

      return harvestStats;

    } catch (error) {
      logger.error('Failed to get harvest statistics', error as Error, {
        pooler_id: poolerId,
        hours
      });
      throw error;
    }
  }

  // ======================
  // SERVICE HEALTH
  // ======================

  async isHealthy(): Promise<boolean> {
    try {
      // Check wallet manager health
      const walletHealthy = await stellarWalletManager.getServerHealth();
      
      return walletHealthy;
    } catch (error) {
      logger.error('Harvest service health check failed', error as Error);
      return false;
    }
  }

  getServiceInfo() {
    return {
      service: 'HarvestService',
      max_batch_size: this.MAX_BATCH_SIZE,
      parallel_limit: this.PARALLEL_LIMIT,
      network_info: stellarWalletManager.getNetworkInfo()
    };
  }
}

// Export singleton instance
export const harvestService = new HarvestService();
