// KALE Pool Mining - Exit Payout Service
// Multi-wallet payout system for farmer exits with comprehensive error handling

import { db } from './database';
import { stellarWalletManager } from './wallet-manager';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import {
  ExitSplitRecord,
  PayoutOperation,
  PayoutResult,
  PayoutError,
  ExitStatus,
  ExitJobData,
  ExitJobResult,
  EXIT_CONSTANTS
} from '../types/exit-types';

class ExitPayoutService {
  
  // =====================================================
  // 1. MAIN PAYOUT EXECUTION
  // =====================================================
  
  async executeExitPayout(exitSplitId: string): Promise<PayoutResult> {
    let exitSplit: ExitSplitRecord | null = null;
    
    try {
      // 1. Get exit split record
      exitSplit = await this.getExitSplitRecord(exitSplitId);
      if (!exitSplit) {
        throw new Error('Exit split record not found');
      }
      
      if (exitSplit.status !== ExitStatus.PROCESSING) {
        logger.warn(`Exit payout called on non-processing exit: ${exitSplitId}, status: ${exitSplit.status}`);
        return {
          success: false,
          totalAmount: BigInt(exitSplit.totalRewards),
          errors: [{ type: 'farmer', message: `Exit not in processing state: ${exitSplit.status}`, retryable: false }]
        };
      }
      
      logger.info(`Starting exit payout execution: ${JSON.stringify({
        exit_split_id: exitSplitId,
        farmer_id: exitSplit.farmerId,
        total_rewards: exitSplit.totalRewards,
        farmer_share: exitSplit.farmerShare,
        pooler_share: exitSplit.poolerShare,
        platform_fee: exitSplit.platformFee
      })}`);
      
      // 2. Validate custodial wallet balance
      const hasBalance = await this.validateCustodialBalance(
        exitSplit.farmerCustodialWallet, 
        BigInt(exitSplit.totalRewards)
      );
      
      if (!hasBalance) {
        await this.updateExitStatus(exitSplitId, ExitStatus.FAILED, 'Insufficient balance in custodial wallet');
        return {
          success: false,
          totalAmount: BigInt(exitSplit.totalRewards),
          errors: [{ type: 'farmer', message: 'Insufficient custodial wallet balance', retryable: false }]
        };
      }
      
      // 3. Execute the three-way payout
      const payoutResult = await this.executeMultiWalletPayout({
        farmerId: exitSplit.farmerId,
        contractId: exitSplit.contractId,
        custodialWallet: exitSplit.farmerCustodialWallet,
        farmerExternalWallet: exitSplit.farmerExternalWallet,
        poolerWallet: exitSplit.poolerWallet,
        platformWallet: exitSplit.platformWallet,
        amounts: {
          totalRewards: BigInt(exitSplit.totalRewards),
          farmerShare: BigInt(exitSplit.farmerShare),
          poolerShare: BigInt(exitSplit.poolerShare),
          platformFee: BigInt(exitSplit.platformFee),
          rewardSplit: exitSplit.rewardSplit,
          platformFeeRate: exitSplit.platformFeeRate
        }
      });
      
      // 4. Update database with results
      if (payoutResult.success) {
        await this.completeExitPayout(exitSplitId, payoutResult);
        await this.markHarvestsAsExited(exitSplit.farmerId, exitSplit.contractId, exitSplitId);
        await this.completeContract(exitSplit.contractId, exitSplitId);
        await this.updateFarmerStatus(exitSplit.farmerId);
        await this.updatePoolerFarmerCount(exitSplit.poolerId, -1);
        
        logger.info(`Exit payout completed successfully: ${JSON.stringify({
          exit_split_id: exitSplitId,
          farmer_tx: payoutResult.farmerTxHash,
          pooler_tx: payoutResult.poolerTxHash,
          platform_tx: payoutResult.platformTxHash
        })}`);
      } else {
        await this.handlePayoutFailure(exitSplitId, payoutResult);
      }
      
      return payoutResult;
      
    } catch (error) {
      logger.error('Exit payout execution failed', error as Error, { 
        exit_split_id: exitSplitId,
        farmer_id: exitSplit?.farmerId
      });
      
      if (exitSplit) {
        await this.updateExitStatus(exitSplitId, ExitStatus.FAILED, (error as Error).message);
        await this.scheduleRetryIfEligible(exitSplitId, exitSplit);
      }
      
      return {
        success: false,
        totalAmount: exitSplit ? BigInt(exitSplit.totalRewards) : 0n,
        errors: [{ type: 'farmer', message: (error as Error).message, retryable: true }]
      };
    }
  }
  
