// Work Manager Service for KALE Pool Mining Pooler
// Phase 3: Coordinates work execution on behalf of planted farmers

import { Keypair } from '@stellar/stellar-sdk';
import { spawn, type Subprocess } from 'bun';
import type { Buffer } from 'buffer';
import Config from '../../../Shared/config';
import { blockMonitorLogger as logger } from '../../../Shared/utils/logger';

// Work execution interfaces
export interface WorkRequest {
  farmerId: string;
  custodialWallet: string;
  custodialSecretKey: string;
  blockIndex: number;
  entropy: string;
  stakeAmount: string;
}

export interface WorkResult {
  farmerId: string;
  custodialWallet: string;
  status: 'success' | 'failed' | 'recovered';
  nonce?: number;
  hash?: string;
  zeros?: number;
  gap?: number;
  workTime: number; // milliseconds
  attempts: number;
  error?: string;
  compensationRequired: boolean;
}

export interface WorkBatchResult {
  blockIndex: number;
  poolerId: string;
  workResults: WorkResult[];
  totalWorkTime: number;
  timestamp: string;
}

// Work process state
interface WorkState {
  workerProcess?: Subprocess<"ignore", "pipe", "pipe">;
  isWorking: boolean;
  currentFarmerId?: string;
  startTime: number;
  attempts: number;
}

export class WorkManager {
  private readonly WORK_DELAY_MINUTES = 4; // Wait time after planting
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly WORK_TIMEOUT_MS = 120000; // 2 minutes per work attempt
  private readonly NONCE_COUNT = 10000000; // Default nonce count

  private workState: WorkState = {
    isWorking: false,
    startTime: 0,
    attempts: 0
  };

  constructor() {
    logger.info('WorkManager initialized', {
      work_delay_minutes: this.WORK_DELAY_MINUTES,
      max_recovery_attempts: this.MAX_RECOVERY_ATTEMPTS,
      work_timeout_ms: this.WORK_TIMEOUT_MS
    });
  }

