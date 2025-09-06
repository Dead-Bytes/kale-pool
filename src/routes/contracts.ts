import { Router, Request, Response } from 'express';
import { contractService } from '../services/contract-service';
import { authenticate, requireRole } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import {
  validateContractDiscovery,
  validateUUID,
  handleValidationErrors
} from '../middleware/validation';
import { UserRole } from '../types/auth-types';
import { backendLogger as logger } from '../../../Shared/utils/logger';

const router = Router();

// GET /contracts - Contract discovery with role-based access control
router.get('/',
  authenticate,
  apiRateLimit,
  validateContractDiscovery(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 25,
        status: req.query.status as 'pending' | 'active' | 'exiting' | 'completed' | 'all' | undefined,
        poolerId: req.query.poolerId as string | undefined,
        farmerId: req.query.farmerId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        user: req.user!
      };
      
      logger.info(`Contract discovery request: ${JSON.stringify({
        user_id: req.user!.id,
        user_role: req.user!.role,
        filters: {
          status: params.status,
          poolerId: params.poolerId,
          farmerId: params.farmerId
        },
        pagination: { page: params.page, limit: params.limit }
      })}`);
      
      const result = await contractService.getContractDiscovery(params);
      
      res.status(200).json(result);
      
    } catch (error) {
      logger.error('Contract discovery endpoint error', error as Error, {
        user_id: req.user?.id,
        query: req.query
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve contracts'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /contracts/:contractId - Get specific contract details
router.get('/:contractId',
  authenticate,
  apiRateLimit,
  validateUUID('contractId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const contractId = req.params.contractId;
      
      logger.info(`Contract details request: ${JSON.stringify({
        contract_id: contractId,
        user_id: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      const contract = await contractService.getContractById(contractId, req.user!);
      
      if (!contract) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Contract not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      res.status(200).json(contract);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this contract'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Contract details endpoint error', error as Error, {
        contract_id: req.params.contractId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve contract details'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /farmers/:farmerId/contracts/active - Get farmer's active contract
router.get('/farmers/:farmerId/contracts/active',
  authenticate,
  apiRateLimit,
  validateUUID('farmerId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const farmerId = req.params.farmerId;
      
      logger.info(`Farmer active contract request: ${JSON.stringify({
        farmer_id: farmerId,
        user_id: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      const result = await contractService.getActiveContract(farmerId, req.user!);
      
      if (!result.activeContract) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No active contract found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      res.status(200).json(result);
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to farmer contracts'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Farmer active contract endpoint error', error as Error, {
        farmer_id: req.params.farmerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve active contract'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /poolers/:poolerId/contracts - Get all contracts for a pooler
router.get('/poolers/:poolerId/contracts',
  authenticate,
  apiRateLimit,
  validateUUID('poolerId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const poolerId = req.params.poolerId;
      
      // Check if user can access this pooler's contracts
      if (req.user!.role !== UserRole.ADMIN && 
          (req.user!.role !== UserRole.POOLER || req.user!.entityId !== poolerId)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler contracts'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`Pooler contracts request: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      const contracts = await contractService.getContractsByPooler(poolerId, req.user!);
      
      res.status(200).json({
        poolerId,
        contracts,
        total: contracts.length
      });
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to pooler contracts'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Pooler contracts endpoint error', error as Error, {
        pooler_id: req.params.poolerId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pooler contracts'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// POST /contracts/:contractId/exit - Request contract exit
router.post('/:contractId/exit',
  authenticate,
  apiRateLimit,
  validateUUID('contractId'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const contractId = req.params.contractId;
      
      logger.info(`Contract exit request: ${JSON.stringify({
        contract_id: contractId,
        user_id: req.user!.id,
        user_role: req.user!.role
      })}`);
      
      const result = await contractService.requestContractExit(contractId, req.user!);
      
      res.status(200).json({
        message: 'Contract exit requested successfully',
        contract: result.contract,
        finalRewards: result.finalRewards,
        exitDelay: result.exitDelay,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to exit this contract'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      if ((error as Error).message.includes('Contract not found')) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Contract not found'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      if ((error as Error).message.includes('not active')) {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: 'Only active contracts can be exited'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.error('Contract exit endpoint error', error as Error, {
        contract_id: req.params.contractId,
        user_id: req.user?.id
      });
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process contract exit request'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

export default router;