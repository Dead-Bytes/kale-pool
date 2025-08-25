// Stellar wallet management service for KALE Pool Mining Backend
// Phase 1: Custodial wallet operations using Stellar SDK

import { 
  Keypair, 
  Account, 
  TransactionBuilder, 
  Operation, 
  Asset, 
  Networks,
  BASE_FEE,
  Horizon
} from '@stellar/stellar-sdk';

// Use Horizon.Server instead of Server
const Server = Horizon.Server;

// Logger implementation
class WalletLogger {
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
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${new Date().toISOString()}] DEBUG [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
    }
  }
}

const logger = new WalletLogger('WalletManager');

// Configuration helpers
const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

const isMainnet = (): boolean => {
  const network = process.env.STELLAR_NETWORK || 'TESTNET';
  return network.toUpperCase() === 'PUBLIC' || network.toUpperCase() === 'MAINNET';
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
  details?: any;
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
  private server: Server;
  private networkPassphrase: string;
  private kaleContractId: string;
  private kaleAssetCode: string;

  constructor() {
    const rpcUrl = getRequiredEnvVar('RPC_URL');
    this.server = new Server(rpcUrl);
    
    this.networkPassphrase = isMainnet() 
      ? Networks.PUBLIC 
      : Networks.TESTNET;
    
    this.kaleContractId = getRequiredEnvVar('KALE_CONTRACT_ID');
    
    // Set KALE asset based on network
    if (isMainnet()) {
      this.kaleAssetCode = 'KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE';
    } else {
      this.kaleAssetCode = 'KALE:GCHPTWXMT3HYF4RLZHWBNRF4MPXLTJ76ISHMSYIWCCDXWUYOQG5MR2AB';
    }

    logger.info('StellarWalletManager initialized', {
      network: isMainnet() ? 'MAINNET' : 'TESTNET',
      rpc_url: rpcUrl,
      contract_id: this.kaleContractId
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

  // ======================
  // ACCOUNT OPERATIONS
  // ======================

  async getAccountInfo(publicKey: string): Promise<AccountInfo> {
    try {
      const account = await this.server.loadAccount(publicKey);
      
      // Get XLM balance
      const xlmBalance = account.balances.find(balance => balance.asset_type === 'native');
      const xlmBalanceStroops = xlmBalance ? xlmBalance.balance : '0';

      // Get KALE balance
      const kaleBalance = account.balances.find(balance => 
        balance.asset_type === 'credit_alphanum4' && 
        balance.asset_code === 'KALE'
      );
      const kaleBalanceAmount = kaleBalance ? kaleBalance.balance : '0';

      const accountInfo: AccountInfo = {
        publicKey,
        balance: (parseFloat(xlmBalanceStroops) * 10_000_000).toString(), // Convert to stroops
        kaleBalance: (parseFloat(kaleBalanceAmount) * 10_000_000).toString(), // Convert to atomic units
        exists: true,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentryCount
      };

      logger.debug('Retrieved account info', {
        public_key: publicKey,
        xlm_balance: accountInfo.balance,
        kale_balance: accountInfo.kaleBalance,
        subentries: accountInfo.subentryCount
      });

      return accountInfo;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        // Account doesn't exist
        logger.debug('Account not found', { public_key: publicKey });
        
        return {
          publicKey,
          balance: '0',
          kaleBalance: '0',
          exists: false,
          sequence: '0',
          subentryCount: 0
        };
      }

      logger.error('Failed to load account', error as Error, { public_key: publicKey });
      throw new Error(`Failed to load account ${publicKey}: ${(error as Error).message}`);
    }
  }

  async isAccountFunded(publicKey: string): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(publicKey);
      const minBalance = 10_000_000; // 1 XLM minimum
      
      return accountInfo.exists && parseInt(accountInfo.balance) >= minBalance;
    } catch (error) {
      logger.error('Failed to check account funding', error as Error, { public_key: publicKey });
      return false;
    }
  }

  // ======================
  // KALE CONTRACT OPERATIONS
  // ======================

  async plantForFarmer(farmerSecretKey: string, stakeAmount: string): Promise<TransactionResult> {
    try {
      const farmerKeypair = Keypair.fromSecret(farmerSecretKey);
      const farmerPublicKey = farmerKeypair.publicKey();

      logger.info('Starting plant operation', {
        farmer: farmerPublicKey,
        stake_amount: stakeAmount
      });

      // Load farmer account
      const farmerAccount = await this.server.loadAccount(farmerPublicKey);

      // Create plant operation (using contract invoke)
      const plantOp = Operation.invokeContract({
        contract: this.kaleContractId,
        function: 'plant',
        args: [
          // Convert stake amount to contract format
          // TODO: Implement proper XDR encoding for KALE contract
        ]
      });

      // Build transaction
      const transaction = new TransactionBuilder(farmerAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(plantOp)
        .setTimeout(180)
        .build();

      // Sign transaction
      transaction.sign(farmerKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(transaction);

      logger.info('Plant operation successful', {
        farmer: farmerPublicKey,
        transaction_hash: result.hash,
        stake_amount: stakeAmount
      });

      return {
        success: true,
        transactionHash: result.hash,
        details: result
      };

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

      logger.info('Starting work operation', {
        farmer: farmerPublicKey,
        nonce,
        hash: hash.substring(0, 16) + '...'
      });

      // Load farmer account
      const farmerAccount = await this.server.loadAccount(farmerPublicKey);

      // Create work operation (using contract invoke)
      const workOp = Operation.invokeContract({
        contract: this.kaleContractId,
        function: 'work',
        args: [
          // TODO: Implement proper XDR encoding for KALE contract
          // nonce, hash parameters
        ]
      });

      // Build transaction
      const transaction = new TransactionBuilder(farmerAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(workOp)
        .setTimeout(180)
        .build();

      // Sign transaction
      transaction.sign(farmerKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(transaction);

      logger.info('Work operation successful', {
        farmer: farmerPublicKey,
        transaction_hash: result.hash,
        nonce,
        hash
      });

      return {
        success: true,
        transactionHash: result.hash,
        details: result
      };

    } catch (error) {
      logger.error('Work operation failed', error as Error, {
        farmer_secret_key: farmerSecretKey.substring(0, 10) + '...',
        nonce,
        hash
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

      logger.info('Starting harvest operation', {
        farmer: farmerPublicKey,
        block_index: blockIndex
      });

      // Load farmer account
      const farmerAccount = await this.server.loadAccount(farmerPublicKey);

      // Create harvest operation (using contract invoke)
      const harvestOp = Operation.invokeContract({
        contract: this.kaleContractId,
        function: 'harvest',
        args: [
          // TODO: Implement proper XDR encoding for KALE contract
          // blockIndex parameter
        ]
      });

      // Build transaction
      const transaction = new TransactionBuilder(farmerAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(harvestOp)
        .setTimeout(180)
        .build();

      // Sign transaction
      transaction.sign(farmerKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(transaction);

      logger.info('Harvest operation successful', {
        farmer: farmerPublicKey,
        transaction_hash: result.hash,
        block_index: blockIndex
      });

      return {
        success: true,
        transactionHash: result.hash,
        details: result
      };

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
      await this.server.ledgers().limit(1).call();
      return true;
    } catch (error) {
      logger.error('Stellar server health check failed', error as Error);
      return false;
    }
  }

  getNetworkInfo() {
    return {
      network: isMainnet() ? 'MAINNET' : 'TESTNET',
      passphrase: this.networkPassphrase,
      contract_id: this.kaleContractId,
      asset_code: this.kaleAssetCode,
      rpc_url: this.server.serverURL
    };
  }
}

// Export singleton instance
export const stellarWalletManager = new StellarWalletManager();
