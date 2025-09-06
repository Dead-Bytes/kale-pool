import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { 
  validateWalletAddress,
  handleValidationErrors 
} from '../middleware/validation';
import { stellarSDKService } from '../services/stellar-sdk-service';
import { farmerService } from '../services/farmer-service';
import { backendLogger as logger } from '../../../Shared/utils/logger';

const router = Router();

// GET /wallet/balance/:address - Get wallet balance for any Stellar address
router.get('/balance/:address',
  apiRateLimit,
  validateWalletAddress(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      logger.info(`Wallet balance request for address: ${address}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      const balanceData = await stellarSDKService.getWalletBalance(address);

      res.status(200).json({
        success: true,
        address,
        data: balanceData,
        timestamp: new Date().toISOString(),
        network: stellarSDKService.getNetworkInfo()
      });

    } catch (error) {
      logger.error('Wallet balance endpoint error', error as Error, {
        address: req.params.address,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_BALANCE_ERROR',
          message: 'Failed to retrieve wallet balance'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /wallet/my-balance - Get authenticated user's custodial wallet balance
router.get('/my-balance',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { id: userId } = req.user!;
      
      logger.info(`My wallet balance request from user: ${userId}`, {
        ip: req.ip
      });

      // Get farmer association to find custodial wallet
      const farmerAssociation = await farmerService.validateFarmerAssociation(userId);
      
      if (!farmerAssociation) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FARMER_NOT_FOUND',
            message: 'No farmer account associated with this user'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }

      // Get farmer data to find custodial public key
      const farmer = await farmerService.getFarmerById(farmerAssociation.farmerId);
      
      if (!farmer || !farmer.custodial_public_key) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTODIAL_WALLET_NOT_FOUND',
            message: 'No custodial wallet found for this farmer'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }

      const balanceData = await stellarSDKService.getWalletBalance(farmer.custodial_public_key);

      logger.info(`Successfully retrieved custodial wallet balance`, {
        userId,
        farmerId: farmerAssociation.farmerId,
        custodialAddress: farmer.custodial_public_key,
        accountExists: 'accountExists' in balanceData ? balanceData.accountExists : false
      });

      res.status(200).json({
        success: true,
        farmer: {
          id: farmer.id,
          custodialAddress: farmer.custodial_public_key
        },
        data: balanceData,
        timestamp: new Date().toISOString(),
        network: stellarSDKService.getNetworkInfo()
      });

    } catch (error) {
      logger.error('My wallet balance endpoint error', error as Error, {
        userId: req.user!.id,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_BALANCE_ERROR',
          message: 'Failed to retrieve your wallet balance'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /wallet/info/:address - Get comprehensive wallet information
router.get('/info/:address',
  apiRateLimit,
  validateWalletAddress(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      logger.info(`Wallet info request for address: ${address}`, {
        ip: req.ip
      });

      const accountInfo = await stellarSDKService.getAccountInfo(address);

      res.status(200).json({
        success: true,
        address,
        data: accountInfo,
        timestamp: new Date().toISOString(),
        network: stellarSDKService.getNetworkInfo()
      });

    } catch (error) {
      logger.error('Wallet info endpoint error', error as Error, {
        address: req.params.address,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_INFO_ERROR',
          message: 'Failed to retrieve wallet information'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /wallet/xlm/:address - Get only XLM balance (lighter endpoint)
router.get('/xlm/:address',
  apiRateLimit,
  validateWalletAddress(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      logger.info(`XLM balance request for address: ${address}`, {
        ip: req.ip
      });

      const xlmData = await stellarSDKService.getXLMBalance(address);

      res.status(200).json({
        success: true,
        address,
        xlmBalance: xlmData.balance,
        accountExists: xlmData.exists,
        error: xlmData.error,
        timestamp: new Date().toISOString(),
        network: stellarSDKService.getNetworkInfo()
      });

    } catch (error) {
      logger.error('XLM balance endpoint error', error as Error, {
        address: req.params.address,
        ip: req.ip
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'XLM_BALANCE_ERROR',
          message: 'Failed to retrieve XLM balance'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

export default router;