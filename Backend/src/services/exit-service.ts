// KALE Pool Mining - Farmer Exit Service
// Core service for handling farmer exits, reward calculations, and payouts

import { db } from './database';
import { stellarWalletManager } from './wallet-manager';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import {
  ExitCalculation,
  ExitSplitRecord,
  ExitInitiationRequest,
  ExitInitiationResult,
  ExitStatusResponse,
  ExitRewardsCalculation,
  PayoutOperation,
  PayoutResult,
  PayoutError,
  ExitStatus,
  ExitEligibility,
  ContractTerms,
  ExitConfiguration,
  EXIT_CONSTANTS
} from '../types/exit-types';
import { AuthUser } from '../types/auth-types';

class ExitService {
  
  private formatKaleAmount(stroops: string): string {
    const amount = BigInt(stroops);
    const kaleAmount = Number(amount) / 10**7;
    return kaleAmount.toFixed(7);
  }

  // =====================================================
  // 1. EXIT ELIGIBILITY & VALIDATION
  // =====================================================
  
  async checkExitEligibility(farmerId: string): Promise<ExitEligibility> {
    try {
      // Check if farmer has an active contract
      const contractResult = await db.query(`
        SELECT 
          pc.id,
          pc.pooler_id,
          pc.joined_at,
          pc.status,
          pc.exit_split_id
        FROM pool_contracts pc
        WHERE pc.farmer_id = $1 AND pc.status = 'active'
        ORDER BY pc.joined_at DESC
        LIMIT 1
      `, [farmerId]);
      
      if (contractResult.rows.length === 0) {
        return {
          eligible: false,
          reason: 'No active pool contract found'
        };
      }
      
      const contract = contractResult.rows[0];
      
      // Check if there's already a pending exit
      const exitResult = await db.query(`
        SELECT id, status, initiated_at
        FROM exit_splits
        WHERE farmer_id = $1 AND status IN ('processing')
        ORDER BY initiated_at DESC
        LIMIT 1
      `, [farmerId]);
      
      if (exitResult.rows.length > 0) {
        const pendingExit = exitResult.rows[0];
        return {
          eligible: false,
          reason: 'Exit already in progress',
          activeContract: {
            id: contract.id,
            poolerId: contract.pooler_id,
            joinedAt: contract.joined_at,
            status: contract.status
          },
          pendingExit: {
            id: pendingExit.id,
            status: pendingExit.status,
            initiatedAt: pendingExit.initiated_at
          }
        };
      }
      
      return {
        eligible: true,
        activeContract: {
          id: contract.id,
          poolerId: contract.pooler_id,
          joinedAt: contract.joined_at,
          status: contract.status
        }
      };
      
    } catch (error) {
      logger.error('Exit eligibility check failed', error as Error, { farmer_id: farmerId });
      return {
        eligible: false,
        reason: 'System error during eligibility check'
      };
    }
  }
  
  async validateExternalWallet(address: string): Promise<boolean> {
    try {
      // Basic Stellar address validation
      if (!address || address.length !== 56) {
        return false;
      }
      
      if (!address.startsWith('G')) {
        return false;
      }
      
      // TODO: Add actual Stellar SDK validation
      // For now, basic format check
      return /^G[A-Z0-9]{55}$/.test(address);
      
    } catch (error) {
      logger.error('Wallet validation failed', error as Error, { address });
      return false;
    }
  }

  // =====================================================
  // 2. REWARD CALCULATION
  // =====================================================
  
