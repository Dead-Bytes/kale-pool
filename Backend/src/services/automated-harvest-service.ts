// Automated Harvest Service - Phase 4 Final Implementation
// Continuously monitors and harvests farmer rewards when ready

import { LaunchtubeService } from './launchtube-service';
import { blockOperationsQueries } from './database-phase2';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import Config from '../../../Shared/config';
import { formatISTTime, getISTDate } from '../../../Shared/utils/timing';

interface HarvestCandidate {
  farmerId: string;
  farmerPublicKey: string;
  farmerSecretKey: string;
  blockIndex: number;
  lastWorkTimestamp: Date;
  harvestInterval: number; // seconds to wait before harvest
}

interface HarvestResult {
  farmerId: string;
  blockIndex: number;
  success: boolean;
  transactionHash?: string;
  reward?: string;
  error?: string;
  processingTimeMs: number;
}

interface HarvestBatchResult {
  processedCount: number;
  successfulHarvests: HarvestResult[];
  failedHarvests: HarvestResult[];
  totalRewards: bigint;
  batchDurationMs: number;
}

export class AutomatedHarvestService {
  private harvestInterval: NodeJS.Timer | null = null;
  private isRunning = false;
  private launchtubeService: LaunchtubeService;
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  private readonly MAX_PARALLEL_HARVESTS = 10;
  private readonly DEFAULT_HARVEST_DELAY = 30; // 30 seconds after work completion

  constructor() {
    this.launchtubeService = new LaunchtubeService();
    logger.info(`AutomatedHarvestService initialized ${JSON.stringify({
      check_interval_ms: this.CHECK_INTERVAL_MS,
      max_parallel_harvests: this.MAX_PARALLEL_HARVESTS,
      default_harvest_delay: this.DEFAULT_HARVEST_DELAY
    })}`);
  }

  /**
   * Start the automated harvest service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Automated harvest service already running');
      return;
    }

    this.isRunning = true;
    
    logger.info(`🚜 Starting automated harvest service ${JSON.stringify({
      check_interval_ms: this.CHECK_INTERVAL_MS
    })}`);

    // Start the harvest check loop
    this.harvestInterval = setInterval(async () => {
      try {
        await this.executeHarvestCycle();
      } catch (error) {
        logger.error('Error in automated harvest cycle', error as Error);
      }
    }, this.CHECK_INTERVAL_MS);

    // Run initial harvest check
    setTimeout(() => this.executeHarvestCycle(), 5000);
  }

  /**
   * Stop the automated harvest service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.harvestInterval) {
      clearInterval(this.harvestInterval);
      this.harvestInterval = null;
    }

    this.isRunning = false;
    logger.info('🛑 Automated harvest service stopped');
  }

  /**
   * Main harvest cycle - finds and harvests ready farmers
   */
  private async executeHarvestCycle(): Promise<void> {
    const cycleStartTime = Date.now();

    try {
      logger.debug('🔍 Starting harvest cycle');

      // Find farmers ready for harvest
      const harvestCandidates = await this.findHarvestCandidates();

      if (harvestCandidates.length === 0) {
        logger.debug('No farmers ready for harvest');
        return;
      }

      logger.info(`🌾 Found farmers ready for harvest ${JSON.stringify({
        candidate_count: harvestCandidates.length,
        blocks: [...new Set(harvestCandidates.map(c => c.blockIndex))].sort(),
        current_time_ist: formatISTTime(),
        farmers_details: harvestCandidates.map(c => ({
          farmer_id: c.farmerId.substring(0, 8) + '...',
          block_index: c.blockIndex,
          work_completed_at_ist: formatISTTime(c.lastWorkTimestamp),
          ready_since_minutes: Math.floor((Date.now() - c.lastWorkTimestamp.getTime()) / 60000)
        }))})}`);
      // Execute harvest batch
      const batchResult = await this.executeHarvestBatch(harvestCandidates);

      // Log results
      if (batchResult.successfulHarvests.length > 0) {
        logger.info(`✅ Harvest cycle completed successfully ${JSON.stringify({
          processed: batchResult.processedCount,
          successful: batchResult.successfulHarvests.length,
          failed: batchResult.failedHarvests.length,
          total_rewards: (Number(batchResult.totalRewards) / 10**7).toFixed(4) + ' KALE',
          cycle_duration_ms: Date.now() - cycleStartTime,
          batch_duration_ms: batchResult.batchDurationMs
        })}`);
      } else if (batchResult.failedHarvests.length > 0) {
        logger.warn(`⚠️ Harvest cycle completed with failures ${JSON.stringify({
          processed: batchResult.processedCount,
          failed: batchResult.failedHarvests.length,
          cycle_duration_ms: Date.now() - cycleStartTime
        })}`);
      }

    } catch (error) {
      logger.error('Harvest cycle failed', error as Error, {
        cycle_duration_ms: Date.now() - cycleStartTime
      });
    }
  }

