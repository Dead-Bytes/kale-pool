// KALE Pool Mining - Admin Exit Management Routes
// Administrative endpoints for managing farmer exits and platform fees

import { Router, Request, Response } from 'express';
import { exitService } from '../services/exit-service';
import { exitPayoutService } from '../services/exit-payout-service';
import { db } from '../services/database';
import { authenticate, requireRole } from '../middleware/auth';
import { adminRateLimit } from '../middleware/rateLimit';
import {
  validateUUID,
  validatePagination,
  handleValidationErrors
} from '../middleware/validation';
import { query, param } from 'express-validator';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { UserRole } from '../types/auth-types';
import {
  ExitStatus,
  AdminExitStats,
  AdminExitManagement,
  isValidExitStatus,
  canRetryExit
} from '../types/exit-types';

const router = Router();

// =====================================================
// 1. EXIT MONITORING & STATISTICS
// =====================================================

// GET /admin/exits/stats - Overall exit statistics
router.get('/stats',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      logger.info(`Admin exit stats request: ${JSON.stringify({
        admin_user: req.user!.id,
        ip: req.ip
      })}`);
      
      const stats = await getExitStatistics();
      
      res.status(200).json({
        statistics: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Admin exit stats retrieval failed', error as Error, {
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve exit statistics'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /admin/exits - List all exits with filtering
router.get('/',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  ...validatePagination(),
  query('status')
    .optional()
    .custom((value) => {
      if (value === 'all' || isValidExitStatus(value)) {
        return true;
      }
      throw new Error('Status must be processing, completed, failed, cancelled, or all');
    }),
  query('farmerId')
    .optional()
    .isUUID()
    .withMessage('Farmer ID must be a valid UUID'),
  query('poolerId')
    .optional()
    .isUUID()
    .withMessage('Pooler ID must be a valid UUID'),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be ISO 8601 format'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be ISO 8601 format'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const status = req.query.status as ExitStatus | 'all' || 'all';
      const farmerId = req.query.farmerId as string;
      const poolerId = req.query.poolerId as string;
      const from = req.query.from as string;
      const to = req.query.to as string;
      
      logger.info(`Admin exits list request: ${JSON.stringify({
        admin_user: req.user!.id,
        filters: { status, farmerId, poolerId, from, to },
        pagination: { page, limit }
      })}`);
      
      const result = await getAdminExitsList({
        page,
        limit,
        status: status === 'all' ? undefined : status,
        farmerId,
        poolerId,
        from,
        to
      });
      
      res.status(200).json(result);
      
    } catch (error) {
      logger.error('Admin exits list retrieval failed', error as Error, {
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve exits list'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /admin/exits/:exitId - Get detailed exit information
router.get('/:exitId',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  validateUUID('exitId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const exitId = req.params.exitId;
      
      logger.info(`Admin exit details request: ${JSON.stringify({
        exit_id: exitId,
        admin_user: req.user!.id
      })}`);
      
      const exitRecord = await exitPayoutService.getExitPayoutStatus(exitId);
      
      if (!exitRecord) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Exit record not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      // Get audit log for this exit
      const auditLog = await getExitAuditLog(exitId);
      
      // Get transaction verification status
      const txVerification = await exitPayoutService.verifyTransactionStatuses(exitId);
      
      res.status(200).json({
        exit: exitRecord,
        auditLog,
        transactionVerification: txVerification,
        canRetry: canRetryExit(exitRecord),
        canCancel: exitRecord.status === ExitStatus.PROCESSING
      });
      
    } catch (error) {
      logger.error('Admin exit details retrieval failed', error as Error, {
        exit_id: req.params.exitId,
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve exit details'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// 2. EXIT MANAGEMENT ACTIONS
// =====================================================

// POST /admin/exits/:exitId/retry - Manually retry failed exit
router.post('/:exitId/retry',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  validateUUID('exitId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const exitId = req.params.exitId;
      
      logger.info(`Admin exit retry request: ${JSON.stringify({
        exit_id: exitId,
        admin_user: req.user!.id,
        ip: req.ip
      })}`);
      
      const success = await exitPayoutService.retryFailedExit(exitId);
      
      if (success) {
        // Log admin action
        await logAdminAction(exitId, 'manual_retry', req.user!.id, req.ip, req.get('User-Agent'));
        
        res.status(200).json({
          success: true,
          message: 'Exit retry initiated successfully',
          exitId,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Exit cannot be retried (not in failed state or exceeded max attempts)'
          },
          exitId,
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      
    } catch (error) {
      logger.error('Admin exit retry failed', error as Error, {
        exit_id: req.params.exitId,
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retry exit'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// POST /admin/exits/:exitId/cancel - Cancel pending exit (emergency)
router.post('/:exitId/cancel',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  validateUUID('exitId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const exitId = req.params.exitId;
      const reason = req.body.reason || 'Admin cancellation';
      
      logger.warn(`Admin exit cancellation request: ${JSON.stringify({
        exit_id: exitId,
        admin_user: req.user!.id,
        reason,
        ip: req.ip
      })}`);
      
      const success = await cancelExit(exitId, reason);
      
      if (success) {
        // Log admin action
        await logAdminAction(exitId, 'manual_cancel', req.user!.id, req.ip, req.get('User-Agent'), { reason });
        
        res.status(200).json({
          success: true,
          message: 'Exit cancelled successfully',
          exitId,
          reason,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Exit cannot be cancelled (not in processing state)'
          },
          exitId,
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      
    } catch (error) {
      logger.error('Admin exit cancellation failed', error as Error, {
        exit_id: req.params.exitId,
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to cancel exit'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// =====================================================
// 3. PLATFORM FEE MANAGEMENT
// =====================================================

// GET /admin/platform-fees/collected - Total platform fees collected
router.get('/platform-fees/collected',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be ISO 8601 format'),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be ISO 8601 format'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      
      logger.info(`Admin platform fees query: ${JSON.stringify({
        admin_user: req.user!.id,
        filters: { from, to }
      })}`);
      
      const fees = await getPlatformFeesStats(from, to);
      
      res.status(200).json(fees);
      
    } catch (error) {
      logger.error('Platform fees retrieval failed', error as Error, {
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve platform fees'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /admin/platform-fees/pending - Fees in processing exits
router.get('/platform-fees/pending',
  authenticate,
  adminRateLimit,
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      logger.info(`Admin pending fees query: ${JSON.stringify({
        admin_user: req.user!.id
      })}`);
      
      const pendingFees = await getPendingPlatformFees();
      
      res.status(200).json(pendingFees);
      
    } catch (error) {
      logger.error('Pending fees retrieval failed', error as Error, {
        admin_user: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pending fees'
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

async function getExitStatistics(): Promise<AdminExitStats> {
  const query = `
    SELECT 
      COUNT(*) as total_exits,
      COUNT(*) FILTER (WHERE status = 'completed') as successful_exits,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_exits,
      COUNT(*) FILTER (WHERE status = 'processing') as pending_exits,
      COALESCE(SUM(total_rewards::bigint), 0) as total_rewards_processed,
      COALESCE(SUM(platform_fee::bigint), 0) as total_platform_fees,
      COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - initiated_at))), 0) as avg_processing_time_seconds
    FROM exit_splits
    WHERE initiated_at >= NOW() - INTERVAL '30 days'
  `;
  
  const result = await db.query(query);
  const row = result.rows[0];
  
  return {
    totalExits: parseInt(row.total_exits),
    successfulExits: parseInt(row.successful_exits),
    failedExits: parseInt(row.failed_exits),
    pendingExits: parseInt(row.pending_exits),
    totalRewardsProcessed: row.total_rewards_processed.toString(),
    totalPlatformFees: row.total_platform_fees.toString(),
    avgProcessingTimeSeconds: parseFloat(row.avg_processing_time_seconds)
  };
}

async function getAdminExitsList(params: {
  page: number;
  limit: number;
  status?: ExitStatus;
  farmerId?: string;
  poolerId?: string;
  from?: string;
  to?: string;
}) {
  const offset = (params.page - 1) * params.limit;
  
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];
  let paramIndex = 1;
  
  if (params.status) {
    whereClause += ` AND es.status = $${paramIndex}`;
    queryParams.push(params.status);
    paramIndex++;
  }
  
  if (params.farmerId) {
    whereClause += ` AND es.farmer_id = $${paramIndex}`;
    queryParams.push(params.farmerId);
    paramIndex++;
  }
  
  if (params.poolerId) {
    whereClause += ` AND es.pooler_id = $${paramIndex}`;
    queryParams.push(params.poolerId);
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
      es.status,
      es.total_rewards,
      es.retry_count,
      es.error_message,
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
    page: params.page,
    limit: params.limit,
    total,
    hasNext: offset + params.limit < total,
    hasPrev: params.page > 1,
    items: dataResult.rows.map(row => ({
      id: row.id,
      farmerId: row.farmer_id,
      farmerEmail: row.farmer_email,
      status: row.status as ExitStatus,
      totalRewards: row.total_rewards,
      retryCount: row.retry_count,
      lastError: row.error_message,
      initiatedAt: row.initiated_at,
      canRetry: row.status === ExitStatus.FAILED && row.retry_count < 3,
      canCancel: row.status === ExitStatus.PROCESSING
    }))
  };
}

async function getExitAuditLog(exitId: string) {
  const query = `
    SELECT 
      action,
      old_status,
      new_status,
      details,
      error_details,
      performed_by,
      performed_at,
      ip_address,
      user_agent
    FROM exit_audit_log
    WHERE exit_split_id = $1
    ORDER BY performed_at DESC
    LIMIT 50
  `;
  
  const result = await db.query(query, [exitId]);
  return result.rows;
}

async function cancelExit(exitId: string, reason: string): Promise<boolean> {
  try {
    const result = await db.query(`
      UPDATE exit_splits 
      SET 
        status = 'cancelled',
        error_message = $2,
        completed_at = NOW()
      WHERE id = $1 AND status = 'processing'
    `, [exitId, `Cancelled by admin: ${reason}`]);
    
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Exit cancellation failed', error as Error, { exit_id: exitId });
    return false;
  }
}

async function logAdminAction(
  exitId: string, 
  action: string, 
  adminUserId: string, 
  ipAddress?: string, 
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO exit_audit_log (exit_split_id, action, details, performed_by, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      exitId, 
      action, 
      JSON.stringify(details || {}), 
      adminUserId, 
      ipAddress, 
      userAgent
    ]);
  } catch (error) {
    logger.error('Admin action logging failed', error as Error, { 
      exit_id: exitId, 
      action, 
      admin_user: adminUserId 
    });
  }
}

async function getPlatformFeesStats(from?: string, to?: string) {
  let whereClause = 'WHERE pf.status = \'collected\'';
  const queryParams: any[] = [];
  let paramIndex = 1;
  
  if (from) {
    whereClause += ` AND pf.collected_at >= $${paramIndex}`;
    queryParams.push(from);
    paramIndex++;
  }
  
  if (to) {
    whereClause += ` AND pf.collected_at <= $${paramIndex}`;
    queryParams.push(to);
    paramIndex++;
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_collections,
      SUM(pf.amount) as total_amount,
      AVG(pf.fee_rate) as avg_fee_rate,
      MIN(pf.collected_at) as first_collection,
      MAX(pf.collected_at) as last_collection
    FROM platform_fees pf
    ${whereClause}
  `;
  
  const result = await db.query(query, queryParams);
  const row = result.rows[0];
  
  return {
    totalCollections: parseInt(row.total_collections),
    totalAmount: row.total_amount?.toString() || '0',
    totalAmountHuman: formatKaleAmount(row.total_amount?.toString() || '0'),
    avgFeeRate: parseFloat(row.avg_fee_rate || '0'),
    firstCollection: row.first_collection,
    lastCollection: row.last_collection
  };
}

async function getPendingPlatformFees() {
  const query = `
    SELECT 
      COUNT(*) as pending_exits,
      SUM(es.platform_fee::bigint) as pending_fees
    FROM exit_splits es
    WHERE es.status = 'processing'
  `;
  
  const result = await db.query(query);
  const row = result.rows[0];
  
  return {
    pendingExits: parseInt(row.pending_exits),
    pendingFees: row.pending_fees?.toString() || '0',
    pendingFeesHuman: formatKaleAmount(row.pending_fees?.toString() || '0')
  };
}

function formatKaleAmount(stroops: string): string {
  const amount = BigInt(stroops);
  const kaleAmount = Number(amount) / 10**7;
  return kaleAmount.toFixed(7);
}

export default router;