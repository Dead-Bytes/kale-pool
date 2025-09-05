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
import { backendLogger as logger } from '../../../Shared/utils/logger';

const router = Router();

// GET /farmers - Get all farmers (admin only) or current user's farmer data
router.get('/',
  authenticate,
  apiRateLimit,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Farmers list request: ${JSON.stringify({
        user_id: req.user!.id,
        user_role: req.user!.role,
        ip: req.ip
      })}`);
      
      if (req.user!.role === 'admin') {
        // Admin can see all farmers
        const result = await farmerService.getAllFarmers({
          page: parseInt(req.query.page as string) || 1,
          limit: Math.min(parseInt(req.query.limit as string) || 25, 100)
        });
        res.status(200).json(result);
      } else if (req.user!.role === 'farmer') {
        // Farmer can only see their own data
        const result = await farmerService.getFarmerSummary({
          farmerId: req.user!.entityId,
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
      
    } catch (error) {
      logger.error('Farmers list endpoint error', error as Error, {
        user_id: req.user?.id
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