  /**
   * Find farmers ready for harvest based on work completion time + harvest interval
   */
  private async findHarvestCandidates(): Promise<HarvestCandidate[]> {
    try {
      // Get all active farmers using the correct method from database.ts
      const { farmerQueries } = await import('./database');
      const activeFarmers = await farmerQueries.getActiveFarmersByPooler(Config.POOLER.ID);
      
      if (activeFarmers.length === 0) {
        return [];
      }

      const candidates: HarvestCandidate[] = [];
      const currentTime = new Date();

      // Check each farmer's work history
      for (const farmer of activeFarmers) {
        try {
          // Get recent successful work operations for this farmer
          // Look back 24 hours to find completed work that hasn't been harvested
          const recentWorks = await this.getUnharvestedWorks(farmer.id);

          for (const work of recentWorks) {
            const workCompletedAt = new Date(work.completed_at);
            const harvestInterval = this.DEFAULT_HARVEST_DELAY; // Use default since harvest_interval not in current schema
            const harvestReadyTime = new Date(workCompletedAt.getTime() + (harvestInterval * 1000));

            // Check if enough time has passed since work completion
            if (currentTime >= harvestReadyTime) {
              candidates.push({
                farmerId: farmer.id,
                farmerPublicKey: farmer.custodial_public_key,
                farmerSecretKey: farmer.custodial_secret_key,
                blockIndex: work.block_index,
                lastWorkTimestamp: workCompletedAt,
                harvestInterval
              });
            }
          }
        } catch (error) {
          logger.error('Error checking farmer for harvest readiness', error as Error, {
            farmer_id: farmer.id
          });
        }
      }

      // Remove duplicates (same farmer, same block)
      const uniqueCandidates = candidates.filter((candidate, index, array) => {
        return array.findIndex(c => 
          c.farmerId === candidate.farmerId && c.blockIndex === candidate.blockIndex
        ) === index;
      });

      logger.debug(`Found harvest candidates ${JSON.stringify({
        total_candidates: uniqueCandidates.length,
        farmers: uniqueCandidates.map(c => ({ 
          farmer_id: c.farmerId.substring(0, 8) + '...',
          block_index: c.blockIndex,
          ready_since: Math.floor((currentTime.getTime() - c.lastWorkTimestamp.getTime()) / 1000) + 's ago'
        }))})}`);

      return uniqueCandidates;

    } catch (error) {
      logger.error('Failed to find harvest candidates', error as Error);
      return [];
    }
  }

  /**
   * Get work records that have been completed but not yet harvested
   */
  private async getUnharvestedWorks(farmerId: string): Promise<any[]> {
    try {
      // This is a simplified implementation - in a real system you'd have a works table
      // For now, we'll check block operations where the farmer participated and succeeded
      
      // Get recent successful block operations where this farmer planted/worked
      const recentBlocks = await blockOperationsQueries.getRecentBlocksByFarmer(farmerId, 24); // 24 hours
      
      return recentBlocks
        .filter(block => block.successful_works > 0) // Only blocks with successful work
        .map(block => ({
          farmer_id: farmerId,
          block_index: block.block_index,
          completed_at: block.completed_at || new Date(Date.now() - 3600000), // 1 hour ago fallback
          status: 'success'
        }));

    } catch (error) {
      logger.error('Failed to get unharvested works', error as Error, { farmer_id: farmerId });
      return [];
    }
  }