  async calculateUnexitedRewards(farmerId: string, contractId: string): Promise<ExitRewardsCalculation> {
    try {
      const query = `
        SELECT 
          SUM(h.reward_amount::bigint) as total_rewards,
          COUNT(*) as harvest_count,
          COUNT(DISTINCT h.block_index) as blocks_count,
          MIN(h.harvested_at) as first_harvest,
          MAX(h.harvested_at) as last_harvest
        FROM harvests h
        JOIN pool_contracts pc ON h.farmer_id = pc.farmer_id
        WHERE h.farmer_id = $1 
          AND pc.id = $2
          AND pc.status = 'active'
          AND h.status = 'success'
          AND (h.included_in_exit = false OR h.included_in_exit IS NULL)
      `;
      
      const result = await db.query(query, [farmerId, contractId]);
      const row = result.rows[0];
      
      return {
        totalRewards: BigInt(row.total_rewards || '0'),
        harvestCount: parseInt(row.harvest_count || '0'),
        blocksCount: parseInt(row.blocks_count || '0'),
        firstHarvest: row.first_harvest ? new Date(row.first_harvest) : undefined,
        lastHarvest: row.last_harvest ? new Date(row.last_harvest) : undefined
      };
      
    } catch (error) {
      logger.error('Reward calculation failed', error as Error, { 
        farmer_id: farmerId, 
        contract_id: contractId 
      });
      throw new Error('Failed to calculate exit rewards');
    }
  }
  
  async getContractTerms(contractId: string): Promise<ContractTerms> {
    try {
      const query = `
        SELECT 
          pc.farmer_reward_split,
          pc.stake_percentage,
          p.reward_percentage as pooler_fee,
          'flexible' as harvest_policy,
          24 as exit_delay_hours
        FROM pool_contracts pc
        JOIN poolers p ON pc.pooler_id = p.id
        WHERE pc.id = $1
      `;
      
      const result = await db.query(query, [contractId]);
      if (result.rows.length === 0) {
        throw new Error('Contract not found');
      }
      
      const row = result.rows[0];
      
      // Calculate platform fee from configuration
      const config = await this.getExitConfiguration();
      
      return {
        rewardSplit: row.farmer_reward_split || EXIT_CONSTANTS.DEFAULT_REWARD_SPLIT,
        platformFee: config.platformFeeRate,
        minimumStake: '100000000', // 10 KALE
        harvestPolicy: row.harvest_policy,
        exitDelay: row.exit_delay_hours
      };
      
    } catch (error) {
      logger.error('Contract terms retrieval failed', error as Error, { contract_id: contractId });
      throw new Error('Failed to retrieve contract terms');
    }
  }
  
  calculateExitSplit(contractTerms: ContractTerms, totalRewards: bigint): ExitCalculation {
    try {
      // Calculate platform fee first
      const platformFee = totalRewards * BigInt(Math.floor(contractTerms.platformFee * 10000)) / 10000n;
      const netRewards = totalRewards - platformFee;
      
      // Split net rewards between farmer and pooler
      const farmerShare = netRewards * BigInt(Math.floor(contractTerms.rewardSplit * 10000)) / 10000n;
      const poolerShare = netRewards - farmerShare;
      
      const calculation: ExitCalculation = {
        totalRewards,
        farmerShare,
        poolerShare,
        platformFee,
        rewardSplit: contractTerms.rewardSplit,
        platformFeeRate: contractTerms.platformFee
      };
      
      // Validation
      if (calculation.farmerShare + calculation.poolerShare + calculation.platformFee !== calculation.totalRewards) {
        throw new Error('Exit calculation amounts do not sum correctly');
      }
      
      return calculation;
      
    } catch (error) {
      logger.error('Exit split calculation failed', error as Error, { 
        contract_terms: contractTerms, 
        total_rewards: totalRewards.toString() 
      });
      throw new Error('Failed to calculate exit split');
    }
  }

  // =====================================================
  // 3. EXIT INITIATION
  // =====================================================
  
