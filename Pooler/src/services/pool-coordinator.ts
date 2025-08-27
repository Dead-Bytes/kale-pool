// Pool Coordination Service - Integrates block monitoring with work execution
// Phase 3: Coordinates planting notifications and work scheduling

import { workManager, type WorkRequest, type WorkBatchResult } from './work-manager';
import { blockMonitorLogger as logger } from '../../../Shared/utils/logger';
import Config from '../../../Shared/config';

export interface PlantingNotification {
  blockIndex: number;
  entropy: string;
  blockTimestamp: number;
  plantedFarmers: Array<{
    farmerId: string;
    custodialWallet: string;
    custodialSecretKey: string;
    stakeAmount: string;
    plantingTime: Date;
  }>;
}

export interface WorkCompletionNotification {
  blockIndex: number;
  poolerId: string;
  workResults: Array<{
    farmerId: string;
    custodialWallet: string;
    status: 'success' | 'failed' | 'recovered';
    nonce?: number;
    hash?: string;
    zeros?: number;
    gap?: number;
    workTime: number;
    attempts: number;
    error?: string;
    compensationRequired: boolean;
  }>;
  summary: {
    totalFarmers: number;
    successfulWork: number;
    failedWork: number;
    totalWorkTime: number;
    timestamp: string;
  };
}

class PoolCoordinator {
  private pendingWorkBlocks = new Map<number, PlantingNotification>();
  private activeWorkPromises = new Map<number, Promise<WorkBatchResult>>();

  constructor() {
    logger.info('PoolCoordinator initialized');
  }

  /**
   * Receive planting notification from Backend
   */
  async receivePlantingNotification(notification: PlantingNotification): Promise<void> {
    const { blockIndex, entropy, blockTimestamp, plantedFarmers } = notification;

    logger.info('Received planting notification from Backend', {
      block_index: blockIndex,
      farmer_count: plantedFarmers.length,
      entropy: entropy.substring(0, 16) + '...'
    });

    // Validate notification
    if (plantedFarmers.length === 0) {
      logger.warn('No farmers planted for block', { block_index: blockIndex });
      return;
    }

    // Store pending work
    this.pendingWorkBlocks.set(blockIndex, notification);

    // Convert to work requests
    const workRequests: WorkRequest[] = plantedFarmers.map(farmer => ({
      farmerId: farmer.farmerId,
      custodialWallet: farmer.custodialWallet,
      custodialSecretKey: farmer.custodialSecretKey,
      blockIndex,
      entropy,
      stakeAmount: farmer.stakeAmount
    }));

    // Schedule work execution
    const workPromise = workManager.scheduleWork(
      blockTimestamp,
      blockIndex,
      entropy,
      workRequests
    );

    // Store the promise for tracking
    this.activeWorkPromises.set(blockIndex, workPromise);

    // Handle work completion
    workPromise
      .then(async (result) => {
        await this.handleWorkCompletion(blockIndex, result);
        this.activeWorkPromises.delete(blockIndex);
        this.pendingWorkBlocks.delete(blockIndex);
      })
      .catch(async (error) => {
        await this.handleWorkError(blockIndex, error);
        this.activeWorkPromises.delete(blockIndex);
        this.pendingWorkBlocks.delete(blockIndex);
      });

    logger.info('Work scheduled for block', {
      block_index: blockIndex,
      farmer_count: workRequests.length,
      scheduled_farmers: workRequests.map(wr => wr.farmerId)
    });
  }

  /**
   * Handle work completion and notify Backend
   */
  private async handleWorkCompletion(blockIndex: number, result: WorkBatchResult): Promise<void> {
    const successCount = result.workResults.filter(r => r.status === 'success' || r.status === 'recovered').length;
    const failedCount = result.workResults.filter(r => r.status === 'failed').length;

    logger.info('Work batch completed', {
      block_index: blockIndex,
      total_farmers: result.workResults.length,
      successful_work: successCount,
      failed_work: failedCount,
      total_time_ms: result.totalWorkTime
    });

    // Create completion notification
    const notification: WorkCompletionNotification = {
      blockIndex,
      poolerId: result.poolerId,
      workResults: result.workResults,
      summary: {
        totalFarmers: result.workResults.length,
        successfulWork: successCount,
        failedWork: failedCount,
        totalWorkTime: result.totalWorkTime,
        timestamp: result.timestamp
      }
    };

    // Notify Backend about work completion
    await this.notifyBackendWorkCompletion(notification);

    // Log work summary for successful work
    const successfulWork = result.workResults.filter(r => r.status === 'success' || r.status === 'recovered');
    if (successfulWork.length > 0) {
      logger.info('Successful work results', {
        block_index: blockIndex,
        successful_farmers: successfulWork.map(w => ({
          farmer_id: w.farmerId,
          nonce: w.nonce,
          zeros: w.zeros,
          attempts: w.attempts,
          work_time_ms: w.workTime
        }))
      });
    }

    // Log failed work that needs compensation
    const compensationNeeded = result.workResults.filter(r => r.compensationRequired);
    if (compensationNeeded.length > 0) {
      logger.warn('Failed work requiring compensation', {
        block_index: blockIndex,
        compensation_farmers: compensationNeeded.map(w => ({
          farmer_id: w.farmerId,
          error: w.error,
          attempts: w.attempts
        }))
      });
    }
  }