  /**
   * Execute harvest operations in parallel batches
   */
  private async executeHarvestBatch(candidates: HarvestCandidate[]): Promise<HarvestBatchResult> {
    const batchStartTime = Date.now();
    const results: HarvestResult[] = [];

    logger.info(`🚀 Starting harvest batch execution ${JSON.stringify({
      candidate_count: candidates.length,
      max_parallel: this.MAX_PARALLEL_HARVESTS
    })}`);

    // Process candidates in parallel batches
    for (let i = 0; i < candidates.length; i += this.MAX_PARALLEL_HARVESTS) {
      const batch = candidates.slice(i, i + this.MAX_PARALLEL_HARVESTS);
      
      logger.debug(`Processing harvest batch ${Math.floor(i / this.MAX_PARALLEL_HARVESTS) + 1} ${JSON.stringify({
        batch_size: batch.length,
        batch_farmer_ids: batch.map(c => c.farmerId.substring(0, 8) + '...')
      })}`);

      const batchPromises = batch.map(candidate => this.executeHarvestForFarmer(candidate));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process settled promises
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const candidate = batch[index];
          logger.error('Harvest promise rejected', result.reason as Error, {
            farmer_id: candidate.farmerId,
            block_index: candidate.blockIndex
          });
          
          results.push({
            farmerId: candidate.farmerId,
            blockIndex: candidate.blockIndex,
            success: false,
            error: `Promise rejection: ${result.reason?.message || 'Unknown error'}`,
            processingTimeMs: 0
          });
        }
      });

      // Small delay between batches to avoid overwhelming the system
      if (i + this.MAX_PARALLEL_HARVESTS < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate totals
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalRewards = successful.reduce((sum, result) => {
      return sum + BigInt(result.reward || '0');
    }, 0n);

    return {
      processedCount: results.length,
      successfulHarvests: successful,
      failedHarvests: failed,
      totalRewards,
      batchDurationMs: Date.now() - batchStartTime
    };
  }

  /**
   * Execute harvest for a single farmer
   */
  private async executeHarvestForFarmer(candidate: HarvestCandidate): Promise<HarvestResult> {
    const startTime = Date.now();

    try {
      logger.debug(`🌾 Executing harvest for farmer ${JSON.stringify({
        farmer_id: candidate.farmerId.substring(0, 8) + '...',
        block_index: candidate.blockIndex
      })}`);

      // Execute harvest via LaunchtubeService
      const harvestResult = await this.launchtubeService.harvest({
        farmerPublicKey: candidate.farmerPublicKey,
        farmerSecretKey: candidate.farmerSecretKey,
        blockIndex: candidate.blockIndex
      });

      const processingTimeMs = Date.now() - startTime;

      if (harvestResult.success) {
        // Extract reward from transaction result if available
        const reward = harvestResult.details?.reward || '0';
        
        logger.debug(`✅ Harvest successful ${JSON.stringify({
          farmer_id: candidate.farmerId.substring(0, 8) + '...',
          block_index: candidate.blockIndex,
          transaction_hash: harvestResult.transactionHash,
          reward: reward.toString(),
          processing_time_ms: processingTimeMs
        })}`);

        return {
          farmerId: candidate.farmerId,
          blockIndex: candidate.blockIndex,
          success: true,
          transactionHash: harvestResult.transactionHash,
          reward: reward.toString(),
          processingTimeMs
        };

      } else {
        logger.warn(`❌ Harvest failed ${JSON.stringify({
          farmer_id: candidate.farmerId.substring(0, 8) + '...',
          block_index: candidate.blockIndex,
          error: harvestResult.error,
          processing_time_ms: processingTimeMs
        })}`);

        return {
          farmerId: candidate.farmerId,
          blockIndex: candidate.blockIndex,
          success: false,
          error: harvestResult.error,
          processingTimeMs
        };
      }

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      
      logger.error('Exception during farmer harvest', error as Error, {
        farmer_id: candidate.farmerId,
        block_index: candidate.blockIndex,
        processing_time_ms: processingTimeMs
      });

      return {
        farmerId: candidate.farmerId,
        blockIndex: candidate.blockIndex,
        success: false,
        error: (error as Error).message,
        processingTimeMs
      };
    }
  }

  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      running: this.isRunning,
      check_interval_ms: this.CHECK_INTERVAL_MS,
      max_parallel_harvests: this.MAX_PARALLEL_HARVESTS,
      default_harvest_delay: this.DEFAULT_HARVEST_DELAY,
      uptime_ms: this.isRunning ? Date.now() : 0
    };
  }

  /**
   * Force an immediate harvest cycle (for testing/manual trigger)
   */
  async triggerImmediateHarvest(): Promise<HarvestBatchResult> {
    logger.info('🔥 Manual harvest cycle triggered');
    
    const candidates = await this.findHarvestCandidates();
    if (candidates.length === 0) {
      return {
        processedCount: 0,
        successfulHarvests: [],
        failedHarvests: [],
        totalRewards: 0n,
        batchDurationMs: 0
      };
    }

    return await this.executeHarvestBatch(candidates);
  }
}

// Export singleton instance
export const automatedHarvestService = new AutomatedHarvestService();