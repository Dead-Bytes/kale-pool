// Registration routes for KALE Pool Mining Backend
// Phase 2: Farmer onboarding with email validation and custodial wallet management

import type { Request, Response } from 'express';
import { stellarWalletManager } from '../services/wallet-manager';
import { 
  userQueries, 
  farmerQueriesPhase2, 
  balanceCheckQueries,
  poolStatisticsQueries,
  poolContractQueries,
  poolerQueriesPhase2
} from '../services/database-phase2';

// Import centralized logger
import { createLogger } from '../../../Shared/utils/logger';
const logger = createLogger('Registration Routes');

// ======================
// VALIDATION UTILITIES
// ======================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidStellarAddress = (address: string): boolean => {
  // Stellar public keys start with 'G' and are 56 characters
  const stellarRegex = /^G[A-Z2-7]{55}$/;
  return stellarRegex.test(address);
};

// ======================
// REGISTRATION ENDPOINTS
// ======================

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, externalWallet } = req.body;

    // Input validation
    if (!email || !externalWallet) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email and external wallet address are required'
      });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Please provide a valid email address'
      });
      return;
    }

    if (!isValidStellarAddress(externalWallet)) {
      res.status(400).json({
        error: 'INVALID_WALLET',
        message: 'Please provide a valid Stellar wallet address (starts with G, 56 characters)'
      });
      return;
    }

    logger.info('Processing user registration', { email, external_wallet: externalWallet });

    // Check if email already exists
    const existingUser = await userQueries.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists'
      });
      return;
    }

    // Generate custodial wallet
    const walletGeneration = await stellarWalletManager.generateCustodialWallet();
    
    if (!walletGeneration.success) {
      logger.error('Custodial wallet generation failed', new Error(walletGeneration.error));
      res.status(500).json({
        error: 'WALLET_GENERATION_FAILED',
        message: 'Failed to generate custodial wallet'
      });
      return;
    }

    // Create user and farmer records in transaction
    try {
      const userId = await userQueries.createUser(email, externalWallet);
      const farmerId = await farmerQueriesPhase2.createFarmerWithUser(
        userId,
        walletGeneration.publicKey!,
        walletGeneration.secretKey!,
        externalWallet
      );

      logger.info('User registration successful', {
        user_id: userId,
        farmer_id: farmerId,
        custodial_wallet: walletGeneration.publicKey
      });

      res.status(201).json({
        userId,
        custodialWallet: walletGeneration.publicKey,
        status: 'wallet_created',
        fundingRequired: true,
        message: 'Registration successful. Please fund your custodial wallet with XLM to continue.',
        createdAt: new Date().toISOString()
      });

    } catch (dbError) {
      logger.error('Database error during registration', dbError as Error);
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to complete registration'
      });
    }

  } catch (error) {
    logger.error('Registration endpoint error', error as Error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error during registration'
    });
  }
};

// ======================
// FUNDING CHECK ENDPOINTS
// ======================

export const checkFunding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        error: 'MISSING_USER_ID',
        message: 'User ID is required'
      });
      return;
    }

    logger.info('Checking funding status', { user_id: userId });

    // Get user and farmer info
    const user = await userQueries.getUserById(userId);
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const farmer = await farmerQueriesPhase2.getFarmerByUserId(userId);
    if (!farmer) {
      res.status(404).json({
        error: 'FARMER_NOT_FOUND',
        message: 'Farmer profile not found'
      });
      return;
    }

    // Check custodial wallet funding
    const fundingCheck = await stellarWalletManager.checkAccountFunding(farmer.custodial_public_key);
    
    // Record balance check
    await balanceCheckQueries.recordBalanceCheck(
      farmer.id,
      farmer.custodial_public_key,
      fundingCheck.balance,
      fundingCheck.isFunded,
      fundingCheck.isFunded ? 'funded' : 'insufficient'
    );

    // Update farmer status if newly funded
    if (fundingCheck.isFunded && farmer.status_new === 'wallet_created') {
      await farmerQueriesPhase2.updateFarmerStatus(farmer.id, 'funded');
      logger.info('Farmer status updated to funded', { farmer_id: farmer.id });
    }

    res.status(200).json({
      funded: fundingCheck.isFunded,
      balance: fundingCheck.balance?.toString() || '0',
      status: fundingCheck.isFunded ? 'funded' : 'insufficient',
      message: fundingCheck.isFunded 
        ? 'Wallet is funded and ready for pool participation' 
        : 'Please send XLM to your custodial wallet to continue',
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Funding check endpoint error', error as Error);
    res.status(500).json({
      error: 'FUNDING_CHECK_FAILED',
      message: 'Failed to check wallet funding status'
    });
  }
};

// ======================
// USER STATUS ENDPOINT
// ======================