  private async executeMultiWalletPayout(operation: PayoutOperation): Promise<PayoutResult> {
    const result: PayoutResult = {
      success: false,
      totalAmount: operation.amounts.totalRewards,
      errors: []
    };
    
    try {
      // Execute payouts in sequence with individual error handling
      
      // 1. Transfer farmer share to external wallet
      if (operation.amounts.farmerShare > 0n) {
        try {
          logger.info(`Executing farmer payout: ${operation.amounts.farmerShare.toString()} stroops to ${operation.farmerExternalWallet}`);
          
          const farmerResult = await stellarWalletManager.transfer({
            fromPublicKey: operation.custodialWallet,
            toPublicKey: operation.farmerExternalWallet,
            amount: operation.amounts.farmerShare.toString(),
            memo: 'KALE pool exit - farmer rewards'
          });
          
          if (farmerResult.success && farmerResult.transactionHash) {
            result.farmerTxHash = farmerResult.transactionHash;
            logger.info(`Farmer payout successful: ${farmerResult.transactionHash}`);
          } else {
            throw new Error(farmerResult.error || 'Farmer payout failed');
          }
        } catch (error) {
          result.errors.push({
            type: 'farmer',
            message: (error as Error).message,
            retryable: true
          });
          logger.error('Farmer payout failed', error as Error, operation);
        }
      }
      
      // 2. Transfer pooler share to pooler wallet
      if (operation.amounts.poolerShare > 0n) {
        try {
          logger.info(`Executing pooler payout: ${operation.amounts.poolerShare.toString()} stroops to ${operation.poolerWallet}`);
          
          const poolerResult = await stellarWalletManager.transfer({
            fromPublicKey: operation.custodialWallet,
            toPublicKey: operation.poolerWallet,
            amount: operation.amounts.poolerShare.toString(),
            memo: 'KALE pool exit - pooler commission'
          });
          
          if (poolerResult.success && poolerResult.transactionHash) {
            result.poolerTxHash = poolerResult.transactionHash;
            logger.info(`Pooler payout successful: ${poolerResult.transactionHash}`);
          } else {
            throw new Error(poolerResult.error || 'Pooler payout failed');
          }
        } catch (error) {
          result.errors.push({
            type: 'pooler',
            message: (error as Error).message,
            retryable: true
          });
          logger.error('Pooler payout failed', error as Error, operation);
        }
      }
      
      // 3. Transfer platform fee
      if (operation.amounts.platformFee > 0n) {
        try {
          logger.info(`Executing platform fee: ${operation.amounts.platformFee.toString()} stroops to ${operation.platformWallet}`);
          
          const platformResult = await stellarWalletManager.transfer({
            fromPublicKey: operation.custodialWallet,
            toPublicKey: operation.platformWallet,
            amount: operation.amounts.platformFee.toString(),
            memo: 'KALE pool exit - platform fee'
          });
          
          if (platformResult.success && platformResult.transactionHash) {
            result.platformTxHash = platformResult.transactionHash;
            logger.info(`Platform fee successful: ${platformResult.transactionHash}`);
          } else {
            throw new Error(platformResult.error || 'Platform fee failed');
          }
        } catch (error) {
          result.errors.push({
            type: 'platform',
            message: (error as Error).message,
            retryable: true
          });
          logger.error('Platform fee failed', error as Error, operation);
        }
      }
      
      // Determine overall success
      result.success = result.errors.length === 0;
      
      if (result.success) {
        logger.info(`All payouts completed successfully for exit payout`);
      } else {
        logger.warn(`Partial payout failure: ${result.errors.length} errors out of 3 transactions`);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Multi-wallet payout execution failed', error as Error, operation);
      result.errors.push({
        type: 'farmer',
        message: (error as Error).message,
        retryable: true
      });
      return result;
    }
  }

  // =====================================================
  // 2. DATABASE OPERATIONS
  // =====================================================
  
  private async getExitSplitRecord(exitSplitId: string): Promise<ExitSplitRecord | null> {
    try {
      const query = `
        SELECT 
          es.*
        FROM exit_splits es
        WHERE es.id = $1
      `;
      
      const result = await db.query(query, [exitSplitId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      return {
        id: row.id,
        farmerId: row.farmer_id,
        poolerId: row.pooler_id,
        contractId: row.contract_id,
        totalRewards: row.total_rewards,
        farmerShare: row.farmer_share,
        poolerShare: row.pooler_share,
        platformFee: row.platform_fee,
        rewardSplit: parseFloat(row.reward_split),
        platformFeeRate: parseFloat(row.platform_fee_rate),
        farmerExternalWallet: row.farmer_external_wallet,
        farmerCustodialWallet: row.farmer_custodial_wallet,
        poolerWallet: row.pooler_wallet,
        platformWallet: row.platform_wallet,
        farmerTxHash: row.farmer_tx_hash,
        poolerTxHash: row.pooler_tx_hash,
        platformTxHash: row.platform_tx_hash,
        blocksIncluded: row.blocks_included,
        harvestsIncluded: row.harvests_included,
        firstHarvestDate: row.first_harvest_date,
        lastHarvestDate: row.last_harvest_date,
        status: row.status as ExitStatus,
        initiatedAt: row.initiated_at,
        completedAt: row.completed_at,
        errorMessage: row.error_message,
        retryCount: row.retry_count,
        lastRetryAt: row.last_retry_at,
        exitReason: row.exit_reason,
        notes: row.notes
      };
      
    } catch (error) {
      logger.error('Exit split record retrieval failed', error as Error, { exit_split_id: exitSplitId });
      return null;
    }
  }
  
  private async updateExitStatus(exitSplitId: string, status: ExitStatus, errorMessage?: string): Promise<void> {
    try {
      const query = `
        UPDATE exit_splits 
        SET status = $2, error_message = $3, completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END
        WHERE id = $1
      `;
      
      await db.query(query, [exitSplitId, status, errorMessage || null]);
      
      logger.info(`Exit status updated: ${exitSplitId} -> ${status}`);
      
    } catch (error) {
      logger.error('Exit status update failed', error as Error, { 
        exit_split_id: exitSplitId, 
        status, 
        error_message: errorMessage 
      });
    }
  }
  
  private async completeExitPayout(exitSplitId: string, payoutResult: PayoutResult): Promise<void> {
    try {
      const query = `
        UPDATE exit_splits 
        SET 
          status = 'completed',
          farmer_tx_hash = $2,
          pooler_tx_hash = $3,
          platform_tx_hash = $4,
          completed_at = NOW(),
          error_message = NULL
        WHERE id = $1
      `;
      
      await db.query(query, [
        exitSplitId,
        payoutResult.farmerTxHash || null,
        payoutResult.poolerTxHash || null,
        payoutResult.platformTxHash || null
      ]);
      
      // Record platform fee
      if (payoutResult.platformTxHash) {
        await this.recordPlatformFee(exitSplitId, payoutResult.platformTxHash);
      }
      
    } catch (error) {
      logger.error('Exit completion update failed', error as Error, { 
        exit_split_id: exitSplitId,
        payout_result: payoutResult
      });
    }
  }
  
  private async handlePayoutFailure(exitSplitId: string, payoutResult: PayoutResult): Promise<void> {
    try {
      const errorMessages = payoutResult.errors.map(e => `${e.type}: ${e.message}`).join('; ');
      
      // Update partial transaction hashes and error status
      const query = `
        UPDATE exit_splits 
        SET 
          farmer_tx_hash = COALESCE($2, farmer_tx_hash),
          pooler_tx_hash = COALESCE($3, pooler_tx_hash),
          platform_tx_hash = COALESCE($4, platform_tx_hash),
          error_message = $5,
          retry_count = retry_count + 1,
          last_retry_at = NOW()
        WHERE id = $1
      `;
      
      await db.query(query, [
        exitSplitId,
        payoutResult.farmerTxHash || null,
        payoutResult.poolerTxHash || null,
        payoutResult.platformTxHash || null,
        errorMessages
      ]);
      
      // Record any successful platform fees
      if (payoutResult.platformTxHash) {
        await this.recordPlatformFee(exitSplitId, payoutResult.platformTxHash);
      }
      
    } catch (error) {
      logger.error('Payout failure handling failed', error as Error, { 
        exit_split_id: exitSplitId 
      });
    }
  }

  // =====================================================
  // 3. POST-PAYOUT CLEANUP
  // =====================================================
  
  private async markHarvestsAsExited(farmerId: string, contractId: string, exitSplitId: string): Promise<void> {
    try {
      const query = `
        UPDATE harvests 
        SET 
          included_in_exit = true,
          exit_split_id = $3
        WHERE farmer_id = $1 
          AND status = 'success'
          AND (included_in_exit = false OR included_in_exit IS NULL)
          AND EXISTS (
            SELECT 1 FROM pool_contracts pc 
            WHERE pc.farmer_id = $1 AND pc.id = $2 AND pc.status IN ('active', 'exiting')
          )
      `;
      
      const result = await db.query(query, [farmerId, contractId, exitSplitId]);
      
      logger.info(`Marked ${result.rowCount} harvests as exited for farmer ${farmerId}`);
      
    } catch (error) {
      logger.error('Harvest exit marking failed', error as Error, { 
        farmer_id: farmerId, 
        contract_id: contractId, 
        exit_split_id: exitSplitId 
      });
    }
  }
  
  private async completeContract(contractId: string, exitSplitId: string): Promise<void> {
    try {
      const query = `
        UPDATE pool_contracts 
        SET 
          status = 'completed',
          exit_split_id = $2,
          exited_at = NOW(),
          exit_reason = 'farmer_initiated'
        WHERE id = $1
      `;
      
      await db.query(query, [contractId, exitSplitId]);
      
      logger.info(`Contract completed: ${contractId}`);
      
    } catch (error) {
      logger.error('Contract completion failed', error as Error, { 
        contract_id: contractId, 
        exit_split_id: exitSplitId 
      });
    }
  }
  
  private async updateFarmerStatus(farmerId: string): Promise<void> {
    try {
      const query = `
        UPDATE farmers 
        SET 
          last_exit_at = NOW(),
          exit_count = exit_count + 1
        WHERE id = $1
      `;
      
      await db.query(query, [farmerId]);
      
      logger.info(`Farmer exit status updated: ${farmerId}`);
      
    } catch (error) {
      logger.error('Farmer status update failed', error as Error, { farmer_id: farmerId });
    }
  }
  
  private async updatePoolerFarmerCount(poolerId: string, delta: number): Promise<void> {
    try {
      const query = `
        UPDATE poolers 
        SET current_farmers = GREATEST(0, current_farmers + $2)
        WHERE id = $1
      `;
      
      await db.query(query, [poolerId, delta]);
      
      logger.info(`Pooler farmer count updated: ${poolerId} (${delta > 0 ? '+' : ''}${delta})`);
      
    } catch (error) {
      logger.error('Pooler farmer count update failed', error as Error, { 
        pooler_id: poolerId, 
        delta 
      });
    }
  }
  
  private async recordPlatformFee(exitSplitId: string, transactionHash: string): Promise<void> {
    try {
      const query = `
        INSERT INTO platform_fees (exit_split_id, amount, fee_rate, withdrawal_tx_hash, status)
        SELECT 
          $1,
          es.platform_fee,
          es.platform_fee_rate,
          $2,
          'collected'
        FROM exit_splits es
        WHERE es.id = $1
      `;
      
      await db.query(query, [exitSplitId, transactionHash]);
      
    } catch (error) {
      logger.error('Platform fee recording failed', error as Error, { 
        exit_split_id: exitSplitId, 
        tx_hash: transactionHash 
      });
    }
  }

  // =====================================================
  // 4. VALIDATION & RETRY LOGIC
  // =====================================================
  
  private async validateCustodialBalance(custodialWallet: string, requiredAmount: bigint): Promise<boolean> {
    try {
      const balance = await stellarWalletManager.getWalletBalance(custodialWallet);
      
      if (!balance.success || !balance.balances) {
        logger.warn(`Could not retrieve balance for custodial wallet: ${custodialWallet}`);
        return false;
      }
      
      const kaleBalance = balance.balances.find(b => b.asset_code === 'KALE');
      if (!kaleBalance) {
        logger.warn(`No KALE balance found for custodial wallet: ${custodialWallet}`);
        return false;
      }
      
      const availableBalance = BigInt(Math.floor(parseFloat(kaleBalance.balance) * 10**7));
      const hasBalance = availableBalance >= requiredAmount;
      
      logger.info(`Balance validation: wallet ${custodialWallet}, available: ${availableBalance.toString()}, required: ${requiredAmount.toString()}, sufficient: ${hasBalance}`);
      
      return hasBalance;
      
    } catch (error) {
      logger.error('Balance validation failed', error as Error, { 
        custodial_wallet: custodialWallet, 
        required_amount: requiredAmount.toString() 
      });
      return false;
    }
  }
  
  private async scheduleRetryIfEligible(exitSplitId: string, exitSplit: ExitSplitRecord): Promise<void> {
    try {
      if (exitSplit.retryCount >= EXIT_CONSTANTS.MAX_RETRY_ATTEMPTS) {
        logger.warn(`Exit ${exitSplitId} exceeded max retry attempts: ${exitSplit.retryCount}`);
        await this.updateExitStatus(exitSplitId, ExitStatus.FAILED, 'Exceeded maximum retry attempts');
        return;
      }
      
      const retryDelay = Math.pow(2, exitSplit.retryCount) * EXIT_CONSTANTS.RETRY_BACKOFF_BASE_MS;
      
      logger.info(`Scheduling retry for exit ${exitSplitId}, attempt ${exitSplit.retryCount + 1}, delay: ${retryDelay}ms`);
      
      setTimeout(async () => {
        try {
          await this.executeExitPayout(exitSplitId);
        } catch (error) {
          logger.error('Retry execution failed', error as Error, { exit_split_id: exitSplitId });
        }
      }, retryDelay);
      
    } catch (error) {
      logger.error('Retry scheduling failed', error as Error, { exit_split_id: exitSplitId });
    }
  }

  // =====================================================
  // 5. RECOVERY & ADMIN METHODS
  // =====================================================
  
  async retryFailedExit(exitSplitId: string): Promise<boolean> {
    try {
      const exitSplit = await this.getExitSplitRecord(exitSplitId);
      
      if (!exitSplit || exitSplit.status !== ExitStatus.FAILED) {
        logger.warn(`Cannot retry exit: not in failed state: ${exitSplitId}`);
        return false;
      }
      
      if (exitSplit.retryCount >= EXIT_CONSTANTS.MAX_RETRY_ATTEMPTS) {
        logger.warn(`Cannot retry exit: exceeded max attempts: ${exitSplitId}`);
        return false;
      }
      
      // Reset to processing state
      await this.updateExitStatus(exitSplitId, ExitStatus.PROCESSING);
      
      // Execute payout
      const result = await this.executeExitPayout(exitSplitId);
      
      return result.success;
      
    } catch (error) {
      logger.error('Exit retry failed', error as Error, { exit_split_id: exitSplitId });
      return false;
    }
  }
  
  async getExitPayoutStatus(exitSplitId: string): Promise<ExitSplitRecord | null> {
    return this.getExitSplitRecord(exitSplitId);
  }
  
  async verifyTransactionStatuses(exitSplitId: string): Promise<{
    farmer: boolean;
    pooler: boolean;
    platform: boolean;
  }> {
    try {
      const exitSplit = await this.getExitSplitRecord(exitSplitId);
      if (!exitSplit) {
        return { farmer: false, pooler: false, platform: false };
      }
      
      // TODO: Implement actual Stellar transaction verification
      // For now, check if transaction hashes exist
      return {
        farmer: !!exitSplit.farmerTxHash,
        pooler: !!exitSplit.poolerTxHash,
        platform: !!exitSplit.platformTxHash
      };
      
    } catch (error) {
      logger.error('Transaction status verification failed', error as Error, { exit_split_id: exitSplitId });
      return { farmer: false, pooler: false, platform: false };
    }
  }
}

export const exitPayoutService = new ExitPayoutService();