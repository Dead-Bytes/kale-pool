// Work service for KALE Pool Mining Backend
// Phase 1: Coordinated work operations and nonce validation

import { stellarWalletManager } from './wallet-manager';
import { farmerQueries, workQueries, poolerQueries } from './database';
import { isValidNonce } from '../../../Shared/utils/helpers';
import type { FarmerRow } from './database';

// Logger implementation
class WorkLogger {
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
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${new Date().toISOString()}] DEBUG [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
    }
  }
}

const logger = new WorkLogger('WorkService');

// Work operation interfaces
export interface WorkAttempt {
  farmerId: string;
  custodialWallet: string;
  nonce: string;
  isValidNonce: boolean;
  status: 'success' | 'failed';
  transactionHash?: string;
  error?: string;
  workReward?: string;
}

export interface WorkSubmission {
  farmerId: string;
  nonce: string;
  blockIndex: number;
  timestamp: number;
}

export interface WorkServiceResult {
  blockIndex: number;
  poolerId: string;
  totalSubmissions: number;
  validNonces: WorkAttempt[];
  invalidNonces: WorkAttempt[];
  submittedWork: WorkAttempt[];
  totalRewards: string;
  processingTimeMs: number;
}

// ======================
// WORK SERVICE
// ======================

export class WorkService {
  private readonly MAX_BATCH_SIZE = 50;
  private readonly PARALLEL_LIMIT = 10;
  private readonly NONCE_VALIDATION_TIMEOUT = 5000; // 5 seconds

  // ======================
  // MAIN WORK COORDINATION
  // ======================

  async processWorkSubmissions(
    blockIndex: number,
    poolerId: string,
    submissions: WorkSubmission[]
  ): Promise<WorkServiceResult> {
    const startTime = Date.now();

    logger.info('Starting work submissions processing', {
      block_index: blockIndex,
      pooler_id: poolerId,
      submission_count: submissions.length
    });

    try {
      // Update pooler last seen
      await poolerQueries.updatePoolerLastSeen(poolerId);

      if (submissions.length === 0) {
        logger.warn('No work submissions received', {
          pooler_id: poolerId,
          block_index: blockIndex
        });

        return {
          blockIndex,
          poolerId,
          totalSubmissions: 0,
          validNonces: [],
          invalidNonces: [],
          submittedWork: [],
          totalRewards: '0',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Validate nonces and process work
      const workResults = await this.executeWorkBatch(blockIndex, poolerId, submissions);

      // Separate valid and invalid nonces
      const validNonces = workResults.filter(result => result.isValidNonce);
      const invalidNonces = workResults.filter(result => !result.isValidNonce);
      const submittedWork = workResults.filter(result => result.status === 'success');

      // Calculate total rewards
      const totalRewards = submittedWork.reduce((sum, result) => {
        return (BigInt(sum) + BigInt(result.workReward || '0')).toString();
      }, '0');

      const result: WorkServiceResult = {
        blockIndex,
        poolerId,
        totalSubmissions: submissions.length,
        validNonces,
        invalidNonces,
        submittedWork,
        totalRewards,
        processingTimeMs: Date.now() - startTime
      };

      logger.info('Work submissions processing completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        total_submissions: result.totalSubmissions,
        valid_nonces: validNonces.length,
        invalid_nonces: invalidNonces.length,
        submitted_work: submittedWork.length,
        total_rewards: totalRewards,
        processing_time_ms: result.processingTimeMs
      });

      return result;

    } catch (error) {
      logger.error('Work submissions processing failed', error as Error, {
        block_index: blockIndex,
        pooler_id: poolerId,
        processing_time_ms: Date.now() - startTime
      });

      throw new Error(`Work processing failed: ${(error as Error).message}`);
    }
  }

  // ======================
  // WORK EXECUTION
  // ======================

  private async executeWorkBatch(
    blockIndex: number,
    poolerId: string,
    submissions: WorkSubmission[]
  ): Promise<WorkAttempt[]> {
    logger.info('Starting work batch execution', {
      block_index: blockIndex,
      pooler_id: poolerId,
      submission_count: submissions.length
    });

    const results: WorkAttempt[] = [];

    // Process submissions in parallel batches
    for (let i = 0; i < submissions.length; i += this.PARALLEL_LIMIT) {
      const batch = submissions.slice(i, i + this.PARALLEL_LIMIT);
      
      const batchPromises = batch.map(submission => 
        this.processSingleWorkSubmission(blockIndex, poolerId, submission)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process settled promises
      batchResults.forEach((result, index) => {
        const submission = batch[index];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Work submission promise failed', result.reason, {
            farmer_id: submission.farmerId,
            block_index: blockIndex,
            nonce: submission.nonce
          });
          
          results.push({
            farmerId: submission.farmerId,
            custodialWallet: 'unknown',
            nonce: submission.nonce,
            isValidNonce: false,
            status: 'failed',
            error: result.reason?.message || 'Promise rejection'
          });
        }
      });
    }

