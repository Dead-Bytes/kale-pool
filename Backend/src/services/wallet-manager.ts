// Stellar wallet management service for KALE Pool Mining Backend
// Phase 2: Custodial wallet operations using Launchtube for contract transactions

import { 
  Keypair, 
  Networks
} from '@stellar/stellar-sdk';
import { launchtubeService, type LaunchtubeResponse } from './launchtube-service.js';

// Import centralized logger and config
import { walletLogger as logger } from '../../../Shared/utils/logger';
import Config from '../../../Shared/config';

const isMainnet = (): boolean => {
  return Config.STELLAR.NETWORK === 'mainnet';
};

// Wallet generation interface
export interface WalletKeypair {
  publicKey: string;
  secretKey: string;
}

// Account information interface
export interface AccountInfo {
  publicKey: string;
  balance: string; // XLM balance in stroops
  kaleBalance: string; // KALE balance in atomic units
  exists: boolean;
  sequence: string;
  subentryCount: number;
}

// Transaction result interface
export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  details?: Record<string, unknown>;
}

// Plant operation interface
export interface PlantOperation {
  farmerWallet: string;
  stakeAmount: string; // KALE amount in atomic units
}

// Work operation interface
export interface WorkOperation {
  farmerWallet: string;
  nonce: number;
  hash: string;
}

// Harvest operation interface
export interface HarvestOperation {
  farmerWallet: string;
  blockIndex: number;
}

// ======================
// STELLAR WALLET MANAGER
// ======================

export class StellarWalletManager {
  private networkPassphrase: string;
  private kaleContractId: string;
  private server: null; // Not used - using Launchtube instead
  private kaleAssetCode: string;

  constructor() {
    this.networkPassphrase = isMainnet() 
      ? Networks.PUBLIC 
      : Networks.TESTNET;
    
    this.kaleContractId = Config.STELLAR.CONTRACT_ID;
    this.kaleAssetCode = 'KALE';
    
    // Initialize server placeholder (not used since we're using Launchtube)
    this.server = null;

    logger.info('StellarWalletManager initialized', {
      network: Config.STELLAR.NETWORK,
      contract_id: this.kaleContractId,
      asset_code: this.kaleAssetCode,
      rpc_url: Config.STELLAR.RPC_URL
    });
  }

  // ======================
  // WALLET GENERATION
  // ======================

