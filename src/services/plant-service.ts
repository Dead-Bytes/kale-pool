// Plant service for KALE Pool Mining Backend
// Phase 1: Coordinated plant operations for multiple farmers

import { stellarWalletManager } from './wallet-manager';
import { farmerQueries, plantQueries, poolerQueries, blockOperationQueries } from './database';
import { farmerQueriesPhase2 } from './database-phase2';
import type { FarmerRow } from './database';
import Config from '../../../Shared/config';

// Logger implementation
class PlantLogger {
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

const logger = new PlantLogger('PlantService');

// Plant operation result interfaces
export interface PlantAttempt {
  farmerId: string;
  custodialWallet: string;
  stakeAmount: string;
  status: 'success' | 'failed';
  transactionHash?: string;
  error?: string;
}

export interface PlantServiceResult {
  blockIndex: number;
  poolerId: string;
  totalRequested: number;
  successfulPlants: PlantAttempt[];
  failedPlants: PlantAttempt[];
  totalStaked: string;
  processingTimeMs: number;
}

// ======================
// PLANT SERVICE
// ======================

export class PlantService {
  private readonly MAX_BATCH_SIZE = 50;
  private readonly PARALLEL_LIMIT = 10;

  // ======================
  // MAIN PLANT COORDINATION
  // ======================

