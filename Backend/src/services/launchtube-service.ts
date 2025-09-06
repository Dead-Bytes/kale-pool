// Launchtube Transaction Service - Handles KALE contract transactions via Launchtube
// Based on enhanced-farmer.ts and farm_scheduled.ts patterns

import { Keypair } from '@stellar/stellar-sdk';
import { basicNodeSigner, AssembledTransaction } from '@stellar/stellar-sdk/minimal/contract';
import { Api } from '@stellar/stellar-sdk/minimal/rpc';
import { Client } from 'kale-sc-sdk';

// Import centralized logger and config
import { launchtubeLogger as logger } from '../../../Shared/utils/logger';
import Config from '../../../Shared/config';

export interface LaunchtubeResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
  details?: any;
}

export interface PlantRequest {
  farmerPublicKey: string;
  farmerSecretKey: string;
  stakeAmount: bigint;
}

export interface WorkRequest {
  farmerPublicKey: string;
  farmerSecretKey: string;
  hash: Buffer;
  nonce: bigint;
}

export interface HarvestRequest {
  farmerPublicKey: string;
  farmerSecretKey: string;
  blockIndex: number;
}

export class LaunchtubeService {
  private launchtubeUrl: string;
  private launchtubeJwt: string;
  private rpcUrl: string;
  private contractId: string;
  private networkPassphrase: string;
  // SINGLE GLOBAL CONTRACT CLIENT (like reference)
  private contract: Client;
  // SINGLE GLOBAL SIGNER CACHE (for reuse)
  private signerCache: Map<string, any> = new Map();

  constructor() {
    this.launchtubeUrl = Config.LAUNCHTUBE.URL;
    this.launchtubeJwt = Config.LAUNCHTUBE.JWT;
    this.rpcUrl = Config.STELLAR.RPC_URL;
    this.contractId = Config.STELLAR.CONTRACT_ID;
    this.networkPassphrase = Config.STELLAR.NETWORK_PASSPHRASE;

    // Initialize SINGLE GLOBAL contract client (EXACT reference pattern)
    this.contract = new Client({
      rpcUrl: this.rpcUrl,
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
    });

    logger.info('LaunchtubeService initialized', {
      launchtube_url: this.launchtubeUrl,
      rpc_url: this.rpcUrl,
      contract_id: this.contractId,
      network: Config.STELLAR.NETWORK
    });
  }

  /**
   * Get cached signer for farmer (like reference uses single global signer)
   */
  private getFarmerSigner(farmerSecretKey: string): any {
    if (!this.signerCache.has(farmerSecretKey)) {
      const signer = basicNodeSigner(
        Keypair.fromSecret(farmerSecretKey), 
        this.networkPassphrase
      );
      this.signerCache.set(farmerSecretKey, signer);
    }
    return this.signerCache.get(farmerSecretKey);
  }