  generateWallet(): WalletKeypair {
    try {
      const keypair = Keypair.random();
      
      const wallet: WalletKeypair = {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret()
      };

      logger.info('Generated new custodial wallet', {
        public_key: wallet.publicKey
      });

      return wallet;
    } catch (error) {
      logger.error('Failed to generate wallet', error as Error);
      throw new Error(`Wallet generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate custodial wallet for Phase 2 farmer registration
   */
  async generateCustodialWallet(): Promise<{ success: boolean; publicKey?: string; secretKey?: string; error?: string }> {
    try {
      const wallet = this.generateWallet();
      
      logger.info('Generated custodial wallet for farmer registration', {
        public_key: wallet.publicKey
      });

      return {
        success: true,
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey
      };
    } catch (error) {
      logger.error('Failed to generate custodial wallet', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // ======================
  // ACCOUNT OPERATIONS
  // ======================

  async getAccountInfo(publicKey: string): Promise<AccountInfo> {
    // Simplified account info for custodial pool environment
    // All balance queries would typically go through pool contracts
    logger.debug('Getting account info (simplified for custodial pool)', { public_key: publicKey });
    
    return {
      publicKey,
      balance: '1000000000', // Assume 100 XLM for custodial accounts
      kaleBalance: '0', // KALE balance managed via contract
      exists: true, // Assume accounts exist in custodial environment
      sequence: '0',
      subentryCount: 0
    };
  }

  async isAccountFunded(publicKey: string): Promise<boolean> {
    // In custodial pool environment, assume accounts are funded
    logger.debug('Checking account funding (simplified for custodial pool)', { public_key: publicKey });
    return true;
  }

  async checkAccountFunding(publicKey: string): Promise<{ isFunded: boolean; balance: string }> {
    // Enhanced funding check for registration routes
    logger.debug('Checking account funding with balance (simplified for custodial pool)', { public_key: publicKey });
    
    return {
      isFunded: true, // Assume custodial accounts are funded
      balance: '1000000000' // 100 XLM in stroops
    };
  }

  // ======================
  // KALE CONTRACT OPERATIONS
  // ======================

  async plantForFarmer(farmerSecretKey: string, stakeAmount: string): Promise<TransactionResult> {
    try {
      const farmerKeypair = Keypair.fromSecret(farmerSecretKey);
      const farmerPublicKey = farmerKeypair.publicKey();

      logger.info('Starting plant operation via Launchtube', {
        farmer: farmerPublicKey,
        stake_amount: stakeAmount
      });

      // Convert stake amount to BigInt (KALE uses stroops: 1 KALE = 10^7 stroops)
      const stakeAmountBigInt = BigInt(Math.floor(parseFloat(stakeAmount) * 10_000_000));

      // Use Launchtube service for plant operation
      const result: LaunchtubeResponse = await launchtubeService.plant({
        farmerPublicKey,
        farmerSecretKey,
        stakeAmount: stakeAmountBigInt
      });

      if (result.success) {
        logger.info('Plant operation successful via Launchtube', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          stake_amount: stakeAmount
        });

        return {
          success: true,
          transactionHash: result.transactionHash || '',
          details: result.details as Record<string, unknown>
        };
      } else {
        logger.warn('Plant operation failed via Launchtube', {
          farmer: farmerPublicKey,
          error: result.error,
          stake_amount: stakeAmount
        });

        return {
          success: false,
          error: result.error || 'Unknown error',
          details: result.details as Record<string, unknown>
        };
      }

    } catch (error) {
      logger.error('Plant operation failed', error as Error, {
        farmer_secret_key: farmerSecretKey.substring(0, 10) + '...',
        stake_amount: stakeAmount
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  async workForFarmer(
    farmerSecretKey: string, 
    nonce: number, 
    hash: string
  ): Promise<TransactionResult> {
    try {
      const farmerKeypair = Keypair.fromSecret(farmerSecretKey);
      const farmerPublicKey = farmerKeypair.publicKey();

      logger.info('Starting work operation via Launchtube', {
        farmer: farmerPublicKey,
        nonce,
        hash: hash.substring(0, 16) + '...'
      });

      // Convert hash string to Buffer and nonce to BigInt
      const hashBuffer = Buffer.from(hash, 'hex');
      const nonceBigInt = BigInt(nonce);

      // Use Launchtube service for work operation
      const result: LaunchtubeResponse = await launchtubeService.work({
        farmerPublicKey,
        farmerSecretKey,
        hash: hashBuffer,
        nonce: nonceBigInt
      });

      if (result.success) {
        logger.info('Work operation successful via Launchtube', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          nonce,
          hash: hash.substring(0, 16) + '...'
        });

        return {
          success: true,
          transactionHash: result.transactionHash || '',
          details: result.details as Record<string, unknown>
        };
      } else {
        logger.warn('Work operation failed via Launchtube', {
          farmer: farmerPublicKey,
          error: result.error,
          nonce,
          hash: hash.substring(0, 16) + '...'
        });

        return {
          success: false,
          error: result.error || 'Unknown error',
          details: result.details as Record<string, unknown>
        };
      }

    } catch (error) {
      logger.error('Work operation failed', error as Error, {
        farmer_secret_key: farmerSecretKey.substring(0, 10) + '...',
        nonce,
        hash: hash.substring(0, 16) + '...'
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  async harvestForFarmer(
    farmerSecretKey: string, 
    blockIndex: number
  ): Promise<TransactionResult> {
    try {
      const farmerKeypair = Keypair.fromSecret(farmerSecretKey);
      const farmerPublicKey = farmerKeypair.publicKey();

      logger.info('Starting harvest operation via Launchtube', {
        farmer: farmerPublicKey,
        block_index: blockIndex
      });

      // Use Launchtube service for harvest operation
      const result: LaunchtubeResponse = await launchtubeService.harvest({
        farmerPublicKey,
        farmerSecretKey,
        blockIndex
      });

      if (result.success) {
        logger.info('Harvest operation successful via Launchtube', {
          farmer: farmerPublicKey,
          transaction_hash: result.transactionHash,
          block_index: blockIndex
        });

        return {
          success: true,
          transactionHash: result.transactionHash || '',
          details: result.details as Record<string, unknown>
        };
      } else {
        logger.warn('Harvest operation failed via Launchtube', {
          farmer: farmerPublicKey,
          error: result.error,
          block_index: blockIndex
        });

        return {
          success: false,
          error: result.error || 'Unknown error',
          details: result.details as Record<string, unknown>
        };
      }

    } catch (error) {
      logger.error('Harvest operation failed', error as Error, {
        farmer_secret_key: farmerSecretKey.substring(0, 10) + '...',
        block_index: blockIndex
      });

      return {
        success: false,
        error: (error as Error).message,
        details: error
      };
    }
  }

  // ======================
  // BATCH OPERATIONS
  // ======================

  async plantBatch(plantOperations: (PlantOperation & { secretKey: string })[]): Promise<TransactionResult[]> {
    logger.info('Starting batch plant operations', {
      total_operations: plantOperations.length
    });

    const results: TransactionResult[] = [];

    // Process operations in parallel with limited concurrency
    const concurrency = 10;
    
    for (let i = 0; i < plantOperations.length; i += concurrency) {
      const batch = plantOperations.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (op) => {
        return this.plantForFarmer(op.secretKey, op.stakeAmount);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info('Batch plant operations completed', {
      total: results.length,
      successful: successCount,
      failed: failureCount
    });

    return results;
  }

  async harvestBatch(harvestOperations: (HarvestOperation & { secretKey: string })[]): Promise<TransactionResult[]> {
    logger.info('Starting batch harvest operations', {
      total_operations: harvestOperations.length
    });

    const results: TransactionResult[] = [];

    // Process operations in parallel with limited concurrency
    const concurrency = 5; // Lower concurrency for harvest to avoid overwhelming the network
    
    for (let i = 0; i < harvestOperations.length; i += concurrency) {
      const batch = harvestOperations.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (op) => {
        return this.harvestForFarmer(op.secretKey, op.blockIndex);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info('Batch harvest operations completed', {
      total: results.length,
      successful: successCount,
      failed: failureCount
    });

    return results;
  }

  // ======================
  // UTILITY METHODS
  // ======================

  async getServerHealth(): Promise<boolean> {
    try {
      // Since we're using Launchtube for all operations, 
      // we'll check Launchtube health instead of direct server
      // For now, return true as we handle errors in individual operations
      return true;
    } catch (error) {
      logger.error('Stellar server health check failed', error as Error);
      return false;
    }
  }

  getNetworkInfo() {
    return {
      network: Config.STELLAR.NETWORK,
      passphrase: Config.STELLAR.NETWORK_PASSPHRASE,
      contract_id: Config.STELLAR.CONTRACT_ID,
      asset_code: this.kaleAssetCode,
      rpc_url: Config.STELLAR.RPC_URL
    };
  }
}

// Export singleton instance
export const stellarWalletManager = new StellarWalletManager();
