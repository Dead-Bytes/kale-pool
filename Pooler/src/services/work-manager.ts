// Work Manager Service for KALE Pool Mining Pooler
// Phase 3: Coordinates work execution on behalf of planted farmers

import { Keypair } from '@stellar/stellar-sdk';
import { spawn, type Subprocess } from 'bun';
import Config from '../../../Shared/config';
import { blockMonitorLogger as logger } from '../../../Shared/utils/logger';
import { WorkSubmissionService, type WorkSubmissionRequest, type WorkSubmissionResult } from './work-submission-service';
import { formatISTTime, getISTDate } from '../../../Shared/utils/timing';

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
  private readonly WORK_DELAY_SECONDS = 150; // Wait time after planting (testing)
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly WORK_TIMEOUT_MS = 300000; // 5 minutes per work attempt
  private readonly NONCE_COUNT = 10000000; // Default nonce count

  private workState: WorkState = {
    isWorking: false,
    startTime: 0,
    attempts: 0
  };

  private workSubmissionService: WorkSubmissionService;

  constructor() {
    this.workSubmissionService = new WorkSubmissionService();
    
    logger.info(`WorkManager initialized ${JSON.stringify({
      work_delay_seconds: this.WORK_DELAY_SECONDS,
      max_recovery_attempts: this.MAX_RECOVERY_ATTEMPTS,
      work_timeout_ms: this.WORK_TIMEOUT_MS
    })}`);
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
      const targetTimeMs = blockTimeMs + this.WORK_DELAY_SECONDS * 1000;
      const waitTimeMs = Math.max(0, targetTimeMs - currentTimeMs);

      const currentTimeIST = formatISTTime(new Date(currentTimeMs));
      const targetTimeIST = formatISTTime(new Date(targetTimeMs));
      const harvestTimeMs = targetTimeMs + 30000; // 30 seconds after work completion
      const harvestTimeIST = formatISTTime(new Date(harvestTimeMs));
      
      logger.info(`⏰ Work scheduled for planted farmers (IST timing) ${JSON.stringify({
        block_index: blockIndex,
        farmer_count: workRequests.length,
        current_time_ist: currentTimeIST,
        work_starts_at_ist: targetTimeIST,
        harvest_eligible_at_ist: harvestTimeIST,
        wait_time_minutes: Math.round(waitTimeMs / 60000 * 10) / 10,
        work_delay_seconds: this.WORK_DELAY_SECONDS
      })}`);

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

    logger.info(`Starting work batch execution ${JSON.stringify({
      block_index: blockIndex,
      farmer_count: workRequests.length,
      entropy: entropy.substring(0, 16) + '...'
    })}`);

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

    logger.info(`Work batch execution completed ${JSON.stringify({
      block_index: blockIndex,
      total_farmers: workRequests.length,
      successful_work: successCount,
      failed_work: workRequests.length - successCount,
      total_time_ms: totalWorkTime
    })}`);

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

    logger.debug(`Starting work for farmer ${JSON.stringify({
      farmer_id: workRequest.farmerId,
      custodial_wallet: workRequest.custodialWallet,
      block_index: blockIndex
    })}`);

    try {
      // Get farmer's public key from custodial wallet
      const farmerKeypair = Keypair.fromSecret(workRequest.custodialSecretKey);
      const farmerHex = farmerKeypair.rawPublicKey().toString('hex');

      // Validate blockIndex before using it
      if (blockIndex == null || blockIndex === undefined || isNaN(blockIndex)) {
        throw new Error(`Invalid blockIndex: ${blockIndex}. Must be a valid number.`);
      }

      // Debug: Log parameters being passed to kale-farmer
      const args = [
        '/Users/deadbytes/Documents/Kale-pool/ext/kale-farmer/release/kale-farmer',
        '--farmer-hex', farmerHex,
        '--index', blockIndex.toString(),
        '--entropy-hex', entropy,
        '--nonce-count', this.NONCE_COUNT.toString()
      ];
      
      logger.debug(`Spawning kale-farmer with args ${JSON.stringify({
        farmer_id: workRequest.farmerId,
        args: args,
        farmer_hex_length: farmerHex.length,
        entropy_length: entropy.length
      })}`);

      // Spawn the work process
      this.workState.workerProcess = spawn(args, { 
        stdout: 'pipe',
        stderr: 'pipe'
      });

      if (!this.workState.workerProcess) {
        throw new Error('Failed to spawn work process');
      }

      // Read both stdout and stderr for debugging
      const workOutput = await Promise.race([
        this.readWorkStream(this.workState.workerProcess.stdout, this.workState.workerProcess.stderr, workRequest.farmerId),
        this.createTimeout(this.WORK_TIMEOUT_MS)
      ]);

      if (!workOutput) {
        // Try to get stderr output for debugging
        let stderrOutput = '';
        try {
          if (this.workState.workerProcess.stderr) {
            stderrOutput = await Bun.readableStreamToText(this.workState.workerProcess.stderr);
          }
        } catch (e) {
          // Ignore stderr read errors
        }
        throw new Error(`Work process timed out or produced no output. stderr: ${stderrOutput}`);
      }

      const workTime = Date.now() - startTime;

      logger.info(`Work completed successfully for farmer ${JSON.stringify({
        farmer_id: workRequest.farmerId,
        nonce: workOutput.nonce,
        zeros: workOutput.zeros,
        work_time_ms: workTime
      })}`);

      // CRITICAL: Submit work to smart contract (following reference pattern)
      logger.info(`Submitting work to smart contract ${JSON.stringify({
        farmer_id: workRequest.farmerId,
        farmer_public_key: workRequest.custodialWallet,
        nonce: workOutput.nonce,
        hash: workOutput.hash.substring(0, 16) + '...'
      })}`);

      try {
        const workSubmissionResult = await this.workSubmissionService.submitWork({
          farmerPublicKey: workRequest.custodialWallet,
          hash: new Uint8Array(Buffer.from(workOutput.hash, 'hex')),
          nonce: BigInt(workOutput.nonce)
        });

        if (!workSubmissionResult.success) {
          logger.error('Failed to submit work to smart contract', undefined, {
            farmer_id: workRequest.farmerId,
            error: workSubmissionResult.error,
            nonce: workOutput.nonce
          });
          
          // Work is FAILED if smart contract submission fails
          // Mining success alone is not enough - work must be on-chain to be harvestable
          return {
            farmerId: workRequest.farmerId,
            custodialWallet: workRequest.custodialWallet,
            status: 'failed',  // Fixed: work failed if not submitted to contract
            nonce: workOutput.nonce,
            hash: workOutput.hash,
            zeros: workOutput.zeros,
            gap: workOutput.gap,
            workTime,
            attempts: 1,
            compensationRequired: true, // Smart contract submission failed
            error: `Smart contract submission failed: ${workSubmissionResult.error}`
          };
        }

        const completionTimeIST = formatISTTime();
        const harvestEligibleTime = new Date(Date.now() + 30000); // 30 seconds from now
        const harvestEligibleTimeIST = formatISTTime(harvestEligibleTime);
        
        logger.info(`✅ Work successfully completed and submitted to smart contract ${JSON.stringify({
          farmer_id: workRequest.farmerId,
          transaction_hash: workSubmissionResult.transactionHash,
          nonce: workOutput.nonce,
          zeros: workOutput.zeros,
          completed_at_ist: completionTimeIST,
          harvest_eligible_at_ist: harvestEligibleTimeIST,
          harvest_eligible_in: '30 seconds'
        })}`);

      } catch (error) {
        logger.error('Exception during smart contract work submission', error as Error, {
          farmer_id: workRequest.farmerId,
          nonce: workOutput.nonce
        });
        
        // Work is FAILED if smart contract submission throws exception
        return {
          farmerId: workRequest.farmerId,
          custodialWallet: workRequest.custodialWallet,
          status: 'failed',  // Fixed: work failed if smart contract submission throws
          nonce: workOutput.nonce,
          hash: workOutput.hash,
          zeros: workOutput.zeros,
          gap: workOutput.gap,
          workTime,
          attempts: 1,
          compensationRequired: true, // Smart contract submission failed
          error: `Smart contract submission exception: ${(error as Error).message}`
        };
      }

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
      
      logger.warn(`Work failed for farmer ${JSON.stringify({
        farmer_id: workRequest.farmerId,
        work_time_ms: workTime,
        attempts: this.workState.attempts,
        error: (error as Error).message
      })}`);

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
    logger.info(`Attempting work recovery ${JSON.stringify({
      farmer_id: workRequest.farmerId,
      block_index: blockIndex
    })}`);

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
          logger.info(`Work recovery successful ${JSON.stringify({
            farmer_id: workRequest.farmerId,
            recovery_attempt: attempt,
            nonce: recoveryResult.nonce
          })}`);

          return {
            ...recoveryResult,
            status: 'recovered'
          };
        }

      } catch (error) {
        logger.warn(`Recovery attempt ${attempt} failed ${JSON.stringify({
          farmer_id: workRequest.farmerId,
          error: (error as Error).message
        })}`);
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
      '--nonce-count', nonceCount.toString()
    ], { 
      stdout: 'pipe',
      stderr: 'pipe'
    });

    try {
      const workOutput = await Promise.race([
        this.readWorkStream(workerProcess.stdout, workerProcess.stderr, workRequest.farmerId),
        this.createTimeout(this.WORK_TIMEOUT_MS)
      ]);

      if (!workOutput) {
        throw new Error('Work process timed out');
      }

      const workTime = Date.now() - startTime;

      // Submit recovery work to smart contract (following reference pattern)
      logger.info(`Submitting recovery work to smart contract ${JSON.stringify({
        farmer_id: workRequest.farmerId,
        attempt: attemptNumber,
        nonce: workOutput.nonce
      })}`);

      try {
        const workSubmissionResult = await this.workSubmissionService.submitWork({
          farmerPublicKey: workRequest.custodialWallet,
          hash: new Uint8Array(Buffer.from(workOutput.hash, 'hex')),
          nonce: BigInt(workOutput.nonce)
        });

        if (!workSubmissionResult.success) {
          logger.error('Failed to submit recovery work to smart contract', undefined, {
            farmer_id: workRequest.farmerId,
            attempt: attemptNumber,
            error: workSubmissionResult.error
          });
          
          return {
            farmerId: workRequest.farmerId,
            custodialWallet: workRequest.custodialWallet,
            status: 'failed',  // Fixed: recovery work failed if not submitted to contract
            nonce: workOutput.nonce,
            hash: workOutput.hash,
            zeros: workOutput.zeros,
            gap: workOutput.gap,
            workTime,
            attempts: attemptNumber,
            compensationRequired: true,
            error: `Recovery work smart contract submission failed: ${workSubmissionResult.error}`
          };
        }

        logger.info(`Recovery work successfully submitted to smart contract ${JSON.stringify({
          farmer_id: workRequest.farmerId,
          attempt: attemptNumber,
          transaction_hash: workSubmissionResult.transactionHash
        })}`);

      } catch (error) {
        logger.error('Exception during recovery work smart contract submission', error as Error, {
          farmer_id: workRequest.farmerId,
          attempt: attemptNumber
        });
        
        return {
          farmerId: workRequest.farmerId,
          custodialWallet: workRequest.custodialWallet,
          status: 'failed',  // Fixed: recovery work failed if smart contract submission throws
          nonce: workOutput.nonce,
          hash: workOutput.hash,
          zeros: workOutput.zeros,
          gap: workOutput.gap,
          workTime,
          attempts: attemptNumber,
          compensationRequired: true,
          error: `Recovery work smart contract submission exception: ${(error as Error).message}`
        };
      }

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
  private async readWorkStream(
    stdout: ReadableStream<Uint8Array>, 
    stderr?: ReadableStream<Uint8Array>,
    farmerId?: string
  ): Promise<{
    nonce: number;
    hash: string;
    zeros: number;
    gap: number;
  } | null> {
    try {
      const output = await Bun.readableStreamToText(stdout);
      
      // Also read stderr for debugging
      let stderrOutput = '';
      if (stderr) {
        try {
          stderrOutput = await Bun.readableStreamToText(stderr);
        } catch (e) {
          // Ignore stderr errors
        }
      }
      
      logger.debug(`Work process output ${JSON.stringify({
        farmer_id: farmerId,
        stdout_length: output?.length || 0,
        stderr_length: stderrOutput.length,
        stdout_preview: output?.substring(0, 200),
        stderr_preview: stderrOutput.substring(0, 200)
      })}`);
      
      if (!output || output.trim().length === 0) {
        logger.warn(`Work process produced no stdout output ${JSON.stringify({
          farmer_id: farmerId,
          stderr_output: stderrOutput
        })}`);
        return null;
      }

      // Parse the last line which should contain the JSON result
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      if (!lastLine || lastLine.trim().length === 0) {
        logger.warn(`Work process stdout has no final line ${JSON.stringify({
          farmer_id: farmerId,
          lines_count: lines.length,
          stderr_output: stderrOutput
        })}`);
        return null;
      }
      
      logger.debug(`Parsing work result line ${JSON.stringify({
        farmer_id: farmerId,
        last_line: lastLine
      })}`);
      
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
      logger.error('Failed to parse work stream output', error as Error, {
        farmer_id: farmerId
      });
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
    // If timestamp is already in milliseconds (13 digits), return as is
    // If timestamp is in seconds (10 digits), multiply by 1000
    if (timestamp > 10000000000) { // More than 10 billion = milliseconds
      return timestamp;
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
