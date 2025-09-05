import { Router, Request, Response } from 'express';
import { authService } from '../services/auth-service';
import { authenticate, requireRole } from '../middleware/auth';
import { authRateLimit, sensitiveRateLimit } from '../middleware/rateLimit';
import { 
  validateLogin, 
  validateRegister, 
  validateRefreshToken, 
  handleValidationErrors 
} from '../middleware/validation';
import { UserRole } from '../types/auth-types';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { pool } from '../../../Shared/database/connection';

const router = Router();

// POST /auth/test - Simple test endpoint
router.post('/test', 
  authRateLimit,
  async (req: Request, res: Response) => {
    res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
  }
);

// POST /auth/login
router.post('/login', 
  authRateLimit,
  validateLogin(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body);
      
      if (!result.success) {
        logger.warn(`Login failed: ${JSON.stringify({
          email: req.body.email,
          ip: req.ip,
          error: result.error
        })}`);
        
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: result.error || 'Login failed'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`User login successful: ${JSON.stringify({
        user_id: result.response!.user.id,
        email: result.response!.user.email,
        role: result.response!.user.role,
        ip: req.ip
      })}`);
      
      res.status(200).json(result.response);
      
    } catch (error) {
      logger.error('Login endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// POST /auth/register  
router.post('/register',
  authRateLimit,
  validateRegister(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await authService.register(req.body);
      
      if (!result.success) {
        logger.warn(`Registration failed: ${JSON.stringify({
          email: req.body.email,
          role: req.body.role,
          ip: req.ip,
          error: result.error
        })}`);
        
        const statusCode = result.error === 'User already exists with this email' ? 409 : 400;
        
        res.status(statusCode).json({
          error: {
            code: statusCode === 409 ? 'USER_EXISTS' : 'REGISTRATION_FAILED',
            message: result.error || 'Registration failed'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`User registration successful: ${JSON.stringify({
        user_id: result.user!.id,
        email: result.user!.email,
        role: result.user!.role,
        ip: req.ip
      })}`);
      
      res.status(201).json({
        user: result.user,
        message: 'Registration successful'
      });
      
    } catch (error) {
      logger.error('Registration endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Registration failed'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// POST /auth/refresh
router.post('/refresh',
  authRateLimit,
  validateRefreshToken(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await authService.refreshAccessToken(req.body);
      
      if (!result.success) {
        logger.warn(`Token refresh failed: ${JSON.stringify({
          ip: req.ip,
          error: result.error
        })}`);
        
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: result.error || 'Token refresh failed'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`Token refreshed successfully: ${JSON.stringify({
        ip: req.ip
      })}`);
      
      res.status(200).json({
        token: result.token,
        expiresIn: result.expiresIn
      });
      
    } catch (error) {
      logger.error('Token refresh endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Token refresh failed'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// POST /auth/logout
router.post('/logout',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const refreshToken = req.body.refreshToken;
      const result = await authService.logout(req.user!.id, refreshToken);
      
      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'LOGOUT_FAILED',
            message: result.error || 'Logout failed'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`User logout successful: ${JSON.stringify({
        user_id: req.user!.id,
        email: req.user!.email
      })}`);
      
      res.status(200).json({
        message: 'Logout successful'
      });
      
    } catch (error) {
      logger.error('Logout endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout failed'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// GET /auth/me
router.get('/me',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      
      // Get additional user permissions based on role
      const permissions = getUserPermissions(user.role);
      
      // If user is a farmer, include farmer-specific data
      let farmerData = null;
      if (user.role === UserRole.FARMER) {
        try {
          // Get farmer data using the user ID
          const farmerQuery = `
            SELECT 
              id,
              user_id,
              external_wallet,
              funding_status,
              last_funding_check,
              created_at,
              updated_at
            FROM farmers 
            WHERE user_id = $1
          `;
          const farmerResult = await pool.query(farmerQuery, [user.id]);
          
          if (farmerResult.rows.length > 0) {
            const farmer = farmerResult.rows[0];
            farmerData = {
              id: farmer.id,
              userId: farmer.user_id,
              externalWallet: farmer.external_wallet,
              fundingStatus: farmer.funding_status,
              lastFundingCheck: farmer.last_funding_check,
              createdAt: farmer.created_at,
              updatedAt: farmer.updated_at
            };
          }
        } catch (farmerError) {
          logger.warn(`Could not fetch farmer data for user ${user.id}:`, farmerError);
        }
      }
      
      logger.info(`User profile accessed: ${JSON.stringify({
        user_id: user.id,
        email: user.email,
        role: user.role,
        has_farmer_data: !!farmerData
      })}`);
      
      const responseData: any = {
        ...user,
        permissions
      };
      
      // Include farmer data if available
      if (farmerData) {
        responseData.farmer = farmerData;
      }
      
      res.status(200).json({
        user: responseData
      });
      
    } catch (error) {
      logger.error('User profile endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user profile'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// Admin-only endpoint to create users with specific roles
router.post('/admin/create-user',
  authenticate,
  requireRole([UserRole.ADMIN]),
  sensitiveRateLimit,
  validateRegister(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await authService.register({
        ...req.body,
        role: req.body.role || UserRole.FARMER
      });
      
      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'USER_CREATION_FAILED',
            message: result.error || 'User creation failed'
          },
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }
      
      logger.info(`Admin created user: ${JSON.stringify({
        admin_id: req.user!.id,
        created_user_id: result.user!.id,
        created_user_email: result.user!.email,
        created_user_role: result.user!.role
      })}`);
      
      res.status(201).json({
        user: result.user,
        message: 'User created successfully by admin'
      });
      
    } catch (error) {
      logger.error('Admin user creation endpoint error', error as Error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'User creation failed'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }
);

// Helper function to get user permissions based on role
function getUserPermissions(role: UserRole): string[] {
  const permissions: string[] = [];
  
  switch (role) {
    case UserRole.ADMIN:
      permissions.push(
        'read:all', 'write:all', 'delete:all',
        'admin:users', 'admin:poolers', 'admin:contracts',
        'admin:analytics'
      );
      break;
      
    case UserRole.POOLER:
      permissions.push(
        'read:own', 'write:own',
        'read:farmers', 'read:contracts',
        'manage:pool', 'view:analytics'
      );
      break;
      
    case UserRole.FARMER:
      permissions.push(
        'read:own', 'write:own',
        'read:poolers', 'read:contracts',
        'view:analytics'
      );
      break;
  }
  
  return permissions;
}

export default router;