    return results;
  }

  private async processSingleWorkSubmission(
    blockIndex: number,
    poolerId: string,
    submission: WorkSubmission
  ): Promise<WorkAttempt> {
    const workStartTime = Date.now();

    try {
      logger.debug('Processing work submission', {
        farmer_id: submission.farmerId,
        nonce: submission.nonce,
        block_index: blockIndex
      });

      // Get farmer information
      const farmer = await farmerQueries.getFarmerById(submission.farmerId);
      if (!farmer) {
        throw new Error(`Farmer not found: ${submission.farmerId}`);
      }

      // Validate nonce
      const nonceNum = parseInt(submission.nonce);
      const nonceValid = isValidNonce(nonceNum);

      if (!nonceValid) {
        // Record invalid nonce in database
        await workQueries.recordWork(
          blockIndex,
          submission.farmerId,
          poolerId,
          farmer.custodial_public_key,
          submission.nonce,
          'invalid_nonce',
          'failed',
          '0',
          'Invalid nonce',
          submission.timestamp
        );

        logger.debug('Invalid nonce submitted', {
          farmer_id: submission.farmerId,
          nonce: submission.nonce,
          block_index: blockIndex,
          duration_ms: Date.now() - workStartTime
        });

        return {
          farmerId: submission.farmerId,
          custodialWallet: farmer.custodial_public_key,
          nonce: submission.nonce,
          isValidNonce: false,
          status: 'failed',
          error: 'Invalid nonce'
        };
      }

      // Calculate work reward
      const workReward = this.calculateWorkReward(farmer);

      // Execute work transaction
      const workResult = await stellarWalletManager.workForFarmer(
        farmer.custodial_secret_key,
        submission.nonce
      );

      if (workResult.success && workResult.transactionHash) {
        // Record successful work in database
        await workQueries.recordWork(
          blockIndex,
          submission.farmerId,
          poolerId,
          farmer.custodial_public_key,
          submission.nonce,
          workResult.transactionHash,
          'success',
          workReward
        );

        logger.debug('Work submission successful', {
          farmer_id: submission.farmerId,
          transaction_hash: workResult.transactionHash,
          nonce: submission.nonce,
          work_reward: workReward,
          duration_ms: Date.now() - workStartTime
        });

        return {
          farmerId: submission.farmerId,
          custodialWallet: farmer.custodial_public_key,
          nonce: submission.nonce,
          isValidNonce: true,
          status: 'success',
          transactionHash: workResult.transactionHash,
          workReward
        };

      } else {
        // Record failed work in database
        await workQueries.recordWork(
          blockIndex,
          submission.farmerId,
          poolerId,
          farmer.custodial_public_key,
          submission.nonce,
          'failed_transaction',
          'failed',
          '0',
          workResult.error
        );

        logger.warn('Work submission failed', {
          farmer_id: submission.farmerId,
          error: workResult.error,
          nonce: submission.nonce,
          duration_ms: Date.now() - workStartTime
        });

        return {
          farmerId: submission.farmerId,
          custodialWallet: farmer.custodial_public_key,
          nonce: submission.nonce,
          isValidNonce: true,
          status: 'failed',
          error: workResult.error
        };
      }

    } catch (error) {
      // Record failed work in database
      try {
        const farmer = await farmerQueries.getFarmerById(submission.farmerId);
        const custodialWallet = farmer?.custodial_public_key || 'unknown';

        await workQueries.recordWork(
          blockIndex,
          submission.farmerId,
          poolerId,
          custodialWallet,
          submission.nonce,
          'error_before_tx',
          'failed',
          '0',
          (error as Error).message
        );
      } catch (dbError) {
        logger.error('Failed to record work failure in database', dbError as Error, {
          farmer_id: submission.farmerId,
          block_index: blockIndex
        });
      }

      logger.error('Work submission exception', error as Error, {
        farmer_id: submission.farmerId,
        nonce: submission.nonce,
        block_index: blockIndex,
        duration_ms: Date.now() - workStartTime
      });

      return {
        farmerId: submission.farmerId,
        custodialWallet: 'unknown',
        nonce: submission.nonce,
        isValidNonce: false,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  // ======================
  // NONCE VALIDATION
  // ======================

  private async validateNonce(nonce: string, blockIndex: number): Promise<boolean> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Nonce validation timeout')), this.NONCE_VALIDATION_TIMEOUT);
      });

      // Create validation promise
      const validationPromise = new Promise<boolean>((resolve) => {
        try {
          const valid = isValidNonce(nonce, blockIndex);
          resolve(valid);
        } catch (error) {
          logger.error('Nonce validation error', error as Error, {
            nonce,
            block_index: blockIndex
          });
          resolve(false);
        }
      });

      // Race between validation and timeout
      const isValid = await Promise.race([validationPromise, timeoutPromise]);

      logger.debug('Nonce validation completed', {
        nonce,
        block_index: blockIndex,
        is_valid: isValid
      });

      return isValid;

    } catch (error) {
      logger.error('Nonce validation failed', error as Error, {
        nonce,
        block_index: blockIndex
      });
      return false;
    }
  }

  // ======================
  // REWARD CALCULATION
  // ======================

  private calculateWorkReward(farmer: FarmerRow): string {
    try {
      // Base work reward (could be dynamic based on network conditions)
      const baseReward = BigInt('1000000000'); // 1000 KALE (9 decimals)
      
      // Apply multipliers based on farmer status or pool bonuses
      let multiplier = 1000; // 1.0 in thousandths
      
      // Bonus for active farmers
      if (farmer.status === 'active') {
        multiplier += 50; // +5% bonus
      }
      
      // Calculate final reward
      const finalReward = (baseReward * BigInt(multiplier)) / BigInt(1000);

      logger.debug('Work reward calculation completed', {
        farmer_id: farmer.id,
        base_reward: baseReward.toString(),
        multiplier: multiplier,
        final_reward: finalReward.toString()
      });

      return finalReward.toString();

    } catch (error) {
      logger.error('Work reward calculation failed', error as Error, {
        farmer_id: farmer.id
      });

      // Return minimal reward on calculation error
      return '100000000'; // 100 KALE
    }
  }

  // ======================
  // WORK HISTORY
  // ======================

  async getRecentWorkActivity(poolerId: string, limit: number = 100) {
    try {
      const recentWork = await workQueries.getRecentWorkByPooler(poolerId, limit);
      
      logger.debug('Retrieved recent work activity', {
        pooler_id: poolerId,
        work_count: recentWork.length,
        limit
      });

      return recentWork;

    } catch (error) {
      logger.error('Failed to get recent work activity', error as Error, {
        pooler_id: poolerId
      });
      throw error;
    }
  }

  async getWorkStatistics(poolerId: string, hours: number = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Get work stats from database
      const workStats = await workQueries.getWorkStatistics(poolerId, cutoffTime);
      
      logger.debug('Retrieved work statistics', {
        pooler_id: poolerId,
        hours,
        stats: workStats
      });

      return workStats;

    } catch (error) {
      logger.error('Failed to get work statistics', error as Error, {
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
      logger.error('Work service health check failed', error as Error);
      return false;
    }
  }

  getServiceInfo() {
    return {
      service: 'WorkService',
      max_batch_size: this.MAX_BATCH_SIZE,
      parallel_limit: this.PARALLEL_LIMIT,
      nonce_validation_timeout: this.NONCE_VALIDATION_TIMEOUT,
      network_info: stellarWalletManager.getNetworkInfo()
    };
  }
}

// Export singleton instance
export const workService = new WorkService();
