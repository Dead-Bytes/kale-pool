// Work Submission Service for KALE Pool Mining Pooler
// Direct smart contract work submission using Launchtube (like reference implementation)

import { Contract, Address, nativeToScVal } from '@stellar/stellar-sdk';
import { AssembledTransaction } from '@stellar/stellar-sdk/contract';
import { Client } from 'kale-sc-sdk';
import Config from '../../../Shared/config';
import { blockMonitorLogger as logger } from '../../../Shared/utils/logger';

// Work submission interfaces
export interface WorkSubmissionRequest {
  farmerPublicKey: string;
  hash: Uint8Array;
  nonce: bigint;
}

export interface WorkSubmissionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  details?: any;
}

/**
 * Work Submission Service - Direct smart contract interaction via Launchtube
 * Following the same pattern as the reference kale-farmer implementation
 */
export class WorkSubmissionService {
  private contract: Client;
  private launchtubeUrl: string;
  private launchtubeJwt: string;

  constructor() {
    // Initialize contract client (same as reference)
    this.contract = new Client({
      rpcUrl: Config.STELLAR.RPC_URL,
      contractId: Config.STELLAR.CONTRACT_ID,
      networkPassphrase: Config.STELLAR.NETWORK_PASSPHRASE,
    });
    
    // Get Launchtube configuration from shared config
    this.launchtubeUrl = Config.LAUNCHTUBE.URL;
    this.launchtubeJwt = Config.LAUNCHTUBE.JWT;
    
    logger.info('Work Submission Service initialized', {
      rpc_url: Config.STELLAR.RPC_URL,
      contract_id: Config.STELLAR.CONTRACT_ID,
      network: Config.STELLAR.NETWORK,
      launchtube_url: this.launchtubeUrl
    });
  }

  /**
   * Submit work to smart contract via Launchtube (following reference pattern)
   */
  async submitWork(request: WorkSubmissionRequest): Promise<WorkSubmissionResult> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds between retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { farmerPublicKey, hash, nonce } = request;
        
        logger.info(`Submitting work to smart contract via Launchtube (attempt ${attempt}/${maxRetries})`, {
          farmer: farmerPublicKey,
          nonce: nonce.toString(),
          hash: Buffer.from(hash.subarray(0, 4)).toString('hex') + '...',
          contract: Config.STELLAR.CONTRACT_ID,
          attempt: attempt
        });

        // Build work transaction (same as reference)
        const transaction = await this.contract.work({
          farmer: farmerPublicKey,
          hash: Buffer.from(hash),
          nonce: nonce,
        });

        // Check for simulation errors (same as reference)
        if (transaction.simulation && 'error' in transaction.simulation) {
          const errorMessage = transaction.simulation.error;
          logger.error('Work simulation failed', undefined, {
            farmer: farmerPublicKey,
            error: errorMessage,
            nonce: nonce.toString(),
            attempt: attempt
          });
          
          return {
            success: false,
            error: `Simulation failed: ${errorMessage}`,
            details: { simulation_error: errorMessage, attempts: attempt }
          };
        }

        // Submit via Launchtube with retry logic
        const result = await this.sendViaLaunchtubeWithRetry(transaction, attempt);
        
        logger.info('Work submitted successfully via Launchtube', {
          farmer: farmerPublicKey,
          nonce: nonce.toString(),
          transaction_hash: result.transactionHash,
          contract: Config.STELLAR.CONTRACT_ID,
          attempts: attempt
        });

        return {
          success: true,
          transactionHash: result.transactionHash,
          details: { ...result, attempts: attempt }
        };

      } catch (error) {
        const errorMessage = (error as Error).message;
        const isRetryableError = this.isRetryableError(errorMessage);
        
        logger.error(`Work submission failed (attempt ${attempt}/${maxRetries})`, error as Error, {
          farmer: request.farmerPublicKey,
          nonce: request.nonce.toString(),
          contract: Config.STELLAR.CONTRACT_ID,
          attempt: attempt,
          is_retryable: isRetryableError
        });

        // If this is the last attempt or error is not retryable, return failure
        if (attempt === maxRetries || !isRetryableError) {
          return {
            success: false,
            error: errorMessage,
            details: { error, attempts: attempt, final_attempt: true }
          };
        }

        // Wait before retry
        logger.info(`Retrying work submission in ${retryDelay}ms`, {
          farmer: request.farmerPublicKey,
          nonce: request.nonce.toString(),
          attempt: attempt,
          next_attempt: attempt + 1
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // Should never reach here, but just in case
    return {
      success: false,
      error: 'Maximum retry attempts exceeded',
      details: { attempts: maxRetries }
    };
  }

  /**
   * Send transaction via Launchtube with retry support
   */
  private async sendViaLaunchtubeWithRetry(transaction: any, attempt: number): Promise<any> {
    try {
      return await this.sendViaLaunchtube(transaction);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Log the specific Launchtube error for debugging
      if (errorMessage.includes('NOT_FOUND')) {
        logger.warn(`Launchtube NOT_FOUND error (attempt ${attempt}) - transaction may need more time`, {
          attempt: attempt,
          error_preview: errorMessage.substring(0, 200) + '...'
        });
      }
      
      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryableErrors = [
      'NOT_FOUND',           // Transaction not found in ledger
      'timeout',             // Network timeout
      'ECONNRESET',          // Connection reset
      'ENOTFOUND',           // DNS resolution failed
      'ETIMEDOUT',           // Request timeout
      'fetch failed',        // General fetch failure
      'network error'        // Network related errors
    ];
    
    return retryableErrors.some(error => 
      errorMessage.toLowerCase().includes(error.toLowerCase())
    );
  }

  /**
   * Send transaction via Launchtube (following reference implementation)
   */
  private async sendViaLaunchtube(transaction: any): Promise<any> {
    const data = new FormData();
    
    // Convert to XDR (same as reference)
    const xdr = transaction.built!.toXDR();
    data.set('xdr', xdr);

    // Submit to Launchtube (same as reference)
    const response = await fetch(this.launchtubeUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.launchtubeJwt}`,
        'X-Client-Name': 'kale-pool-pooler',
        'X-Client-Version': '1.0.0'
      },
      body: data
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorText = await response.text();
      throw new Error(`Launchtube submission failed: ${errorText}`);
    }
  }

  /**
   * Health check for the work submission service
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if we can reach Launchtube
      const response = await fetch(this.launchtubeUrl + '/health', {
        headers: {
          authorization: `Bearer ${this.launchtubeJwt}`
        }
      });
      return response.ok;
    } catch (error) {
      logger.error('Work submission service health check failed', error as Error);
      return false;
    }
  }
}