  /**
   * Handle work execution errors
   */
  private async handleWorkError(blockIndex: number, error: any): Promise<void> {
    logger.error('Work execution failed for block', error, {
      block_index: blockIndex
    });

    // Get the pending notification
    const notification = this.pendingWorkBlocks.get(blockIndex);
    if (!notification) {
      logger.error('No pending notification found for failed work block', undefined, {
        block_index: blockIndex
      });
      return;
    }

    // Create failed work results for all farmers
    const failedResults = notification.plantedFarmers.map(farmer => ({
      farmerId: farmer.farmerId,
      custodialWallet: farmer.custodialWallet,
      status: 'failed' as const,
      workTime: 0,
      attempts: 0,
      error: error.message || 'Work execution failed',
      compensationRequired: true
    }));

    // Notify Backend about the failure
    const failureNotification: WorkCompletionNotification = {
      blockIndex,
      poolerId: Config.POOLER.ID,
      workResults: failedResults,
      summary: {
        totalFarmers: failedResults.length,
        successfulWork: 0,
        failedWork: failedResults.length,
        totalWorkTime: 0,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyBackendWorkCompletion(failureNotification);
  }

  /**
   * Notify Backend about work completion
   */
  private async notifyBackendWorkCompletion(notification: WorkCompletionNotification): Promise<void> {
    try {
      const response = await fetch(`${Config.BACKEND_API.URL}/pooler/work-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Config.POOLER.AUTH_TOKEN}`,
          'X-Pooler-ID': Config.POOLER.ID
        },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(Config.BACKEND_API.TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`Backend notification failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;

      logger.info('Backend notified of work completion', {
        block_index: notification.blockIndex,
        response_status: response.status,
        successful_work: notification.summary.successfulWork,
        failed_work: notification.summary.failedWork
      });

      // Process any compensation instructions from Backend
      if (result && result.compensationInstructions && Array.isArray(result.compensationInstructions) && result.compensationInstructions.length > 0) {
        logger.info('Received compensation instructions from Backend', {
          block_index: notification.blockIndex,
          compensation_count: result.compensationInstructions.length
        });
      }

    } catch (error) {
      logger.error('Failed to notify Backend of work completion', error as Error, {
        block_index: notification.blockIndex,
        backend_url: Config.BACKEND_API.URL
      });
    }
  }

  /**
   * Get current coordination status
   */
  getStatus() {
    return {
      pendingWorkBlocks: Array.from(this.pendingWorkBlocks.keys()),
      activeWorkBlocks: Array.from(this.activeWorkPromises.keys()),
      workManagerStatus: workManager.getWorkStatus()
    };
  }

  /**
   * Cancel pending work for a block (if not yet started)
   */
  async cancelPendingWork(blockIndex: number): Promise<boolean> {
    if (this.pendingWorkBlocks.has(blockIndex) && !this.activeWorkPromises.has(blockIndex)) {
      this.pendingWorkBlocks.delete(blockIndex);
      logger.info('Cancelled pending work for block', { block_index: blockIndex });
      return true;
    }
    return false;
  }

  /**
   * Emergency stop all work
   */
  emergencyStop(): void {
    logger.warn('Emergency stop initiated - stopping all work');
    
    // Stop work manager
    workManager.stopWork();
    
    // Clear all pending work
    this.pendingWorkBlocks.clear();
    
    // Note: Active promises will complete or timeout naturally
    logger.info('Emergency stop completed', {
      cleared_pending_blocks: this.pendingWorkBlocks.size,
      active_work_blocks: this.activeWorkPromises.size
    });
  }
}

// Export singleton instance
export const poolCoordinator = new PoolCoordinator();
