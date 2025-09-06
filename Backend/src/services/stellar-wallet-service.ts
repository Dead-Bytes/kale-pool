import { backendLogger as logger } from '../../../Shared/utils/logger';

async function getWalletBalance(publicKey: string) {
  try {
    logger.info(`Fetching wallet balance for: ${publicKey}`);
    
    const response = await fetch(`https://horizon.stellar.org/accounts/${publicKey}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        logger.info(`Account not found: ${publicKey}`);
        return { 
          error: 'Account not found - not funded yet',
          accountExists: false,
          xlm: '0',
          kale: '0'
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const accountData = await response.json();
    
    // XLM balance
    const xlmBalance = accountData.balances.find((b: any) => b.asset_type === 'native');
    
    // KALE balance  
    const kaleBalance = accountData.balances.find((b: any) => 
      b.asset_type !== 'native' && 
      b.asset_code === 'KALE'
    );
    
    const result = {
      xlm: xlmBalance?.balance || '0',
      kale: kaleBalance?.balance || '0',
      sequence: accountData.sequence,
      accountExists: true,
      allBalances: accountData.balances
    };

    logger.info(`Successfully fetched wallet balance for ${publicKey}:`, {
      xlmBalance: result.xlm,
      kaleBalance: result.kale,
      totalBalances: accountData.balances.length
    });

    return result;
    
  } catch (error: any) {
    logger.error(`Error fetching wallet balance for ${publicKey}:`, {
      error: error.message
    });
    
    throw error;
  }
}

export { getWalletBalance };