export const getUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await userQueries.getUserById(userId);
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const farmer = await farmerQueriesPhase2.getFarmerByUserId(userId);
    if (!farmer) {
      res.status(404).json({
        error: 'FARMER_NOT_FOUND', 
        message: 'Farmer profile not found'
      });
      return;
    }

    // Get active pool contract if any
    const activeContract = await poolContractQueries.getActiveContractByFarmer(farmer.id);
    
    // Get latest balance check
    const latestBalanceCheck = await balanceCheckQueries.getLatestBalanceCheck(farmer.id);

    res.status(200).json({
      userId: user.id,
      email: user.email,
      externalWallet: user.external_wallet,
      userStatus: user.status,
      custodialWallet: farmer.custodial_public_key,
      farmerStatus: farmer.status_new,
      currentBalance: farmer.current_balance || '0',
      isFunded: latestBalanceCheck?.is_funded || false,
      lastBalanceCheck: latestBalanceCheck?.checked_at || null,
      poolContract: activeContract ? {
        contractId: activeContract.id,
        poolerId: activeContract.pooler_id,
        stakePercentage: activeContract.stake_percentage,
        harvestInterval: activeContract.harvest_interval,
        status: activeContract.status,
        joinedAt: activeContract.confirmed_at
      } : null,
      createdAt: user.created_at,
      fundedAt: farmer.funded_at,
      joinedPoolAt: farmer.joined_pool_at
    });

  } catch (error) {
    logger.error('Get user status endpoint error', error as Error);
    res.status(500).json({
      error: 'STATUS_CHECK_FAILED',
      message: 'Failed to retrieve user status'
    });
  }
};

// ======================
// POOL DISCOVERY ENDPOINTS
// ======================

export const getAvailablePoolers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        error: 'MISSING_USER_ID',
        message: 'User ID is required for access control'
      });
      return;
    }

    // Verify user is funded
    const user = await userQueries.getUserById(userId as string);
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const farmer = await farmerQueriesPhase2.getFarmerByUserId(userId as string);
    if (!farmer || farmer.status_new === 'wallet_created') {
      res.status(403).json({
        error: 'INSUFFICIENT_FUNDING',
        message: 'Please fund your wallet before viewing available pools'
      });
      return;
    }

    // Get available poolers with statistics
    const poolers = await poolStatisticsQueries.getAvailablePoolers();

    res.status(200).json({
      poolers: poolers.map(pooler => ({
        id: pooler.id,
        name: pooler.name,
        rewardPercentage: Number(pooler.reward_percentage),
        currentFarmers: pooler.current_farmers,
        maxFarmers: pooler.max_farmers,
        successRate: Number(pooler.success_rate),
        avgRewardPerBlock: Number(pooler.avg_reward_per_block),
        status: pooler.current_farmers >= pooler.max_farmers ? 'full' : 'active',
        blocksParticipated: pooler.blocks_participated,
        lastSeen: pooler.last_seen
      }))
    });

  } catch (error) {
    logger.error('Get poolers endpoint error', error as Error);
    res.status(500).json({
      error: 'POOLER_FETCH_FAILED',
      message: 'Failed to retrieve available poolers'
    });
  }
};

export const getPoolerDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { poolerId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        error: 'MISSING_USER_ID',
        message: 'User ID is required for access control'
      });
      return;
    }

    // Verify user is funded
    const farmer = await farmerQueriesPhase2.getFarmerByUserId(userId as string);
    if (!farmer || farmer.status_new === 'wallet_created') {
      res.status(403).json({
        error: 'INSUFFICIENT_FUNDING',
        message: 'Please fund your wallet before viewing pool details'
      });
      return;
    }

    // Get pooler details and performance stats
    const poolerStats = await poolStatisticsQueries.getPoolerDetails(poolerId);
    if (!poolerStats) {
      res.status(404).json({
        error: 'POOLER_NOT_FOUND',
        message: 'Pooler not found'
      });
      return;
    }

    const performanceStats = await poolStatisticsQueries.getPoolerPerformanceStats(poolerId, 30);
    const poolerSettings = await poolerQueriesPhase2.getPoolerWithSettings(poolerId);

    res.status(200).json({
      id: poolerStats.id,
      name: poolerStats.name,
      rewardPercentage: Number(poolerStats.reward_percentage),
      currentFarmers: poolerStats.current_farmers,
      maxFarmers: poolerStats.max_farmers,
      status: poolerStats.status,
      performance: {
        blocksParticipated: Number(performanceStats.blocks_participated),
        avgPlantSuccessRate: Number(performanceStats.avg_plant_success_rate),
        avgWorkSuccessRate: Number(performanceStats.avg_work_success_rate),
        avgHarvestSuccessRate: Number(performanceStats.avg_harvest_success_rate),
        totalRewardsDistributed: Number(performanceStats.total_rewards_distributed),
        avgRewardPerFarmer: Number(performanceStats.avg_reward_per_farmer)
      },
      terms: poolerSettings?.terms || {},
      platformFee: 0.05,
      lastSeen: poolerStats.last_seen
    });

  } catch (error) {
    logger.error('Get pooler details endpoint error', error as Error);
    res.status(500).json({
      error: 'POOLER_DETAILS_FAILED',
      message: 'Failed to retrieve pooler details'
    });
  }
};

