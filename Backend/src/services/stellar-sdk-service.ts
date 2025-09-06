import { Horizon } from '@stellar/stellar-sdk';
import { backendLogger as logger } from '../../../Shared/utils/logger';

interface WalletBalance {
  xlm: string;
  kale: string;
  sequence: string;
  accountExists: boolean;
  lastModified: string;
  allBalances: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
  }>;
}

interface WalletError {
  error: string;
  accountExists: boolean;
}

export class StellarSDKService {
  private readonly server: Horizon.Server;
  private readonly isTestnet: boolean;

  constructor(useTestnet: boolean = true) {
    this.isTestnet = useTestnet;
    const horizonUrl = useTestnet 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
    
    this.server = new Horizon.Server(horizonUrl);
    
    logger.info(`Stellar SDK Service initialized`, {
      network: useTestnet ? 'testnet' : 'mainnet',
      horizonUrl
    });
  }

  /**
   * Get comprehensive wallet balance information using Stellar SDK
   */
  async getWalletBalance(publicKey: string): Promise<WalletBalance | WalletError> {
    try {
      logger.info(`Fetching wallet balance for: ${publicKey}`);
      
      // Validate the public key format first
      if (!publicKey || publicKey.length !== 56 || !publicKey.startsWith('G')) {
        logger.warn(`Invalid Stellar public key format: ${publicKey}`);
        return {
          error: 'Invalid Stellar public key format',
          accountExists: false
        };
      }
      
      // Use Stellar SDK to get account data
      const account = await this.server.loadAccount(publicKey);
      
      logger.info(`Successfully retrieved account data for: ${publicKey}`, {
        balanceCount: account.balances.length,
        sequence: account.sequenceNumber(),
        accountId: account.accountId()
      });

      // Find XLM balance (native asset)
      const xlmBalance = account.balances.find(b => b.asset_type === 'native');
      
      // Find KALE balance (custom asset)
      const kaleBalance = account.balances.find((b: any) => 
        b.asset_type !== 'native' && 
        b.asset_code === 'KALE'
      );

      // Log balance details
      logger.info(`Balance details for ${publicKey}`, {
        xlmBalance: xlmBalance?.balance || '0',
        kaleBalance: kaleBalance?.balance || '0',
        totalAssets: account.balances.length
      });

      const result: WalletBalance = {
        xlm: xlmBalance?.balance || '0',
        kale: kaleBalance?.balance || '0',
        sequence: account.sequenceNumber(),
        accountExists: true,
        lastModified: account.last_modified_time || new Date().toISOString(),
        allBalances: account.balances.map((balance: any) => ({
          asset_type: balance.asset_type,
          asset_code: balance.asset_code,
          asset_issuer: balance.asset_issuer,
          balance: balance.balance
        }))
      };

      return result;

    } catch (error: any) {
      // Handle account not found (404) - means account hasn't been funded yet
      if (error.response?.status === 404) {
        logger.warn(`Account not found: ${publicKey} - not funded yet`);
        return {
          error: 'Account not found - not funded yet',
          accountExists: false
        };
      }

      // Handle other errors
      logger.error(`Failed to fetch wallet balance for ${publicKey}:`, error);
      
      return {
        error: `Failed to fetch wallet data: ${error.message || 'Unknown error'}`,
        accountExists: false
      };
    }
  }

  /**
   * Check if an account exists on the Stellar network
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      // For other errors, we can't determine if account exists
      logger.error(`Error checking account existence for ${publicKey}:`, error);
      return false;
    }
  }

  /**
   * Get account creation info and statistics
   */
  async getAccountInfo(publicKey: string): Promise<{
    exists: boolean;
    sequence?: string;
    lastModified?: string;
    signerCount?: number;
    dataEntryCount?: number;
    balanceCount?: number;
    flags?: {
      auth_required: boolean;
      auth_revocable: boolean;
      auth_immutable: boolean;
    };
  }> {
    try {
      const account = await this.server.loadAccount(publicKey);
      
      return {
        exists: true,
        sequence: account.sequenceNumber(),
        lastModified: account.last_modified_time,
        signerCount: account.signers.length,
        dataEntryCount: Object.keys(account.data).length,
        balanceCount: account.balances.length,
        flags: {
          auth_required: account.flags.auth_required,
          auth_revocable: account.flags.auth_revocable,
          auth_immutable: account.flags.auth_immutable,
        }
      };
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      logger.error(`Error getting account info for ${publicKey}:`, error);
      return { exists: false };
    }
  }

  /**
   * Get only XLM balance (for lighter requests)
   */
  async getXLMBalance(publicKey: string): Promise<{ balance: string; exists: boolean; error?: string }> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const xlmBalance = account.balances.find(b => b.asset_type === 'native');
      
      return {
        balance: xlmBalance?.balance || '0',
        exists: true
      };
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          balance: '0',
          exists: false,
          error: 'Account not found'
        };
      }
      
      return {
        balance: '0',
        exists: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Get network info
   */
  getNetworkInfo() {
    return {
      network: this.isTestnet ? 'testnet' : 'mainnet',
      horizonUrl: this.isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
    };
  }
}

// Export singleton instances
export const stellarSDKService = new StellarSDKService(true); // Testnet
export const stellarSDKMainnet = new StellarSDKService(false); // Mainnet