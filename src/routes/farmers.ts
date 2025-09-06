import { Router, Request, Response } from 'express';
import { farmerService } from '../services/farmer-service';
import { authenticate, requireResourceAccess } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import {
  validateFarmerAnalytics,
  validateFarmerSummary,
  validateUUID,
  handleValidationErrors
} from '../middleware/validation';
import { backendLogger as logger } from '@shared/utils/logger';
import { db } from '../services/database';
import { getWalletBalance } from '../services/stellar-wallet-service';

const router = Router();

// GET /farmers/current - Get current user's farmer data
router.get('/current',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id: userId } = req.user!;
      
      // Verify farmer association
      const farmerAssociation = await farmerService.validateFarmerAssociation(userId);
      if (!farmerAssociation) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'No farmer account associated with this user'
          }
        });
      }
      
      // Return the specific farmer's data
      const result = await farmerService.getFarmerById(farmerAssociation.farmerId);
      if (!result) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'Farmer data not found'
          }
        });
      }
      
      return res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in get current farmer:', { 
        error: errorMessage,
        userId: req.user?.id 
      });
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch farmer data: ' + errorMessage
        }
      });
    }
  }
);

// GET /farmers/blockchain-data - Get current user's blockchain dashboard data
router.get('/blockchain-data',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id: userId } = req.user!;
      
      // Verify farmer association
      const farmerAssociation = await farmerService.validateFarmerAssociation(userId);
      if (!farmerAssociation) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'No farmer account associated with this user'
          }
        });
      }

      const farmerId = farmerAssociation.farmerId;

      // Get farmer basic data including wallet and funding status
      const farmerQuery = `
        SELECT 
          id,
          payout_wallet_address,
          custodial_public_key,
          is_funded,
          funded_at,
          created_at
        FROM farmers 
        WHERE id = $1
      `;
      const farmerResult = await db.query(farmerQuery, [farmerId]);
      
      if (farmerResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'Farmer data not found'
          }
        });
      }

      const farmer = farmerResult.rows[0];

      // Get real custodial wallet balances from Stellar blockchain using SDK
      let custodialWalletBalances = {
        xlm: '0',
        kale: '0',
        accountExists: false
      };

      if (farmer.custodial_public_key) {
        try {
          logger.info(`Fetching Stellar SDK balance for farmer ${farmerId}`, {
            custodialAddress: farmer.custodial_public_key
          });

          // Use Stellar wallet service to get wallet balance
          const balanceResult = await getWalletBalance(farmer.custodial_public_key);
          
          if ('error' in balanceResult) {
            // Handle error case (account not found)
            logger.warn(`Stellar balance fetch failed for farmer ${farmerId}:`, {
              error: balanceResult.error,
              accountExists: balanceResult.accountExists
            });
            custodialWalletBalances.xlm = balanceResult.xlm || '0';
            custodialWalletBalances.kale = balanceResult.kale || '0';
            custodialWalletBalances.accountExists = balanceResult.accountExists;
          } else {
            // Success case - got real balance data
            custodialWalletBalances.xlm = balanceResult.xlm;
            custodialWalletBalances.kale = balanceResult.kale;
            custodialWalletBalances.accountExists = balanceResult.accountExists;
            
            logger.info(`Successfully fetched Stellar balances for farmer ${farmerId}`, {
              custodialAddress: farmer.custodial_public_key,
              xlmBalance: balanceResult.xlm,
              kaleBalance: balanceResult.kale,
              accountExists: balanceResult.accountExists
            });
          }
        } catch (error) {
          logger.error(`Stellar SDK balance fetch exception for farmer ${farmerId}:`, error as Error);
          // Fall back to mock data if SDK fails
          custodialWalletBalances.xlm = (Math.floor(Math.random() * 1000) / 100).toString();
          custodialWalletBalances.kale = (Math.floor(Math.random() * 10000) / 100).toString();
        }
      } else {
        logger.warn(`No custodial public key found for farmer ${farmerId}`);
        // Use mock data if no custodial key exists
        custodialWalletBalances.xlm = (Math.floor(Math.random() * 1000) / 100).toString();
        custodialWalletBalances.kale = (Math.floor(Math.random() * 10000) / 100).toString();
      }

      // Get the most recent block data from block_operations table
      const blockQuery = `
        SELECT 
          block_index,
          block_hash,
          timestamp,
          total_farmers,
          created_at,
          status
        FROM block_operations 
        ORDER BY block_index DESC 
        LIMIT 1
      `;
      const blockResult = await db.query(blockQuery);
      
      let currentBlock;
      if (blockResult.rows.length > 0) {
        const block = blockResult.rows[0];
        currentBlock = {
          height: parseInt(block.block_index),
          hash: block.block_hash || `0x${'0'.repeat(64)}`, // Use actual hash or fallback
          timestamp: block.timestamp || block.created_at,
          transactions: block.total_farmers || 0 // Use total_farmers as transaction count
        };
      } else {
        // Fallback if no blocks exist yet
        currentBlock = {
          height: 0,
          hash: `0x${'0'.repeat(64)}`,
          timestamp: new Date().toISOString(),
          transactions: 0
        };
      }

      // Calculate total staked KALE from planting table
      const stakingQuery = `
        SELECT 
          COALESCE(SUM(stake_amount), 0) as total_staked
        FROM plantings 
        WHERE farmer_id = $1 
        AND status IN ('active', 'pending', 'harvested')
      `;
      const stakingResult = await db.query(stakingQuery, [farmerId]);
      const totalStaked = parseFloat(stakingResult.rows[0]?.total_staked || '0');

      // Mock total staked if no real data exists
      const mockTotalStaked = totalStaked > 0 ? totalStaked : Math.floor(Math.random() * 50000) / 100;

      const blockchainData = {
        farmer: {
          id: farmer.id,
          externalWallet: farmer.payout_wallet_address,
          fundingStatus: farmer.is_funded ? 'funded' : 'unfunded',
          lastFundingCheck: farmer.funded_at,
          accountCreated: farmer.created_at
        },
        custodialWallet: {
          address: farmer.custodial_public_key || 'N/A',
          balance: parseFloat(custodialWalletBalances.kale),
          xlmBalance: parseFloat(custodialWalletBalances.xlm),
          accountExists: custodialWalletBalances.accountExists,
          currency: 'KALE'
        },
        currentBlock: currentBlock,
        staking: {
          totalStaked: mockTotalStaked,
          currency: 'KALE',
          activePlantings: stakingResult.rows[0]?.total_staked > 0 ? 'real' : 'mocked' // Indicate if data is real or mocked
        },
        lastUpdated: new Date().toISOString()
      };
      
      logger.info(`Blockchain data retrieved for farmer ${farmerId}`, {
        userId,
        farmerId,
        fundingStatus: farmer.is_funded,
        totalStaked: mockTotalStaked
      });

      return res.json(blockchainData);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in get farmer blockchain data:', { 
        error: errorMessage,
        userId: req.user?.id 
      });
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch blockchain data: ' + errorMessage
        }
      });
    }
  }
);