  /**
   * Submit transaction via Launchtube (EXACT reference utils.ts send function pattern)
   */
  private async submitTransaction(txn: any, fee?: number): Promise<LaunchtubeResponse> {
    try {
      const data = new FormData();
      
      // EXACT same logic as reference send function - proper instanceof check
      if (txn instanceof AssembledTransaction) {
        // This is AssembledTransaction - convert to XDR string like reference
        txn = txn.built!.toXDR();
      } else if (typeof txn !== 'string') {
        txn = txn.toXDR();
      }
      
      data.set('xdr', txn);
      
      if (fee) {
        data.set('fee', fee.toString());
      }

      // Submit to Launchtube with EXACT same headers as reference
      const response = await fetch(this.launchtubeUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.launchtubeJwt}`,
          'X-Client-Name': 'rust-kale-farmer',
          'X-Client-Version': 'kale-pool-backend-2.0.0'
        },
        body: data
      });

      // EXACT reference response handling pattern
      if (response.ok) {
        const result = await response.json();
        logger.debug('Transaction submitted successfully', { result });
        
        return {
          success: true,
          transactionHash: result.hash || result.id,
          details: result
        };
      } else {
        const errorText = await response.text();
        logger.error('Launchtube submission failed', undefined, { 
          status: response.status,
          error_text: errorText
        });
        
        // Return error response instead of throwing (to allow retry logic to work)
        return {
          success: false,
          error: `Launchtube returned: ${errorText}`,
          details: { 
            status: response.status,
            error_text: errorText
          }
        };
      }
    } catch (error) {
      logger.error('Error submitting transaction', error as Error);
      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  /**
   * Plant operation - creates a Pail for the farmer with stake
   * Includes retry logic to keep trying until success
   */
  async plant(request: PlantRequest, maxRetries: number = 5): Promise<LaunchtubeResponse> {
    const { farmerPublicKey, farmerSecretKey, stakeAmount } = request;
    
    logger.info('🌱 Starting plant operation with retry logic', {
      farmer: farmerPublicKey,
      stake_amount: stakeAmount.toString(),
      max_retries: maxRetries
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🌱 Plant attempt ${attempt}/${maxRetries}`, {
        farmer: farmerPublicKey,
        stake_amount: stakeAmount.toString()
      });

      try {
        // Use SINGLE GLOBAL contract client (EXACT reference pattern)
        const transaction = await this.contract.plant({
          farmer: farmerPublicKey,
          amount: stakeAmount,
        });

        // Check for simulation errors (EXACT reference pattern)
        if (Api.isSimulationError(transaction.simulation!)) {
          const errorMsg = transaction.simulation.error;
          
          if (errorMsg.includes("Error(Contract, #8)")) {
            logger.info('Already planted for this block', { farmer: farmerPublicKey });
            return {
              success: true,
              transactionHash: 'already_planted',
              details: { message: 'Already planted for this block' }
            };
          } else {
            logger.error('Plant simulation error', undefined, { error: errorMsg });
            return {
              success: false,
              error: `Simulation failed: ${errorMsg}`,
              details: { simulation_error: errorMsg }
            };
          }
        } else {
          // Use cached signer (like reference uses single global signer)
          const farmerSigner = this.getFarmerSigner(farmerSecretKey);

          // Sign auth entries (EXACT reference pattern)
          await transaction.signAuthEntries({
            address: farmerPublicKey,
            signAuthEntry: farmerSigner.signAuthEntry,
          });

          // Submit via Launchtube (EXACT reference pattern - pass AssembledTransaction)
          const result = await this.submitTransaction(transaction);
        
          if (result.success) {
            logger.info('Plant operation successful', {
              farmer: farmerPublicKey,
              transaction_hash: result.transactionHash,
              stake_amount: stakeAmount.toString()
            });
            return result;
          } else {
            // This is a failed submission (like NOT_FOUND) - should be retried
            logger.warn(`Plant submission failed, will retry`, {
              farmer: farmerPublicKey,
              error: result.error,
              attempt
            });
            throw new Error(result.error);
          }
        }

      } catch (error) {
        logger.error(`Plant attempt ${attempt}/${maxRetries} failed`, error as Error, {
          farmer: farmerPublicKey,
          stake_amount: stakeAmount.toString()
        });

        // If this was the last attempt, return the error
        if (attempt === maxRetries) {
          logger.error('🚨 All plant attempts failed', error as Error, {
            farmer: farmerPublicKey,
            stake_amount: stakeAmount.toString(),
            attempts_made: maxRetries
          });

          return {
            success: false,
            error: `All ${maxRetries} plant attempts failed: ${(error as Error).message}`,
            details: { error, attempts_made: maxRetries }
          };
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        logger.info(`⏳ Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // This should never be reached due to the logic above
    return {
      success: false,
      error: 'Unexpected error in retry loop',
      details: { max_retries: maxRetries }
    };
  }

  /**
   * Work operation - submits proof-of-work with hash and nonce
   */
  async work(request: WorkRequest): Promise<LaunchtubeResponse> {
    try {
      const { farmerPublicKey, farmerSecretKey, hash, nonce } = request;
      
      logger.info('Starting work operation', {
        farmer: farmerPublicKey,
        nonce: nonce.toString(),
        hash: hash.subarray(0, 4).toString('hex') + '...'
      });

      // Use SINGLE GLOBAL contract client (EXACT reference pattern)
      const transaction = await this.contract.work({
        farmer: farmerPublicKey,
        hash: hash,
        nonce: nonce,
      });

      // Check for simulation errors
      if (Api.isSimulationError(transaction.simulation!)) {
        const errorMessage = transaction.simulation.error;
        logger.error('Work simulation error', undefined, { error: errorMessage });
        
        return {
          success: false,
          error: `Simulation failed: ${errorMessage}`,
          details: { simulation_error: errorMessage }
        };
      }

      // Use cached signer (like reference uses single global signer)
      const farmerSigner = this.getFarmerSigner(farmerSecretKey);

      await transaction.signAuthEntries({
        address: farmerPublicKey,
        signAuthEntry: farmerSigner.signAuthEntry,
      });

      // Submit via Launchtube (EXACT reference pattern)
      const result = await this.submitTransaction(transaction);
      
      if (result.success) {
        logger.info('Work operation successful', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          nonce: nonce.toString()
        });
      }

      return result;

    } catch (error) {
      logger.error('Work operation failed', error as Error, {
        farmer: request.farmerPublicKey,
        nonce: request.nonce.toString()
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  /**
   * Harvest operation - claims rewards for completed work
   */
  async harvest(request: HarvestRequest): Promise<LaunchtubeResponse> {
    try {
      const { farmerPublicKey, farmerSecretKey, blockIndex } = request;
      
      const blockIndexNumber = parseInt(blockIndex.toString(), 10);
      
      logger.info('Starting harvest operation', {
        farmer: farmerPublicKey,
        block_index: blockIndex,
        block_index_type: typeof blockIndex,
        block_index_converted: blockIndexNumber,
        block_index_converted_type: typeof blockIndexNumber
      });

      // Use SINGLE GLOBAL contract client (EXACT reference pattern)
      const transaction = await this.contract.harvest({
        farmer: farmerPublicKey,
        index: blockIndexNumber, // Ensure blockIndex is properly converted to number for u32 type
      });

      // Check for simulation errors (same as parallel-harvester)
      if (Api.isSimulationError(transaction.simulation!)) {
        const errorMessage = transaction.simulation.error;
        
        // Handle known harvest errors (same as parallel-harvester)
        if (
          errorMessage.includes('Error(Contract, #9)') ||  // PailMissing
          errorMessage.includes('Error(Contract, #10)') || // WorkMissing
          errorMessage.includes('Error(Contract, #11)') || // BlockMissing
          errorMessage.includes('Error(Contract, #14)')    // HarvestNotReady
        ) {
          logger.info('Block not ready for harvest', { 
            farmer: farmerPublicKey, 
            block_index: blockIndex,
            error: errorMessage 
          });
          return {
            success: false,
            error: `Block ${blockIndex} not ready for harvest: ${errorMessage}`,
            details: { simulation_error: errorMessage }
          };
        } else {
          logger.error('Harvest simulation error', undefined, { error: errorMessage });
          return {
            success: false,
            error: `Simulation failed: ${errorMessage}`,
            details: { simulation_error: errorMessage }
          };
        }
      } else {
        // Simulation successful - proceed with harvest
        // FIRST: Extract reward from transaction.result (EXACT reference pattern)
        const rewardAmount = transaction.result ? Number(transaction.result) : 0;
        logger.info('Harvest transaction result extracted', {
          farmer: farmerPublicKey,
          block_index: blockIndex,
          raw_result: transaction.result,
          reward_stroops: rewardAmount,
          reward_kale: (rewardAmount / 10000000).toFixed(7)
        });
        
        // Send the transaction using Launchtube (same as reference send() function)
        try {
          const data = new FormData();
          
          // Convert transaction to XDR (same as reference send function)
          const xdr = transaction.built!.toXDR();
          data.set('xdr', xdr);
          
          // Submit directly to Launchtube
          const response = await fetch(this.launchtubeUrl, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${this.launchtubeJwt}`,
              'X-Client-Name': 'kale-pool-backend',
              'X-Client-Version': '1.0.0'
            },
            body: data
          });
          
          if (response.ok) {
            const responseData = await response.json();
            
            logger.info('Harvest operation successful', {
              farmer: farmerPublicKey,
              transaction_hash: responseData.hash || 'unknown',
              block_index: blockIndex,
              reward_stroops: rewardAmount,
              reward_kale: (rewardAmount / 10000000).toFixed(7)
            });
            
            return {
              success: true,
              transactionHash: responseData.hash || 'unknown',
              details: {
                reward: rewardAmount.toString(), // Use the reward we already extracted
                response: responseData
              }
            };
          } else {
            const errorText = await response.text();
            logger.error('Launchtube submission failed', undefined, {
              farmer: farmerPublicKey,
              block_index: blockIndex,
              status: response.status,
              error: errorText
            });
            
            return {
              success: false,
              error: `Launchtube submission failed: ${errorText}`,
              details: { status: response.status, error: errorText }
            };
          }
        } catch (submitError) {
          logger.error('Harvest submission exception', submitError as Error, {
            farmer: farmerPublicKey,
            block_index: blockIndex
          });
          
          return {
            success: false,
            error: `Submission exception: ${(submitError as Error).message}`,
            details: submitError
          };
        }
      }

    } catch (error) {
      logger.error('Harvest operation failed', error as Error, {
        farmer: request.farmerPublicKey,
        block_index: request.blockIndex
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  /**
   * Batch plant operations for multiple farmers
   */
  async plantBatch(requests: PlantRequest[]): Promise<LaunchtubeResponse[]> {
    logger.info('Starting batch plant operations', { count: requests.length });
    
    const results: LaunchtubeResponse[] = [];
    const concurrency = 5; // Limit concurrent operations
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(request => this.plant(request, 3)) // Reduced retries for batch to avoid overwhelming
      );
      
      results.push(...batchResults);
    }
    
    const successCount = results.filter(r => r.success).length;
    logger.info('Batch plant operations completed', {
      total: results.length,
      successful: successCount,
      failed: results.length - successCount
    });
    
    return results;
  }

  /**
   * Health check for Launchtube service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test if Launchtube URL is accessible
      const response = await fetch(this.launchtubeUrl, {
        method: 'OPTIONS',
        headers: {
          authorization: `Bearer ${this.launchtubeJwt}`,
        },
        timeout: 5000
      });
      
      return response.status < 500;
    } catch (error) {
      logger.error('Launchtube health check failed', error as Error);
      return false;
    }
  }
}

// Export singleton instance
export const launchtubeService = new LaunchtubeService();