  async initiateExit(request: ExitInitiationRequest, user: AuthUser): Promise<ExitInitiationResult> {
    try {
      logger.info(`Exit initiation started: ${JSON.stringify({
        farmer_id: request.farmerId,
        external_wallet: request.externalWallet,
        immediate: request.immediate,
        initiated_by: user.id
      })}`);
      
      // 1. Check eligibility
      const eligibility = await this.checkExitEligibility(request.farmerId);
      if (!eligibility.eligible) {
        throw new Error(`Exit not eligible: ${eligibility.reason}`);
      }
      
      // 2. Validate external wallet
      const isValidWallet = await this.validateExternalWallet(request.externalWallet);
      if (!isValidWallet) {
        throw new Error('Invalid external wallet address');
      }
      
      // 3. Get contract and calculate rewards
      const contractId = eligibility.activeContract!.id;
      const contractTerms = await this.getContractTerms(contractId);
      const rewardData = await this.calculateUnexitedRewards(request.farmerId, contractId);
      
      if (rewardData.totalRewards < BigInt(EXIT_CONSTANTS.MIN_EXIT_AMOUNT_STROOPS)) {
        throw new Error('Exit amount below minimum threshold');
      }
      
      const splitCalculation = this.calculateExitSplit(contractTerms, rewardData.totalRewards);
      
      // 4. Get wallet information
      const walletInfo = await this.getWalletInfo(request.farmerId, eligibility.activeContract!.poolerId);
      
      // 5. Create exit split record
      const exitSplitId = await this.createExitSplit({
        farmerId: request.farmerId,
        poolerId: eligibility.activeContract!.poolerId,
        contractId,
        calculation: splitCalculation,
        walletInfo: {
          farmerExternal: request.externalWallet,
          farmerCustodial: walletInfo.custodial,
          pooler: walletInfo.pooler,
          platform: walletInfo.platform
        },
        harvestData: {
          blocksIncluded: rewardData.blocksCount,
          harvestsIncluded: rewardData.harvestCount,
          firstHarvestDate: rewardData.firstHarvest,
          lastHarvestDate: rewardData.lastHarvest
        }
      });
      
      // 6. Queue background processing if immediate
      if (request.immediate !== false) {
        await this.queueExitProcessing(exitSplitId);
      }
      
      // 7. Log audit event
      await this.logExitEvent(exitSplitId, 'exit_initiated', null, ExitStatus.PROCESSING, {
        initiated_by: user.id,
        immediate: request.immediate
      });
      
      const result: ExitInitiationResult = {
        exitRequestId: exitSplitId,
        status: ExitStatus.PROCESSING,
        estimatedRewards: {
          totalRewards: splitCalculation.totalRewards.toString(),
          totalRewardsHuman: this.formatKaleAmount(splitCalculation.totalRewards.toString()),
          farmerShare: splitCalculation.farmerShare.toString(),
          farmerShareHuman: this.formatKaleAmount(splitCalculation.farmerShare.toString()),
          poolerShare: splitCalculation.poolerShare.toString(),
          poolerShareHuman: this.formatKaleAmount(splitCalculation.poolerShare.toString()),
          platformFee: splitCalculation.platformFee.toString(),
          platformFeeHuman: this.formatKaleAmount(splitCalculation.platformFee.toString())
        },
        processingTime: '~2-5 minutes',
        externalWallet: request.externalWallet
      };
      
      logger.info(`Exit initiation completed: ${JSON.stringify({
        exit_split_id: exitSplitId,
        farmer_id: request.farmerId,
        total_rewards: result.estimatedRewards.totalRewards,
        farmer_share: result.estimatedRewards.farmerShare
      })}`);
      
      return result;
      
    } catch (error) {
      logger.error('Exit initiation failed', error as Error, {
        farmer_id: request.farmerId,
        external_wallet: request.externalWallet
      });
      throw error;
    }
  }

  // =====================================================
  // 4. STATUS & MONITORING
  // =====================================================
  