  async processPlantRequest(
    blockIndex: number,
    poolerId: string,
    maxFarmersCapacity: number
  ): Promise<PlantServiceResult> {
    const startTime = Date.now();

    logger.info('Starting plant request processing', {
      block_index: blockIndex,
      pooler_id: poolerId,
      max_capacity: maxFarmersCapacity
    });

    try {
      // Mark plant operation start in block_operations
      await this.markPlantOperationStarted(blockIndex, poolerId);

      // Update pooler last seen
      await poolerQueries.updatePoolerLastSeen(poolerId);

      // Get active farmers for this pooler
      const farmers = await this.getEligibleFarmers(poolerId, maxFarmersCapacity);

      if (farmers.length === 0) {
        logger.warn('No eligible farmers found for pooler', {
          pooler_id: poolerId,
          block_index: blockIndex
        });

        return {
          blockIndex,
          poolerId,
          totalRequested: 0,
          successfulPlants: [],
          failedPlants: [],
          totalStaked: '0',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Process plants in parallel batches
      const plantResults = await this.executePlantBatch(blockIndex, poolerId, farmers);

      // Calculate totals
      const successful = plantResults.filter(result => result.status === 'success');
      const failed = plantResults.filter(result => result.status === 'failed');
      
      const totalStaked = successful.reduce((sum, result) => {
        return (BigInt(sum) + BigInt(result.stakeAmount)).toString();
      }, '0');

      const result: PlantServiceResult = {
        blockIndex,
        poolerId,
        totalRequested: farmers.length,
        successfulPlants: successful,
        failedPlants: failed,
        totalStaked,
        processingTimeMs: Date.now() - startTime
      };

      logger.info('Plant request processing completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        total_requested: result.totalRequested,
        successful: successful.length,
        failed: failed.length,
        total_staked: totalStaked,
        processing_time_ms: result.processingTimeMs
      });

      // Update block_operations table with planting results
      await this.updateBlockOperationsAfterPlanting(blockIndex, result);

      return result;

    } catch (error) {
      logger.error('Plant request processing failed', error as Error, {
        block_index: blockIndex,
        pooler_id: poolerId,
        processing_time_ms: Date.now() - startTime
      });

      throw new Error(`Plant processing failed: ${(error as Error).message}`);
    }
  }

  // ======================
  // FARMER ELIGIBILITY
  // ======================

  private async getEligibleFarmers(poolerId: string, maxCapacity: number): Promise<any[]> {
    try {
      // Phase 2: Get farmers with active contracts (pool-based farming)
      const contractFarmers = await farmerQueriesPhase2.getFarmersWithActiveContracts(poolerId);
      
      if (contractFarmers.length > 0) {
        logger.debug('Retrieved farmers with active contracts', {
          pooler_id: poolerId,
          contract_farmers: contractFarmers.length,
          max_capacity: maxCapacity
        });

        // Filter farmers with active contracts and check funding
        const eligibleFarmers: any[] = [];

        for (const farmer of contractFarmers) {
          if (eligibleFarmers.length >= maxCapacity) {
            break;
          }

          try {
            // Check if farmer's custodial wallet is funded
            const isFunded = await stellarWalletManager.isAccountFunded(farmer.custodial_public_key);
            
            if (isFunded) {
              eligibleFarmers.push(farmer);
              logger.debug('Contract farmer eligible for planting', {
                farmer_id: farmer.id,
                stake_percentage: farmer.stake_percentage,
                harvest_interval: farmer.harvest_interval
              });
            } else {
              logger.warn('Contract farmer wallet not sufficiently funded', {
                farmer_id: farmer.id,
                custodial_wallet: farmer.custodial_public_key
              });
              
              // Update farmer funding status
              await farmerQueriesPhase2.updateFarmerStatus(farmer.id, 'funded'); // Reset to funded status for retry
            }
          } catch (error) {
            logger.error('Failed to check contract farmer funding', error as Error, {
              farmer_id: farmer.id,
              custodial_wallet: farmer.custodial_public_key
            });
          }
        }

        logger.info('Contract farmer eligibility check completed', {
          pooler_id: poolerId,
          contract_farmers: contractFarmers.length,
          eligible_farmers: eligibleFarmers.length,
          max_capacity: maxCapacity
        });

        return eligibleFarmers;
      }

      // Fallback to Phase 1: Get all active farmers for the pooler (legacy support)
      const allFarmers = await farmerQueries.getActiveFarmersByPooler(poolerId);
      
      logger.debug('Retrieved legacy farmers for pooler', {
        pooler_id: poolerId,
        total_farmers: allFarmers.length,
        max_capacity: maxCapacity
      });

      // Filter out farmers that aren't properly funded
      const eligibleFarmers: any[] = [];

      for (const farmer of allFarmers) {
        if (eligibleFarmers.length >= maxCapacity) {
          break;
        }

        try {
          // Check if farmer's custodial wallet is funded
          const isFunded = await stellarWalletManager.isAccountFunded(farmer.custodial_public_key);
          
          if (isFunded) {
            eligibleFarmers.push(farmer);
          } else {
            logger.warn('Legacy farmer wallet not sufficiently funded', {
              farmer_id: farmer.id,
              custodial_wallet: farmer.custodial_public_key
            });
            
            // Update farmer funding status in database
            await farmerQueries.updateFarmerFunding(farmer.id, false);
          }
        } catch (error) {
          logger.error('Failed to check legacy farmer funding', error as Error, {
            farmer_id: farmer.id,
            custodial_wallet: farmer.custodial_public_key
          });
        }
      }

      logger.info('Legacy farmer eligibility check completed', {
        pooler_id: poolerId,
        total_farmers: allFarmers.length,
        eligible_farmers: eligibleFarmers.length,
        max_capacity: maxCapacity
      });

      return eligibleFarmers;

    } catch (error) {
      logger.error('Failed to get eligible farmers', error as Error, {
        pooler_id: poolerId
      });
      throw error;
    }
  }

  // ======================
  // PLANT EXECUTION
  // ======================

  private async executePlantBatch(
    blockIndex: number,
    poolerId: string,
    farmers: FarmerRow[]
  ): Promise<PlantAttempt[]> {
    logger.info('Starting plant batch execution', {
      block_index: blockIndex,
      pooler_id: poolerId,
      farmer_count: farmers.length
    });

    const results: PlantAttempt[] = [];

    // Process farmers in parallel batches
    for (let i = 0; i < farmers.length; i += this.PARALLEL_LIMIT) {
      const batch = farmers.slice(i, i + this.PARALLEL_LIMIT);
      
      const batchPromises = batch.map(farmer => 
        this.executeSinglePlant(blockIndex, poolerId, farmer)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process settled promises
      batchResults.forEach((result, index) => {
        const farmer = batch[index];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Plant operation promise failed', result.reason, {
            farmer_id: farmer.id,
            block_index: blockIndex
          });
          
          results.push({
            farmerId: farmer.id,
            custodialWallet: farmer.custodial_public_key,
            stakeAmount: '0',
            status: 'failed',
            error: result.reason?.message || 'Promise rejection'
          });
        }
      });
    }

    return results;
  }