// ======================
// POOL JOINING ENDPOINTS
// ======================

export const joinPool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, poolerId, stakePercentage, harvestInterval } = req.body;

    // Input validation
    if (!userId || !poolerId || stakePercentage === undefined || !harvestInterval) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'userId, poolerId, stakePercentage, and harvestInterval are required'
      });
      return;
    }

    if (stakePercentage < 0 || stakePercentage > 1.0) {
      res.status(400).json({
        error: 'INVALID_STAKE_PERCENTAGE',
        message: 'Stake percentage must be between 0 (0%) and 1.0 (100%)'
      });
      return;
    }

    if (harvestInterval < 1 || harvestInterval > 20) {
      res.status(400).json({
        error: 'INVALID_HARVEST_INTERVAL',
        message: 'Harvest interval must be between 1 and 20 blocks'
      });
      return;
    }

    logger.info('Processing pool join request', { 
      user_id: userId, 
      pooler_id: poolerId,
      stake_percentage: stakePercentage,
      harvest_interval: harvestInterval
    });

    // Verify user and farmer exist and are funded
    const user = await userQueries.getUserById(userId);
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const farmer = await farmerQueriesPhase2.getFarmerByUserId(userId);
    if (!farmer) {
      res.status(404).json({
        error: 'FARMER_NOT_FOUND',
        message: 'Farmer profile not found'
      });
      return;
    }

    if (!farmer.is_funded) {
      res.status(403).json({
        error: 'FARMER_NOT_FUNDED',
        message: 'Please fund your wallet before joining a pool'
      });
      return;
    }

    // Check if farmer already has active contract
    const existingContract = await poolContractQueries.getActiveContractByFarmer(farmer.id);
    if (existingContract) {
      res.status(409).json({
        error: 'ALREADY_IN_POOL',
        message: 'Farmer already has an active pool contract'
      });
      return;
    }

    // Verify pooler exists and has capacity
    const pooler = await poolerQueriesPhase2.getPoolerWithSettings(poolerId);
    if (!pooler) {
      res.status(404).json({
        error: 'POOLER_NOT_FOUND',
        message: 'Pooler not found'
      });
      return;
    }

    if (pooler.current_farmers >= pooler.max_farmers) {
      res.status(409).json({
        error: 'POOLER_FULL',
        message: 'Pooler has reached maximum capacity'
      });
      return;
    }

    // Create pool contract
    const contractTerms = {
      pooler_name: pooler.name,
      reward_split: pooler.reward_percentage,
      platform_fee: 0.05,
      exit_delay: 24,
      created_by: 'farmer_request'
    };

    const contractId = await poolContractQueries.createPoolContract(
      farmer.id,
      poolerId,
      stakePercentage,
      harvestInterval,
      pooler.reward_percentage,
      0.05,
      contractTerms
    );

    logger.info('Pool contract created', { contract_id: contractId, farmer_id: farmer.id, pooler_id: poolerId });

    res.status(201).json({
      contractId,
      terms: {
        rewardSplit: Number(pooler.reward_percentage),
        platformFee: 0.05,
        stakePercentage,
        harvestInterval,
        exitDelay: 24
      },
      requiresConfirmation: true,
      message: 'Pool contract created. Please confirm to activate.',
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Join pool endpoint error', error as Error);
    res.status(500).json({
      error: 'JOIN_POOL_FAILED',
      message: 'Failed to join pool'
    });
  }
};

export const confirmPoolJoin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contractId, confirmed } = req.body;

    if (!contractId || confirmed === undefined) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'contractId and confirmed are required'
      });
      return;
    }

    if (!confirmed) {
      res.status(400).json({
        error: 'CONTRACT_REJECTED',
        message: 'Contract was not confirmed by farmer'
      });
      return;
    }

    logger.info('Processing pool contract confirmation', { contract_id: contractId });

    // Get contract details
    const contract = await poolContractQueries.getPoolContract(contractId);
    if (!contract) {
      res.status(404).json({
        error: 'CONTRACT_NOT_FOUND',
        message: 'Pool contract not found'
      });
      return;
    }

    if (contract.status !== 'pending') {
      res.status(409).json({
        error: 'CONTRACT_NOT_PENDING',
        message: `Contract is already ${contract.status}`
      });
      return;
    }

    // Confirm contract and update farmer status
    await poolContractQueries.confirmPoolContract(contractId);
    await farmerQueriesPhase2.updateFarmerStatus(contract.farmer_id, 'active_in_pool');

    logger.info('Pool contract confirmed', { 
      contract_id: contractId,
      farmer_id: contract.farmer_id,
      pooler_id: contract.pooler_id
    });

    res.status(200).json({
      status: 'active_in_pool',
      message: 'Successfully joined pool! You will participate in the next block.',
      joinedAt: new Date().toISOString(),
      nextBlockParticipation: true
    });

  } catch (error) {
    logger.error('Confirm pool join endpoint error', error as Error);
    res.status(500).json({
      error: 'CONFIRM_JOIN_FAILED',
      message: 'Failed to confirm pool join'
    });
  }
};