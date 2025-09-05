import { Router, Request, Response } from 'express';
import { poolerService } from '../services/pooler-service';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth';
import { publicRateLimit, apiRateLimit } from '../middleware/rateLimit';
import {
  validatePoolerDiscovery,
  validatePoolerAnalytics,
  validatePoolerRewards,
  validateUUID,
  handleValidationErrors
} from '../middleware/validation';
import { UserRole } from '../types/auth-types';
import { backendLogger as logger } from '../../../Shared/utils/logger';

const router = Router();

// GET /poolers - Public pooler discovery (no auth required)
router.get('/',
  publicRateLimit,
  optionalAuth, // Optional auth to allow personalized results
  validatePoolerDiscovery(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 6,
        status: (req.query.status as 'active' | 'inactive' | 'all') || 'active',
        sortBy: (req.query.sortBy as 'name' | 'farmersCount' | 'totalStaked' | 'averageReward') || 'name',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };
      
      logger.info(`Pooler discovery request: ${JSON.stringify({
        ...params,
        authenticated: !!req.user,
        user_id: req.user?.id || 'anonymous',
        ip: req.ip
      })}`);
      
      const result = await poolerService.getPoolerDiscovery(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      logger.error('Pooler discovery endpoint error', error as Error, {
        query: req.query,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve poolers'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId - Direct pooler access (redirect to details)
router.get('/:poolerId',
  publicRateLimit,
  optionalAuth,
  validateUUID('poolerId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      logger.info(`Direct pooler access request: ${JSON.stringify({
        pooler_id: poolerId,
        authenticated: !!req.user,
        user_role: req.user?.role || 'anonymous',
        ip: req.ip
      })}`);
      
      const result = await poolerService.getPoolerDetails(poolerId);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pooler not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Pooler direct access endpoint error', error as Error, {
        pooler_id: req.params.poolerId
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get pooler information'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId/details - Public pooler details
router.get('/:poolerId/details',
  publicRateLimit,
  optionalAuth,
  validateUUID('poolerId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      logger.info(`Pooler details request: ${JSON.stringify({
        pooler_id: poolerId,
        authenticated: !!req.user,
        user_id: req.user?.id || 'anonymous',
        ip: req.ip
      })}`);
      
      const details = await poolerService.getPoolerDetails(poolerId);
      
      if (!details) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pooler not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      res.status(200).json(details);
      
    } catch (error) {
      logger.error('Pooler details endpoint error', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler details'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId/dashboard - Pooler management dashboard (Auth required)
router.get('/:poolerId/dashboard',
  authenticate,
  apiRateLimit,
  validateUUID('poolerId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      // Check if user can access this pooler's dashboard
      if (req.user!.role !== UserRole.ADMIN && 
          req.user!.role !== UserRole.POOLER ||
          (req.user!.role === UserRole.POOLER && req.user!.entityId !== poolerId)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this pooler dashboard'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`Pooler dashboard request: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      const dashboard = await poolerService.getPoolerDashboard(poolerId);
      
      if (!dashboard) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Pooler not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      res.status(200).json(dashboard);
      
    } catch (error) {
      logger.error('Pooler dashboard endpoint error', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler dashboard'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId/works - Pooler work history (Auth required)
router.get('/:poolerId/works',
  authenticate,
  apiRateLimit,
  validateUUID('poolerId'),
  validatePoolerAnalytics(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      // Check if user can access this pooler's work data
      if (req.user!.role !== UserRole.ADMIN && 
          (req.user!.role !== UserRole.POOLER || req.user!.entityId !== poolerId)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler work data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const params = {
        poolerId,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 25,
        status: req.query.status as 'success' | 'failed' | 'all' | undefined,
        user: req.user!
      };
      
      logger.info(`Pooler works request: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: req.user!.id,
        user_role: req.user!.role,
        filters: {
          status: params.status,
          from: params.from,
          to: params.to
        },
        pagination: { page: params.page, limit: params.limit }
      })}`);
      
      const result = await poolerService.getPoolerWorks(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler work data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Pooler works endpoint error', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler work data'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId/rewards - Pooler rewards summary (Auth required)
router.get('/:poolerId/rewards',
  authenticate,
  apiRateLimit,
  validateUUID('poolerId'),
  validatePoolerRewards(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      // Check if user can access this pooler's reward data
      if (req.user!.role !== UserRole.ADMIN && 
          (req.user!.role !== UserRole.POOLER || req.user!.entityId !== poolerId)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler reward data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const params = {
        poolerId,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        window: (req.query.window as '24h' | '7d' | '30d' | 'all') || '7d',
        user: req.user!
      };
      
      logger.info(`Pooler rewards request: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: req.user!.id,
        user_role: req.user!.role,
        window: params.window,
        date_range: { from: params.from, to: params.to }
      })}`);
      
      const result = await poolerService.getPoolerRewards(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler reward data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Pooler rewards endpoint error', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler reward data'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

export default router;