  /**
   * Schedule work execution after the required delay
   */
  scheduleWork(
    blockTimestamp: number | bigint,
    blockIndex: number,
    entropy: string,
    workRequests: WorkRequest[]
  ): Promise<WorkBatchResult> {
    return new Promise((resolve, reject) => {
      const blockTimeMs = this.blockTimestampToMs(blockTimestamp);
      const currentTimeMs = Date.now();
      const targetTimeMs = blockTimeMs + this.WORK_DELAY_MINUTES * 60 * 1000;
      const waitTimeMs = Math.max(0, targetTimeMs - currentTimeMs);

      logger.info('Work scheduled for planted farmers', {
        block_index: blockIndex,
        farmer_count: workRequests.length,
        current_time: new Date(currentTimeMs).toISOString(),
        target_time: new Date(targetTimeMs).toISOString(),
        wait_time_ms: waitTimeMs
      });

      setTimeout(async () => {
        try {
          const result = await this.executeWorkBatch(blockIndex, entropy, workRequests);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, waitTimeMs);
    });
  }

  /**
   * Execute work for all planted farmers in sequence
   */
  private async executeWorkBatch(
    blockIndex: number,
    entropy: string,
    workRequests: WorkRequest[]
  ): Promise<WorkBatchResult> {
    const batchStartTime = Date.now();
    const workResults: WorkResult[] = [];

    logger.info('Starting work batch execution', {
      block_index: blockIndex,
      farmer_count: workRequests.length,
      entropy: entropy.substring(0, 16) + '...'
    });

    // Execute work sequentially for each farmer
    for (const workRequest of workRequests) {
      const result = await this.executeWorkForFarmer(blockIndex, entropy, workRequest);
      workResults.push(result);

      // If work failed, attempt recovery
      if (result.status === 'failed' && !result.compensationRequired) {
        const recoveryResult = await this.attemptRecovery(blockIndex, entropy, workRequest);
        if (recoveryResult) {
          // Replace failed result with recovery result
          workResults[workResults.length - 1] = recoveryResult;
        }
      }
    }

    const totalWorkTime = Date.now() - batchStartTime;
    const successCount = workResults.filter(r => r.status === 'success' || r.status === 'recovered').length;

    logger.info('Work batch execution completed', {
      block_index: blockIndex,
      total_farmers: workRequests.length,
      successful_work: successCount,
      failed_work: workRequests.length - successCount,
      total_time_ms: totalWorkTime
    });

    return {
      blockIndex,
      poolerId: Config.POOLER.ID,
      workResults,
      totalWorkTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute work for a single farmer
   */
  private async executeWorkForFarmer(
    blockIndex: number,
    entropy: string,
    workRequest: WorkRequest
  ): Promise<WorkResult> {
    const startTime = Date.now();
    
    this.workState = {
      isWorking: true,
      currentFarmerId: workRequest.farmerId,
      startTime,
      attempts: 1
    };

    logger.debug('Starting work for farmer', {
      farmer_id: workRequest.farmerId,
      custodial_wallet: workRequest.custodialWallet,
      block_index: blockIndex
    });

    try {
      // Get farmer's public key from custodial wallet
      const farmerKeypair = Keypair.fromSecret(workRequest.custodialSecretKey);
      const farmerHex = farmerKeypair.rawPublicKey().toString('hex');

      // Spawn the work process
      this.workState.workerProcess = spawn([
        '/Users/deadbytes/Documents/Kale-pool/ext/kale-farmer/release/kale-farmer',
        '--farmer-hex', farmerHex,
        '--index', blockIndex.toString(),
        '--entropy-hex', entropy,
        '--nonce-count', '5' // Target zeros
      ], { 
        stdout: 'pipe',
        stderr: 'pipe'
      });

      if (!this.workState.workerProcess) {
        throw new Error('Failed to spawn work process');
      }

      // Read the work result with timeout
      const workOutput = await Promise.race([
        this.readWorkStream(this.workState.workerProcess.stdout),
        this.createTimeout(this.WORK_TIMEOUT_MS)
      ]);

      if (!workOutput) {
        throw new Error('Work process timed out or produced no output');
      }

      const workTime = Date.now() - startTime;

      logger.info('Work completed successfully for farmer', {
        farmer_id: workRequest.farmerId,
        nonce: workOutput.nonce,
        zeros: workOutput.zeros,
        work_time_ms: workTime
      });

      return {
        farmerId: workRequest.farmerId,
        custodialWallet: workRequest.custodialWallet,
        status: 'success',
        nonce: workOutput.nonce,
        hash: workOutput.hash,
        zeros: workOutput.zeros,
        gap: workOutput.gap,
        workTime,
        attempts: 1,
        compensationRequired: false
      };

    } catch (error) {
      const workTime = Date.now() - startTime;
      
      logger.warn('Work failed for farmer', {
        farmer_id: workRequest.farmerId,
        work_time_ms: workTime,
        attempts: this.workState.attempts,
        error: (error as Error).message
      });

      return {
        farmerId: workRequest.farmerId,
        custodialWallet: workRequest.custodialWallet,
        status: 'failed',
        workTime,
        attempts: this.workState.attempts,
        error: (error as Error).message,
        compensationRequired: true
      };

    } finally {
      // Clean up work process
      if (this.workState.workerProcess) {
        this.workState.workerProcess.kill();
        this.workState.workerProcess = undefined;
      }
      this.workState.isWorking = false;
    }
  }

  /**
   * Attempt recovery for failed work
   */
  private async attemptRecovery(
    blockIndex: number,
    entropy: string,
    workRequest: WorkRequest
  ): Promise<WorkResult | null> {
    logger.info('Attempting work recovery', {
      farmer_id: workRequest.farmerId,
      block_index: blockIndex
    });

    for (let attempt = 1; attempt <= this.MAX_RECOVERY_ATTEMPTS; attempt++) {
      try {
        // Use different nonce count for recovery attempts
        const recoveryNonceCount = this.NONCE_COUNT + (attempt * 1000000);
        
        const recoveryResult = await this.executeWorkWithParams(
          blockIndex,
          entropy,
          workRequest,
          recoveryNonceCount,
          attempt + 1
        );

        if (recoveryResult.status === 'success') {
          logger.info('Work recovery successful', {
            farmer_id: workRequest.farmerId,
            recovery_attempt: attempt,
            nonce: recoveryResult.nonce
          });

          return {
            ...recoveryResult,
            status: 'recovered'
          };
        }

      } catch (error) {
        logger.warn(`Recovery attempt ${attempt} failed`, {
          farmer_id: workRequest.farmerId,
          error: (error as Error).message
        });
      }
    }

    logger.error('All recovery attempts exhausted', undefined, {
      farmer_id: workRequest.farmerId,
      max_attempts: this.MAX_RECOVERY_ATTEMPTS
    });

    return null;
  }

  /**
   * Execute work with specific parameters
   */
  private async executeWorkWithParams(
    blockIndex: number,
    entropy: string,
    workRequest: WorkRequest,
    nonceCount: number,
    attemptNumber: number
  ): Promise<WorkResult> {
    const startTime = Date.now();
    
    const farmerKeypair = Keypair.fromSecret(workRequest.custodialSecretKey);
    const farmerHex = farmerKeypair.rawPublicKey().toString('hex');

    const workerProcess = spawn([
      '/Users/deadbytes/Documents/Kale-pool/ext/kale-farmer/release/kale-farmer',
      '--farmer-hex', farmerHex,
      '--index', blockIndex.toString(),
      '--entropy-hex', entropy,
      '--nonce-count', '5' // Target zeros
    ], { 
      stdout: 'pipe',
      stderr: 'pipe'
    });

    try {
      const workOutput = await Promise.race([
        this.readWorkStream(workerProcess.stdout),
        this.createTimeout(this.WORK_TIMEOUT_MS)
      ]);

      if (!workOutput) {
        throw new Error('Work process timed out');
      }

      const workTime = Date.now() - startTime;

      return {
        farmerId: workRequest.farmerId,
        custodialWallet: workRequest.custodialWallet,
        status: 'success',
        nonce: workOutput.nonce,
        hash: workOutput.hash,
        zeros: workOutput.zeros,
        gap: workOutput.gap,
        workTime,
        attempts: attemptNumber,
        compensationRequired: false
      };

    } finally {
      workerProcess.kill();
    }
  }

  /**
   * Read and parse work stream output
   */
  private async readWorkStream(stream: ReadableStream<Uint8Array>): Promise<{
    nonce: number;
    hash: string;
    zeros: number;
    gap: number;
  } | null> {
    try {
      const output = await Bun.readableStreamToText(stream);
      
      if (!output) {
        return null;
      }

      // Parse the last line which should contain the JSON result
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      if (!lastLine) {
        return null;
      }
      
      const [nonce, hash] = JSON.parse(lastLine);
      
      // Count leading zeros
      let zeros = 0;
      for (const char of hash) {
        if (char === '0') {
          zeros++;
        } else {
          break;
        }
      }

      // Calculate gap (this would need actual gap calculation logic)
      const gap = this.calculateGap(hash); // Placeholder

      return {
        nonce: parseInt(nonce),
        hash,
        zeros,
        gap
      };

    } catch (error) {
      logger.error('Failed to parse work stream output', error as Error);
      return null;
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<null> {
    return new Promise(resolve => {
      setTimeout(() => resolve(null), ms);
    });
  }

  /**
   * Convert block timestamp to milliseconds
   */
  private blockTimestampToMs(timestamp: number | bigint): number {
    if (typeof timestamp === 'bigint') {
      return Number(timestamp) * 1000;
    }
    return timestamp * 1000;
  }

  /**
   * Calculate gap (placeholder - needs actual implementation)
   */
  private calculateGap(hash: string): number {
    // This would need the actual gap calculation logic from the KALE contract
    // For now, return a placeholder value
    return 15;
  }

  /**
   * Get current work status
   */
  getWorkStatus() {
    return {
      isWorking: this.workState.isWorking,
      currentFarmerId: this.workState.currentFarmerId,
      currentWorkTime: this.workState.isWorking ? Date.now() - this.workState.startTime : 0,
      attempts: this.workState.attempts
    };
  }

  /**
   * Stop current work process
   */
  stopWork(): void {
    if (this.workState.workerProcess) {
      this.workState.workerProcess.kill();
      this.workState.workerProcess = undefined;
    }
    this.workState.isWorking = false;
    
    logger.info('Work process stopped');
  }
}

// Export singleton instance
export const workManager = new WorkManager();
