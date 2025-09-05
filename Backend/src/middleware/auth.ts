import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth-service';
import { UserRole, AuthUser } from '../types/auth-types';
import { backendLogger as logger } from '../../../Shared/utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const verification = await authService.verifyToken(token);
    
    if (!verification.valid || !verification.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: verification.error || 'Invalid token'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    // Attach user to request
    req.user = verification.user;
    
    logger.info(`Authenticated user: ${JSON.stringify({
      user_id: verification.user.id,
      email: verification.user.email,
      role: verification.user.role,
      path: req.path,
      method: req.method
    })}`);
    
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error', error as Error, {
      path: req.path,
      method: req.method
    });
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error'
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied - insufficient role: ${JSON.stringify({
        user_id: req.user.id,
        user_role: req.user.role,
        required_roles: allowedRoles,
        path: req.path
      })}`);
      
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    next();
  };
};

export const requireResourceAccess = (resource: string, action: 'read' | 'write' | 'delete') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    // Get resource ID from params (common patterns)
    const resourceId = req.params.farmerId || req.params.poolerId || req.params.userId || req.params.contractId;
    
    if (!authService.canAccessResource(req.user, resource, action, resourceId)) {
      logger.warn(`Resource access denied: ${JSON.stringify({
        user_id: req.user.id,
        user_role: req.user.role,
        resource,
        action,
        resource_id: resourceId,
        path: req.path
      })}`);
      
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this resource'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
      return;
    }
    
    next();
  };
};

// Optional authentication - allows both authenticated and unauthenticated access
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication provided, continue without user
      next();
      return;
    }
    
    const token = authHeader.substring(7);
    
    const verification = await authService.verifyToken(token);
    
    if (verification.valid && verification.user) {
      req.user = verification.user;
    }
    // If token is invalid, we still continue (optional auth)
    
    next();
    
  } catch (error) {
    logger.error('Optional authentication middleware error', error as Error);
    // Continue even on error for optional auth
    next();
  }
};