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
    // Note: We'll create fresh clients per transaction with proper source accounts
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
        
        // 🔍 SHOW COMPLETE RAW RESPONSE FOR DIAGNOSIS
        console.log('🚨 ========== LAUNCHTUBE ERROR RESPONSE ==========');
        console.log(`🌐 URL: ${this.launchtubeUrl}`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`📏 Content Length: ${errorText.length}`);
        console.log('📋 Headers:');
        for (const [key, value] of response.headers.entries()) {
          console.log(`   ${key}: ${value}`);
        }
        console.log('📄 RAW RESPONSE BODY:');
        console.log(errorText);
        console.log('🚨 =============================================');
        
        // Try to parse for structured details but keep raw response primary
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
          logger.error('🔍 PARSED ERROR OBJECT', {
            parsed_error: parsedError
          });
        } catch (e) {
          logger.error('🔍 RESPONSE IS NOT JSON', {
            parse_error: e,
            raw_text: errorText
          });
          parsedError = { error: errorText, raw_response: errorText };
        }
        
        return {
          success: false,
          error: `RAW_RESPONSE: ${errorText}`,
          details: { 
            raw_response: errorText,
            status_code: response.status,
            status_text: response.statusText,
            parsed_error: parsedError
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
        // 🔍 DEBUG: Check if we need fresh client instance for each transaction
        console.log('🔍 ========== CLIENT DEBUG INFO ==========');
        console.log(`👨‍🌾 Farmer: ${farmerPublicKey}`);
        console.log(`💰 Stake: ${stakeAmount.toString()}`);
        console.log(`📡 RPC URL: ${this.rpcUrl}`);
        console.log(`📝 Contract ID: ${this.contractId}`);
        console.log(`🌐 Network: ${this.networkPassphrase}`);
        
        // Create FRESH client instance (following reference utils.ts pattern)
        console.log('🔄 Creating fresh Client instance (no publicKey like reference)...');
        const freshContract = new Client({
          rpcUrl: this.rpcUrl,
          contractId: this.contractId,
          networkPassphrase: this.networkPassphrase,
        });
        
        console.log('✅ Fresh client created, building transaction...');
        console.log('🔍 ==========================================');

        // Create the plant transaction with fresh client
        const transaction = await freshContract.plant({
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
      } else {
        // ONLY sign and send if simulation is successful (following reference pattern)
        // Sign auth entries (following reference plant_and_work.ts pattern)
        const farmerSigner = basicNodeSigner(
          Keypair.fromSecret(farmerSecretKey), 
          this.networkPassphrase
        );

        await transaction.signAuthEntries({
          address: farmerPublicKey,
          signAuthEntry: farmerSigner.signAuthEntry,
        });

        // Submit via Launchtube (following reference send function)
        // CRITICAL: Must submit the built/signed transaction XDR, not the transaction object
        const transactionXdr = transaction.built!.toXDR();
        
        // 🔍 LOG THE XDR FOR DIAGNOSIS
        console.log('🔍 ========== TRANSACTION XDR FOR DIAGNOSIS ==========');
        console.log(`👨‍🌾 Farmer: ${farmerPublicKey}`);
        console.log(`💰 Stake: ${stakeAmount.toString()}`);
        console.log(`📏 XDR Length: ${transactionXdr.length}`);
        console.log('📜 TRANSACTION XDR:');
        console.log(transactionXdr);
        console.log('🔍 ================================================');
        
        const result = await this.submitTransaction(transactionXdr);
      
        if (result.success) {
          logger.info('Plant operation successful', {
            farmer: farmerPublicKey,
            transaction_hash: result.transactionHash,
            stake_amount: stakeAmount.toString()
          });
        }

        return result;
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

      // Create FRESH client (following reference utils.ts pattern)
      const freshContract = new Client({
        rpcUrl: this.rpcUrl,
        contractId: this.contractId,
        networkPassphrase: this.networkPassphrase,
      });

      // Create the work transaction
      const transaction = await freshContract.work({
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
      const result = await this.submitTransaction(transaction.built!.toXDR());
      
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

      // Create FRESH client (following reference utils.ts pattern)
      const freshContract = new Client({
        rpcUrl: this.rpcUrl,
        contractId: this.contractId,
        networkPassphrase: this.networkPassphrase,
      });

      // Create the harvest transaction
      const transaction = await freshContract.harvest({
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
      const result = await this.submitTransaction(transaction.built!.toXDR());
      
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