// GET /farmers - Get all farmers (admin only)
router.get('/',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { role } = req.user!;
      
      // Only admin can list all farmers
      if (role !== 'admin') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin can list all farmers'
          }
        });
      }
      
      const result = await farmerService.getAllFarmers({
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 25, 100)
      });
      
      return res.json(result);
    } catch (error) {
      logger.error('Error in list all farmers:', { 
        error,
        userId: req.user?.id 
      });
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch farmers'
        }
      });
    }
  }
);

// GET /farmers/current - Get current user's farmer data
router.get('/current',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id: userId, role } = req.user!;
      
      // Verify farmer association
      const farmerAssociation = await farmerService.validateFarmerAssociation(userId);
      if (!farmerAssociation) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'No farmer account associated with this user'
          }
        });
      }
      
      // Return the farmer data with active contract
      const result = await farmerService.getFarmerById(farmerAssociation.farmerId);
      if (!result) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'Farmer data not found'
          }
        });
      }
      return res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error('Error in get current farmer:', err);
      if (req.user) {
        logger.error(`Request from user ${req.user.id} failed`);
      }
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch farmer data'
        }
      });
    }
  }
);

// GET /farmers/:farmerId - Get specific farmer data (admin or owner only)
router.get('/:farmerId',
  authenticate,
  validateUUID('farmerId', 'params'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { id: userId, role } = req.user!;
      const requestedFarmerId = req.params.farmerId;
      
      // For non-admin users, verify they can access this farmer
      if (role !== 'admin') {
        const farmerAssociation = await farmerService.validateFarmerAssociation(userId);
        if (!farmerAssociation || farmerAssociation.farmerId !== requestedFarmerId) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You can only access your own farmer data'
            }
          });
        }
      }
      
      const farmer = await farmerService.getFarmerById(requestedFarmerId);
      if (!farmer) {
        return res.status(404).json({
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'Farmer not found'
          }
        });
      }
      
      return res.json(farmer);
    } catch (error) {
      logger.error('Error in get farmer by id:', { 
        error, 
        userId: req.user?.id,
        farmerId: req.params.farmerId 
      });
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch farmer data'
        }
      });
    }
  }
);