  async getExitStatus(farmerId: string): Promise<ExitStatusResponse> {
    try {
      const query = `
        SELECT 
          es.id,
          es.status,
          es.total_rewards,
          es.farmer_share,
          es.pooler_share,
          es.platform_fee,
          es.farmer_tx_hash,
          es.pooler_tx_hash,
          es.platform_tx_hash,
          es.initiated_at,
          es.completed_at
        FROM exit_splits es
        WHERE es.farmer_id = $1
        ORDER BY es.initiated_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [farmerId]);
      
      if (result.rows.length === 0) {
        return {
          farmerId,
          exitSplit: null
        };
      }
      
      const row = result.rows[0];
      
      return {
        farmerId,
        exitSplit: {
          id: row.id,
          status: row.status as ExitStatus,
          totalRewards: row.total_rewards,
          farmerShare: row.farmer_share,
          poolerShare: row.pooler_share,
          platformFee: row.platform_fee,
          transactions: {
            farmer: row.farmer_tx_hash || undefined,
            pooler: row.pooler_tx_hash || undefined,
            platform: row.platform_tx_hash || undefined
          },
          initiatedAt: row.initiated_at,
          completedAt: row.completed_at || undefined
        }
      };
      
    } catch (error) {
      logger.error('Exit status retrieval failed', error as Error, { farmer_id: farmerId });
      throw new Error('Failed to retrieve exit status');
    }
  }

  // =====================================================
  // 5. HELPER METHODS
  // =====================================================
  
  private async getExitConfiguration(): Promise<ExitConfiguration> {
    try {
      const query = `
        SELECT parameter_name, parameter_value
        FROM exit_configuration
        WHERE parameter_name IN ('PLATFORM_FEE_RATE', 'MAX_RETRY_ATTEMPTS', 'RETRY_BACKOFF_BASE', 
                                'EXIT_PROCESSING_TIMEOUT', 'PLATFORM_WALLET_ADDRESS', 'MIN_EXIT_AMOUNT')
      `;
      
      const result = await db.query(query);
      const config: Partial<ExitConfiguration> = {};
      
      result.rows.forEach(row => {
        switch (row.parameter_name) {
          case 'PLATFORM_FEE_RATE':
            config.platformFeeRate = parseFloat(row.parameter_value);
            break;
          case 'MAX_RETRY_ATTEMPTS':
            config.maxRetryAttempts = parseInt(row.parameter_value);
            break;
          case 'RETRY_BACKOFF_BASE':
            config.retryBackoffBase = parseInt(row.parameter_value);
            break;
          case 'EXIT_PROCESSING_TIMEOUT':
            config.exitProcessingTimeout = parseInt(row.parameter_value);
            break;
          case 'PLATFORM_WALLET_ADDRESS':
            config.platformWalletAddress = row.parameter_value;
            break;
          case 'MIN_EXIT_AMOUNT':
            config.minExitAmount = row.parameter_value;
            break;
        }
      });
      
      // Fill in defaults for missing values
      return {
        platformFeeRate: config.platformFeeRate || EXIT_CONSTANTS.PLATFORM_FEE_RATE,
        maxRetryAttempts: config.maxRetryAttempts || EXIT_CONSTANTS.MAX_RETRY_ATTEMPTS,
        retryBackoffBase: config.retryBackoffBase || EXIT_CONSTANTS.RETRY_BACKOFF_BASE_MS,
        exitProcessingTimeout: config.exitProcessingTimeout || EXIT_CONSTANTS.PROCESSING_TIMEOUT_MS,
        platformWalletAddress: config.platformWalletAddress || 'GPLATFORMWALLET123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        minExitAmount: config.minExitAmount || EXIT_CONSTANTS.MIN_EXIT_AMOUNT_STROOPS
      };
      
    } catch (error) {
      logger.error('Exit configuration retrieval failed', error as Error);
      // Return defaults
      return {
        platformFeeRate: EXIT_CONSTANTS.PLATFORM_FEE_RATE,
        maxRetryAttempts: EXIT_CONSTANTS.MAX_RETRY_ATTEMPTS,
        retryBackoffBase: EXIT_CONSTANTS.RETRY_BACKOFF_BASE_MS,
        exitProcessingTimeout: EXIT_CONSTANTS.PROCESSING_TIMEOUT_MS,
        platformWalletAddress: 'GPLATFORMWALLET123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        minExitAmount: EXIT_CONSTANTS.MIN_EXIT_AMOUNT_STROOPS
      };
    }
  }
  
  private async getWalletInfo(farmerId: string, poolerId: string): Promise<{
    custodial: string;
    pooler: string;
    platform: string;
  }> {
    try {
      const query = `
        SELECT 
          f.custodial_public_key,
          p.wallet_address as pooler_wallet
        FROM farmers f
        JOIN poolers p ON p.id = $2
        WHERE f.id = $1
      `;
      
      const result = await db.query(query, [farmerId, poolerId]);
      if (result.rows.length === 0) {
        throw new Error('Wallet information not found');
      }
      
      const row = result.rows[0];
      const config = await this.getExitConfiguration();
      
      return {
        custodial: row.custodial_public_key,
        pooler: row.pooler_wallet,
        platform: config.platformWalletAddress
      };
      
    } catch (error) {
      logger.error('Wallet info retrieval failed', error as Error, {
        farmer_id: farmerId,
        pooler_id: poolerId
      });
      throw new Error('Failed to retrieve wallet information');
    }
  }
  
  private async createExitSplit(params: {
    farmerId: string;
    poolerId: string;
    contractId: string;
    calculation: ExitCalculation;
    walletInfo: {
      farmerExternal: string;
      farmerCustodial: string;
      pooler: string;
      platform: string;
    };
    harvestData: {
      blocksIncluded: number;
      harvestsIncluded: number;
      firstHarvestDate?: Date;
      lastHarvestDate?: Date;
    };
  }): Promise<string> {
    try {
      const query = `
        INSERT INTO exit_splits (
          farmer_id, pooler_id, contract_id,
          total_rewards, farmer_share, pooler_share, platform_fee,
          reward_split, platform_fee_rate,
          farmer_external_wallet, farmer_custodial_wallet, pooler_wallet, platform_wallet,
          blocks_included, harvests_included, first_harvest_date, last_harvest_date,
          exit_reason
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          'farmer_initiated'
        ) RETURNING id
      `;
      
      const values = [
        params.farmerId, params.poolerId, params.contractId,
        params.calculation.totalRewards.toString(), 
        params.calculation.farmerShare.toString(),
        params.calculation.poolerShare.toString(), 
        params.calculation.platformFee.toString(),
        params.calculation.rewardSplit, 
        params.calculation.platformFeeRate,
        params.walletInfo.farmerExternal, 
        params.walletInfo.farmerCustodial,
        params.walletInfo.pooler, 
        params.walletInfo.platform,
        params.harvestData.blocksIncluded, 
        params.harvestData.harvestsIncluded,
        params.harvestData.firstHarvestDate, 
        params.harvestData.lastHarvestDate
      ];
      
      const result = await db.query(query, values);
      return result.rows[0].id;
      
    } catch (error) {
      logger.error('Exit split creation failed', error as Error, params);
      throw new Error('Failed to create exit split record');
    }
  }
  
  private async queueExitProcessing(exitSplitId: string): Promise<void> {
    // TODO: Implement background job queue (Redis/Bull)
    // For now, we'll process immediately in a setTimeout
    setTimeout(async () => {
      try {
        await this.processExitPayout(exitSplitId);
      } catch (error) {
        logger.error('Queued exit processing failed', error as Error, { exit_split_id: exitSplitId });
      }
    }, 1000);
  }
  
  private async logExitEvent(
    exitSplitId: string, 
    action: string, 
    oldStatus: ExitStatus | null, 
    newStatus: ExitStatus | null,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO exit_audit_log (exit_split_id, action, old_status, new_status, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [exitSplitId, action, oldStatus, newStatus, JSON.stringify(details || {})]);
    } catch (error) {
      logger.error('Exit event logging failed', error as Error, { 
        exit_split_id: exitSplitId, 
        action 
      });
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  // =====================================================
  // 6. PAYOUT PROCESSING
  // =====================================================
  
  async processExitPayout(exitSplitId: string): Promise<void> {
    logger.info(`Exit payout processing started: ${exitSplitId}`);
    
    try {
      // Import the payout service to avoid circular dependencies
      const { exitPayoutService } = await import('./exit-payout-service');
      
      const result = await exitPayoutService.executeExitPayout(exitSplitId);
      
      if (result.success) {
        logger.info(`Exit payout processing completed successfully: ${exitSplitId}`);
      } else {
        logger.warn(`Exit payout processing failed: ${exitSplitId}, errors: ${result.errors.length}`);
      }
      
    } catch (error) {
      logger.error('Exit payout processing failed', error as Error, { exit_split_id: exitSplitId });
      throw error;
    }
  }
}

export const exitService = new ExitService();