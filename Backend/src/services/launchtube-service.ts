// Launchtube Transaction Service - Handles KALE contract transactions via Launchtube
// Based on enhanced-farmer.ts and farm_scheduled.ts patterns

import { Keypair } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/minimal/contract';
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
  private contract: Client;

  constructor() {
    this.launchtubeUrl = Config.LAUNCHTUBE.URL;
    this.launchtubeJwt = Config.LAUNCHTUBE.JWT;
    this.rpcUrl = Config.STELLAR.RPC_URL;
    this.contractId = Config.STELLAR.CONTRACT_ID;
    this.networkPassphrase = Config.STELLAR.NETWORK_PASSPHRASE;

    // Initialize KALE contract client (like in reference files)
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
   * Submit transaction via Launchtube (exactly following reference utils.ts send function)
   */
  private async submitTransaction(txn: any, fee?: number): Promise<LaunchtubeResponse> {
    try {
      const data = new FormData();
      
      // Exact same logic as reference send function
      let txnXdr: string;
      if (txn.built) {
        txnXdr = txn.built.toXDR();
      } else if (typeof txn === 'string') {
        txnXdr = txn;
      } else {
        txnXdr = txn.toXDR();
      }
      
      data.set('xdr', txnXdr);
      
      if (fee) {
        data.set('fee', fee.toString());
      }

      // Submit to Launchtube with exact same headers as reference
      const response = await fetch(this.launchtubeUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.launchtubeJwt}`,
          'X-Client-Name': 'kale-pool-backend',
          'X-Client-Version': '2.0.0'
        },
        body: data
      });

      // Follow reference error handling pattern
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
        logger.error('Transaction submission failed', undefined, { error: errorText, status: response.status });
        
        // Parse the error to check for specific contract errors
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
        } catch (e) {
          parsedError = { error: errorText };
        }
        
        return {
          success: false,
          error: errorText,
          details: parsedError
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
   */
  async plant(request: PlantRequest): Promise<LaunchtubeResponse> {
    try {
      const { farmerPublicKey, farmerSecretKey, stakeAmount } = request;
      
      logger.info('Starting plant operation', {
        farmer: farmerPublicKey,
        stake_amount: stakeAmount.toString()
      });

      // Create the plant transaction
      const transaction = await this.contract.plant({
        farmer: farmerPublicKey,
        amount: stakeAmount,
      });

      // Check for simulation errors (following enhanced-farmer.ts pattern)
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
      }

      // Sign auth entries (following enhanced-farmer.ts pattern)
      const farmerSigner = basicNodeSigner(
        Keypair.fromSecret(farmerSecretKey), 
        this.networkPassphrase
      );

      await transaction.signAuthEntries({
        address: farmerPublicKey,
        signAuthEntry: farmerSigner.signAuthEntry,
      });

      // Submit via Launchtube (following reference send function)
      const result = await this.submitTransaction(transaction);
      
      if (result.success) {
        logger.info('Plant operation successful', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          stake_amount: stakeAmount.toString()
        });
      }

      return result;

    } catch (error) {
      logger.error('Plant operation failed', error as Error, {
        farmer: request.farmerPublicKey,
        stake_amount: request.stakeAmount.toString()
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
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

      // Create the work transaction
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

      // Work operations don't require auth from the farmer (others can work on their behalf)
      // But we still sign with the farmer's key for consistency
      const farmerSigner = basicNodeSigner(
        Keypair.fromSecret(farmerSecretKey), 
        this.networkPassphrase
      );

      await transaction.signAuthEntries({
        address: farmerPublicKey,
        signAuthEntry: farmerSigner.signAuthEntry,
      });

      // Submit via Launchtube
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
      
      logger.info('Starting harvest operation', {
        farmer: farmerPublicKey,
        block_index: blockIndex
      });

      // Create the harvest transaction
      const transaction = await this.contract.harvest({
        farmer: farmerPublicKey,
        index: blockIndex,
      });

      // Check for simulation errors
      if (Api.isSimulationError(transaction.simulation!)) {
        const errorMessage = transaction.simulation.error;
        
        if (errorMessage.includes('Error(Contract, #14)')) {
          logger.info('Harvest not ready yet', { farmer: farmerPublicKey, block_index: blockIndex });
          return {
            success: false,
            error: 'Harvest not ready - block may not be complete yet',
            details: { message: 'HarvestNotReady' }
          };
        } else if (errorMessage.includes('Error(Contract, #10)')) {
          logger.info('Work missing for harvest', { farmer: farmerPublicKey, block_index: blockIndex });
          return {
            success: false,
            error: 'Work missing - must complete work before harvest',
            details: { message: 'WorkMissing' }
          };
        } else {
          logger.error('Harvest simulation error', undefined, { error: errorMessage });
          return {
            success: false,
            error: `Simulation failed: ${errorMessage}`,
            details: { simulation_error: errorMessage }
          };
        }
      }

      // Sign auth entries
      const farmerSigner = basicNodeSigner(
        Keypair.fromSecret(farmerSecretKey), 
        this.networkPassphrase
      );

      await transaction.signAuthEntries({
        address: farmerPublicKey,
        signAuthEntry: farmerSigner.signAuthEntry,
      });

      // Submit via Launchtube
      const result = await this.submitTransaction(transaction);
      
      if (result.success) {
        const reward = transaction.simulation?.result?.retval;
        logger.info('Harvest operation successful', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          block_index: blockIndex,
          reward: reward ? reward.toString() : 'unknown'
        });
      }

      return result;

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
        batch.map(request => this.plant(request))
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