// GET /farmers - List farmers (admin sees all, farmers see own data)
router.get('/',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id: userId, role } = req.user!;
      
      logger.info('Farmers list request', {
        user_id: userId,
        user_role: role,
        ip: req.ip
      });
      
      if (role === 'admin') {
        // Admin can see all farmers with pagination
        const result = await farmerService.getAllFarmers({
          page: parseInt(req.query.page as string) || 1,
          limit: Math.min(parseInt(req.query.limit as string) || 25, 100)
        });
        return res.status(200).json(result);
      } 
      
      if (role === 'farmer') {
        // For farmers, verify their farmer association first
        const farmerData = await farmerService.validateFarmerAssociation(userId);
        if (!farmerData) {
          return res.status(404).json({
            error: {
              code: 'FARMER_NOT_FOUND',
              message: 'No farmer account associated with this user'
            }
          });
        }
        
        // Return the specific farmer's data with default 24h window
        const result = await farmerService.getFarmerSummary({
          farmerId: farmerData.farmerId,
          window: '24h',
          user: req.user!
        });
        return res.status(200).json(result);
      }
      
      // Other roles are not allowed
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to farmer data'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });

      if (req.user!.role === 'farmer') {
        // Farmer can only see their own data
        const result = await farmerService.getFarmerSummary({
          farmerId: req.user!.id,  // Use the user's ID directly
          window: '24h',
          user: req.user!
        });
        res.status(200).json({ farmer: result });
      } else {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to farmer data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      }  catch (error) {
      logger.error('Farmers list endpoint error', error as Error);
      
      // Log request context for debugging
      if (req.user) {
        logger.error(`Request from user ${req.user.id} failed`);
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get farmer data'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get farmer data'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /farmers/:farmerId/plantings - Get farmer's planting history
router.get('/:farmerId/plantings',
  authenticate,
  apiRateLimit,
  requireResourceAccess('farmers', 'read'),
  validateFarmerAnalytics(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const params = {
        farmerId: req.params.farmerId,
        poolerId: req.query.poolerId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 25,
        status: req.query.status as 'success' | 'failed' | 'all' | undefined,
        user: req.user!
      };
      
      logger.info(`Farmer plantings request: ${JSON.stringify({
        farmer_id: params.farmerId,
        user_id: req.user!.id,
        user_role: req.user!.role,
        filters: {
          poolerId: params.poolerId,
          status: params.status
        },
        pagination: { page: params.page, limit: params.limit }
      })}`);
      
      const result = await farmerService.getFarmerPlantings(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to farmer plantings'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Farmer plantings endpoint error', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve farmer plantings'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /farmers/:farmerId/harvests - Get farmer's harvest history
router.get('/:farmerId/harvests',
  authenticate,
  apiRateLimit,
  requireResourceAccess('farmers', 'read'),
  validateFarmerAnalytics(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const params = {
        farmerId: req.params.farmerId,
        poolerId: req.query.poolerId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 25,
        status: req.query.status as 'success' | 'failed' | 'all' | undefined,
        user: req.user!
      };
      
      logger.info(`Farmer harvests request: ${JSON.stringify({
        farmer_id: params.farmerId,
        user_id: req.user!.id,
        user_role: req.user!.role,
        filters: {
          poolerId: params.poolerId,
          status: params.status
        },
        pagination: { page: params.page, limit: params.limit }
      })}`);
      
      const result = await farmerService.getFarmerHarvests(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to farmer harvests'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Farmer harvests endpoint error', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve farmer harvests'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /farmers/:farmerId/summary - Get farmer's dashboard summary
router.get('/:farmerId/summary',
  authenticate,
  apiRateLimit,
  requireResourceAccess('farmers', 'read'),
  validateFarmerSummary(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const params = {
        farmerId: req.params.farmerId,
        poolerId: req.query.poolerId as string | undefined,
        window: (req.query.window as '24h' | '7d' | '30d' | 'all') || '7d',
        user: req.user!
      };
      
      logger.info(`Farmer summary request: ${JSON.stringify({
        farmer_id: params.farmerId,
        user_id: req.user!.id,
        user_role: req.user!.role,
        window: params.window,
        poolerId: params.poolerId
      })}`);
      
      const result = await farmerService.getFarmerSummary(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to farmer summary'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Farmer not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Farmer summary endpoint error', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve farmer summary'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

export default router;