  private async executeSinglePlant(
    blockIndex: number,
    poolerId: string,
    farmer: FarmerRow
  ): Promise<PlantAttempt> {
    const plantStartTime = Date.now();

    try {
      // Calculate stake amount based on farmer's real-time wallet balance and percentage
      const stakeAmount = await this.calculateStakeAmount(farmer);

      logger.debug('Executing plant for farmer', {
        farmer_id: farmer.id,
        custodial_wallet: farmer.custodial_public_key,
        stake_amount: stakeAmount,
        block_index: blockIndex
      });

      // Execute plant transaction
      const plantResult = await stellarWalletManager.plantForFarmer(
        farmer.custodial_secret_key,
        stakeAmount
      );

      if (plantResult.success && plantResult.transactionHash) {
        // Record successful plant in database
        await plantQueries.recordPlanting(
          blockIndex,
          farmer.id,
          poolerId,
          farmer.custodial_public_key,
          stakeAmount,
          plantResult.transactionHash,
          'success'
        );

        logger.debug('Plant operation successful - DATABASE RECORDED', {
          farmer_id: farmer.id,
          transaction_hash: plantResult.transactionHash,
          stake_amount_stroops: stakeAmount,
          stake_amount_kale: (Number(stakeAmount) / 10000000).toFixed(7),
          block_index: blockIndex,
          duration_ms: Date.now() - plantStartTime
        });

        return {
          farmerId: farmer.id,
          custodialWallet: farmer.custodial_public_key,
          stakeAmount,
          status: 'success',
          transactionHash: plantResult.transactionHash
        };

      } else {
        // Record failed plant in database
        await plantQueries.recordPlanting(
          blockIndex,
          farmer.id,
          poolerId,
          farmer.custodial_public_key,
          stakeAmount,
          'failed_transaction',
          'failed',
          plantResult.error
        );

        logger.warn('Plant operation failed', {
          farmer_id: farmer.id,
          error: plantResult.error,
          stake_amount: stakeAmount,
          duration_ms: Date.now() - plantStartTime
        });

        return {
          farmerId: farmer.id,
          custodialWallet: farmer.custodial_public_key,
          stakeAmount,
          status: 'failed',
          error: plantResult.error
        };
      }

    } catch (error) {
      // Record failed plant in database
      try {
        await plantQueries.recordPlanting(
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
        logger.error('Failed to record plant failure in database', dbError as Error, {
          farmer_id: farmer.id,
          block_index: blockIndex
        });
      }

      logger.error('Plant operation exception', error as Error, {
        farmer_id: farmer.id,
        block_index: blockIndex,
        duration_ms: Date.now() - plantStartTime
      });

      return {
        farmerId: farmer.id,
        custodialWallet: farmer.custodial_public_key,
        stakeAmount: '0',
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  // ======================
  // STAKE CALCULATION
  // ======================

  private async calculateStakeAmount(farmer: any): Promise<string> {
    try {
      // Get real-time KALE balance from Stellar wallet instead of database
      let currentBalanceKale = 0;
      let currentBalance = BigInt(0);
      
      try {
        // Import the wallet balance service
        const { getWalletBalance } = await import('../services/stellar-wallet-service');
        const balanceResult = await getWalletBalance(farmer.custodial_public_key);
        
        if ('error' in balanceResult) {
          logger.warn('Failed to fetch wallet balance for stake calculation, using database balance', {
            farmer_id: farmer.id,
            custodial_wallet: farmer.custodial_public_key,
            error: balanceResult.error
          });
          currentBalance = BigInt(farmer.current_balance || '0');
          currentBalanceKale = Number(farmer.current_balance || '0') / 10000000;
        } else {
          // Use real-time balance from Stellar wallet
          currentBalanceKale = parseFloat(balanceResult.kale);
          currentBalance = BigInt(Math.floor(currentBalanceKale * 10000000)); // Convert KALE to stroops
          
          logger.info('Fetched real-time wallet balance for stake calculation', {
            farmer_id: farmer.id,
            custodial_wallet: farmer.custodial_public_key,
            wallet_balance_kale: currentBalanceKale,
            wallet_balance_stroops: currentBalance.toString()
          });
        }
      } catch (balanceError) {
        logger.error('Error fetching wallet balance for stake calculation', balanceError as Error, {
          farmer_id: farmer.id
        });
        // Fallback to database balance
        currentBalance = BigInt(farmer.current_balance || '0');
        currentBalanceKale = Number(farmer.current_balance || '0') / 10000000;
      }
      
      // Calculate stake based on percentage
      // Phase 2 (contract farmers) have stake_percentage from pool contracts
      // Phase 1 (legacy farmers) have stake_percentage from farmer record
      const stakePercentage = farmer.stake_percentage || 0.1; // Default 10% if not set
      const stakeAmount = (currentBalance * BigInt(Math.floor(stakePercentage * 1000))) / BigInt(1000);

      // Ensure minimum stake (could be 0 for new farmers)
      const minStake = BigInt(0);
      const finalStake = stakeAmount > minStake ? stakeAmount : minStake;

      logger.debug('Stake calculation completed', {
        farmer_id: farmer.id,
        farmer_type: farmer.harvest_interval ? 'contract' : 'legacy',
        wallet_balance_real_time_kale: currentBalanceKale.toFixed(7),
        wallet_balance_stroops: currentBalance.toString(),
        database_balance_stroops: farmer.current_balance || '0',
        stake_percentage: stakePercentage,
        calculated_stake_stroops: finalStake.toString(),
        calculated_stake_kale: (Number(finalStake) / 10000000).toFixed(7),
        contract_harvest_interval: farmer.harvest_interval || 'N/A',
        source: 'real_time_stellar_wallet'
      });

      return finalStake.toString();

    } catch (error) {
      logger.error('Stake calculation failed', error as Error, {
        farmer_id: farmer.id,
        current_balance: farmer.current_balance,
        stake_percentage: farmer.stake_percentage,
        farmer_type: farmer.harvest_interval ? 'contract' : 'legacy'
      });

      // Return 0 stake on calculation error
      return '0';
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
      logger.error('Plant service health check failed', error as Error);
      return false;
    }
  }

  getServiceInfo() {
    return {
      service: 'PlantService',
      max_batch_size: this.MAX_BATCH_SIZE,
      parallel_limit: this.PARALLEL_LIMIT,
      network_info: stellarWalletManager.getNetworkInfo()
    };
  }

  // ======================
  // BLOCK OPERATIONS UPDATE
  // ======================

  private async markPlantOperationStarted(blockIndex: number, poolerId: string): Promise<void> {
    try {
      // Ensure block_operations record exists first
      await blockOperationQueries.createBlockOperation(blockIndex, poolerId, 'active');

      // Mark plant started
      await blockOperationQueries.updateBlockOperationPlantStarted(blockIndex);

      logger.debug('Marked plant operation started in block_operations', {
        block_index: blockIndex,
        pooler_id: poolerId
      });

    } catch (error) {
      logger.error('Failed to mark plant operation started', error as Error, {
        block_index: blockIndex,
        pooler_id: poolerId
      });
      // Don't throw - this is an audit table update, shouldn't fail the main operation
    }
  }

  private async updateBlockOperationsAfterPlanting(
    blockIndex: number, 
    plantResult: PlantServiceResult
  ): Promise<void> {
    try {
      logger.debug('Updating block_operations table after planting', {
        block_index: blockIndex,
        successful_plants: plantResult.successfulPlants.length,
        total_staked: plantResult.totalStaked
      });

      // Update block_operations with planting statistics
      await blockOperationQueries.updateBlockOperationStats(blockIndex, {
        plant_completed_at: new Date(),
        total_farmers: plantResult.totalRequested,
        successful_plants: plantResult.successfulPlants.length,
        total_staked: plantResult.totalStaked,
        status: plantResult.successfulPlants.length > 0 ? 'active' : 'failed'
      });

      logger.info('Block operations updated successfully after planting', {
        block_index: blockIndex,
        total_farmers: plantResult.totalRequested,
        successful_plants: plantResult.successfulPlants.length,
        total_staked: plantResult.totalStaked
      });

    } catch (error) {
      logger.error('Failed to update block_operations after planting', error as Error, {
        block_index: blockIndex,
        plant_result: {
          total_requested: plantResult.totalRequested,
          successful: plantResult.successfulPlants.length,
          failed: plantResult.failedPlants.length
        }
      });
      // Don't throw - this is an audit table update, shouldn't fail the main operation
    }
  }
}

// Export singleton instance
export const plantService = new PlantService();
