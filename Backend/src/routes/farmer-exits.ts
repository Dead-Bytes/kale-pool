// KALE Pool Mining - Farmer Exit Routes
// API endpoints for farmer exit functionality with reward splitting

import { Router, Request, Response } from 'express';
import { exitService } from '../services/exit-service';
import { exitPayoutService } from '../services/exit-payout-service';
import { db } from '../services/database';
import { authenticate, requireResourceAccess } from '../middleware/auth';
import { apiRateLimit, sensitiveRateLimit } from '../middleware/rateLimit';
import {
  validateUUID,
  validatePagination,
  handleValidationErrors
} from '../middleware/validation';
import { body, param } from 'express-validator';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import {
  ExitInitiationRequest,
  ExitStatus,
  isValidExitStatus
} from '../types/exit-types';

const router = Router();

// =====================================================
// 1. FARMER EXIT INITIATION
// =====================================================

// POST /farmers/:farmerId/exit-pool - Initiate farmer exit from pool
router.post('/:farmerId/exit-pool',
  authenticate,
  sensitiveRateLimit,
  validateUUID('farmerId'),
  body('externalWallet')
    .notEmpty()
    .withMessage('External wallet address is required')
    .isLength({ min: 56, max: 56 })
    .withMessage('External wallet must be 56 characters')
    .matches(/^G[A-Z0-9]{55}$/)
    .withMessage('Invalid Stellar wallet address format'),
  body('immediate')
    .optional()
    .isBoolean()
    .withMessage('Immediate must be a boolean'),
  handleValidationErrors,
  requireResourceAccess('farmers', 'write'),
  async (req: Request, res: Response) => {
    try {
      const farmerId = req.params.farmerId;
      const { externalWallet, immediate = true } = req.body;
      
      logger.info(`Farmer exit request initiated: ${JSON.stringify({
        farmer_id: farmerId,
        external_wallet: externalWallet,
        immediate,
        requested_by: req.user!.id,
        user_role: req.user!.role,
        ip: req.ip
      })}`);
      
      // Validate user can access this farmer's data
      if (req.user!.role === 'farmer' && req.user!.entityId !== farmerId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot initiate exit for another farmer'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const exitRequest: ExitInitiationRequest = {
        farmerId,
        externalWallet,
        immediate
      };
      
      const result = await exitService.initiateExit(exitRequest, req.user!);
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Exit not eligible') ||
          (error as Error).message.includes('Invalid external wallet') ||
          (error as Error).message.includes('Exit amount below minimum')) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: (error as Error).message
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      if ((error as Error).message.includes('Exit already in progress')) {
        res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: (error as Error).message
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      if ((error as Error).message.includes('No active contract found')) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Farmer not found or not in active pool'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Farmer exit initiation failed', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to initiate exit'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// 2. EXIT STATUS MONITORING
// =====================================================

// GET /farmers/:farmerId/exit-status - Get current exit status
router.get('/:farmerId/exit-status',
  authenticate,
  apiRateLimit,
  validateUUID('farmerId'),
  handleValidationErrors,
  requireResourceAccess('farmers', 'read'),
  async (req: Request, res: Response) => {
    try {
      const farmerId = req.params.farmerId;
      
      logger.info(`Exit status request: ${JSON.stringify({
        farmer_id: farmerId,
        requested_by: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      // Validate user can access this farmer's data
      if (req.user!.role === 'farmer' && req.user!.entityId !== farmerId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access another farmer\'s exit status'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const result = await exitService.getExitStatus(farmerId);
      
      res.status(200).json(result);
      
    } catch (error) {
      logger.error('Exit status retrieval failed', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve exit status'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /farmers/:farmerId/exit-eligibility - Check if farmer can exit
router.get('/:farmerId/exit-eligibility',
  authenticate,
  apiRateLimit,
  validateUUID('farmerId'),
  handleValidationErrors,
  requireResourceAccess('farmers', 'read'),
  async (req: Request, res: Response) => {
    try {
      const farmerId = req.params.farmerId;
      
      logger.info(`Exit eligibility check: ${JSON.stringify({
        farmer_id: farmerId,
        requested_by: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      // Validate user can access this farmer's data
      if (req.user!.role === 'farmer' && req.user!.entityId !== farmerId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot check another farmer\'s exit eligibility'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const eligibility = await exitService.checkExitEligibility(farmerId);
      
      res.status(200).json({
        farmerId,
        ...eligibility
      });
      
    } catch (error) {
      logger.error('Exit eligibility check failed', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to check exit eligibility'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// 3. POOLER EXIT ANALYTICS
// =====================================================

// GET /poolers/:poolerId/exits - Get farmer exits for pooler
router.get('/poolers/:poolerId/exits',
  authenticate,
  apiRateLimit,
  validateUUID('poolerId'),
  ...validatePagination(),
  body('status')
    .optional()
    .custom((value) => {
      if (value === 'all' || isValidExitStatus(value)) {
        return true;
      }
      throw new Error('Status must be processing, completed, failed, cancelled, or all');
    }),
  handleValidationErrors,
  requireResourceAccess('poolers', 'read'),
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const status = req.query.status as ExitStatus | 'all' || 'all';
      const from = req.query.from as string;
      const to = req.query.to as string;
      
      logger.info(`Pooler exits request: ${JSON.stringify({
        pooler_id: poolerId,
        filters: { status, from, to },
        pagination: { page, limit },
        requested_by: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      // Validate user can access this pooler's data
      if (req.user!.role === 'pooler' && req.user!.entityId !== poolerId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access another pooler\'s exit data'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      const result = await getPoolerExits(poolerId, {
        page,
        limit,
        status: status === 'all' ? undefined : status,
        from,
        to
      });
      
      res.status(200).json(result);
      
    } catch (error) {
      logger.error('Pooler exits retrieval failed', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler exits'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// 4. WALLET VALIDATION
// =====================================================

// POST /validate-wallet - Validate Stellar wallet address
router.post('/validate-wallet',
  authenticate,
  apiRateLimit,
  body('address')
    .notEmpty()
    .withMessage('Wallet address is required')
    .isString()
    .withMessage('Wallet address must be a string'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      
      logger.info(`Wallet validation request: ${JSON.stringify({
        address: address.substring(0, 10) + '...',
        requested_by: req.user!.id
      })}`);
      
      const isValid = await exitService.validateExternalWallet(address);
      
      res.status(200).json({
        address,
        valid: isValid,
        network: 'mainnet'
      });
      
    } catch (error) {
      logger.error('Wallet validation failed', error as Error, {
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate wallet address'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getPoolerExits(poolerId: string, params: {
  page: number;
  limit: number;
  status?: ExitStatus;
  from?: string;
  to?: string;
}) {
  try {
    const offset = (params.page - 1) * params.limit;
    
    let whereClause = 'WHERE es.pooler_id = $1';
    const queryParams: any[] = [poolerId];
    let paramIndex = 2;
    
    if (params.status) {
      whereClause += ` AND es.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }
    
    if (params.from) {
      whereClause += ` AND es.initiated_at >= $${paramIndex}`;
      queryParams.push(params.from);
      paramIndex++;
    }
    
    if (params.to) {
      whereClause += ` AND es.initiated_at <= $${paramIndex}`;
      queryParams.push(params.to);
      paramIndex++;
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM exit_splits es
      JOIN farmers f ON es.farmer_id = f.id
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const dataQuery = `
      SELECT 
        es.id,
        es.farmer_id,
        f.email as farmer_email,
        es.total_rewards,
        es.pooler_share,
        es.status,
        es.initiated_at,
        es.completed_at
      FROM exit_splits es
      JOIN farmers f ON es.farmer_id = f.id
      ${whereClause}
      ORDER BY es.initiated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(params.limit, offset);
    const dataResult = await db.query(dataQuery, queryParams);
    
    return {
      poolerId,
      page: params.page,
      limit: params.limit,
      total,
      hasNext: offset + params.limit < total,
      hasPrev: params.page > 1,
      items: dataResult.rows.map(row => ({
        id: row.id,
        farmerId: row.farmer_id,
        farmerEmail: row.farmer_email,
        totalRewards: row.total_rewards,
        poolerShare: row.pooler_share,
        status: row.status as ExitStatus,
        initiatedAt: row.initiated_at,
        completedAt: row.completed_at || undefined
      }))
    };
    
  } catch (error) {
    logger.error('Pooler exits query failed', error as Error, { pooler_id: poolerId, params });
    throw new Error('Failed to retrieve pooler exits');
  }
}

export default router;