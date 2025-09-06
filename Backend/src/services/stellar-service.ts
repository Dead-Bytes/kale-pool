import { backendLogger as logger } from '../../../Shared/utils/logger';

interface StellarAccountData {
  account_id: string;
  sequence: string;
  subentry_count: number;
  balances: Array<{
    balance: string;
    limit?: string;
    buying_liabilities: string;
    selling_liabilities: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  signers: Array<{
    weight: number;
    key: string;
    type: string;
  }>;
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
  data: Record<string, string>;
  paging_token: string;
  last_modified_ledger: number;
  last_modified_time: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
}

interface StellarError {
  type: string;
  title: string;
  status: number;
  detail: string;
}

export class StellarService {
  private readonly horizonUrl: string;
  private readonly testnetUrl = 'https://horizon-testnet.stellar.org';
  private readonly mainnetUrl = 'https://horizon.stellar.org';

  constructor(useTestnet: boolean = true) {
    this.horizonUrl = useTestnet ? this.testnetUrl : this.mainnetUrl;
  }

  /**
   * Fetch account data from Stellar Horizon API
   */
  async getAccountData(accountId: string): Promise<StellarAccountData | null> {
    try {
      const response = await fetch(`${this.horizonUrl}/accounts/${accountId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          logger.warn(`Stellar account not found: ${accountId}`);
          return null;
        }
        
        const errorData = await response.json() as StellarError;
        throw new Error(`Stellar API error: ${errorData.title} - ${errorData.detail}`);
      }

      const accountData = await response.json() as StellarAccountData;
      logger.info(`Successfully fetched Stellar account data for: ${accountId}`);
      
      return accountData;
      
    } catch (error) {
      logger.error(`Failed to fetch Stellar account data for ${accountId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get XLM balance for a Stellar account
   */
  async getXLMBalance(accountId: string): Promise<number> {
    try {
      const accountData = await this.getAccountData(accountId);
      
      if (!accountData) {
        return 0;
      }

      // Find XLM balance (native asset)
      const xlmBalance = accountData.balances.find(
        balance => balance.asset_type === 'native'
      );

      return xlmBalance ? parseFloat(xlmBalance.balance) : 0;
      
    } catch (error) {
      logger.error(`Failed to get XLM balance for ${accountId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get balance for a specific asset (like KALE token)
   */
  async getAssetBalance(accountId: string, assetCode: string, assetIssuer?: string): Promise<number> {
    try {
      const accountData = await this.getAccountData(accountId);
      
      if (!accountData) {
        return 0;
      }

      // Find the specific asset balance
      const assetBalance = accountData.balances.find(balance => 
        balance.asset_code === assetCode && 
        (assetIssuer ? balance.asset_issuer === assetIssuer : true)
      );

      return assetBalance ? parseFloat(assetBalance.balance) : 0;
      
    } catch (error) {
      logger.error(`Failed to get ${assetCode} balance for ${accountId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get all balances for a Stellar account
   */
  async getAllBalances(accountId: string): Promise<{
    xlm: number;
    assets: Array<{
      code: string;
      issuer: string;
      balance: number;
    }>;
  }> {
    try {
      const accountData = await this.getAccountData(accountId);
      
      if (!accountData) {
        return { xlm: 0, assets: [] };
      }

      const xlmBalance = accountData.balances.find(
        balance => balance.asset_type === 'native'
      );

      const assetBalances = accountData.balances
        .filter(balance => balance.asset_type !== 'native')
        .map(balance => ({
          code: balance.asset_code || 'UNKNOWN',
          issuer: balance.asset_issuer || '',
          balance: parseFloat(balance.balance)
        }));

      return {
        xlm: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
        assets: assetBalances
      };
      
    } catch (error) {
      logger.error(`Failed to get all balances for ${accountId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Check if a Stellar account exists
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      const accountData = await this.getAccountData(accountId);
      return accountData !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get account creation details
   */
  async getAccountCreationInfo(accountId: string): Promise<{
    exists: boolean;
    createdAt?: string;
    lastModified?: string;
  }> {
    try {
      const accountData = await this.getAccountData(accountId);
      
      if (!accountData) {
        return { exists: false };
      }

      return {
        exists: true,
        lastModified: accountData.last_modified_time,
        // Note: Stellar doesn't provide account creation time directly
        // This would need to be fetched from the operations/transactions history
      };
      
    } catch (error) {
      logger.error(`Failed to get account creation info for ${accountId}:`, error as Error);
      return { exists: false };
    }
  }
}

// Export singleton instance
export const stellarService = new StellarService(true); // Using testnet by default