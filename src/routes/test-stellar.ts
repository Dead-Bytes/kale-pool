import { Router, Request, Response } from 'express';
import { stellarSDKService } from '../services/stellar-sdk-service';
import { backendLogger as logger } from '@shared/utils/logger';

const router = Router();

// Test endpoint for Stellar SDK functionality
router.get('/test-stellar/:address',
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      logger.info(`Testing Stellar SDK with address: ${address}`);

      // Test with a known testnet address that should exist
      const testAddress = address || 'GA2HGBJIJKI6O4XEM7CZWY5PS6GKSXL6D34ERAJYQSPYA6X6AI7HYW36';
      
      const result = await stellarSDKService.getWalletBalance(testAddress);
      
      res.status(200).json({
        success: true,
        address: testAddress,
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Stellar SDK test error', error as Error);
      
      res.status(500).json({
        success: false,
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;