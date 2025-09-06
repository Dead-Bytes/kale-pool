import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { backendLogger as logger } from '../../../Shared/utils/logger';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Pagination limits
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 25;

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }));
    
    logger.warn(`Validation errors: ${JSON.stringify({
      path: req.path,
      method: req.method,
      errors: formattedErrors
    })}`);
    
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formattedErrors
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
    return;
  }
  
  next();
};

// Common validation rules
export const validateUUID = (field: string, optional: boolean = false): ValidationChain => {
  const validator = param(field).matches(UUID_REGEX).withMessage(`${field} must be a valid UUID`);
  return optional ? validator.optional() : validator;
};

export const validateEmail = (field: string = 'email', optional: boolean = false): ValidationChain => {
  const validator = body(field).isEmail().normalizeEmail().withMessage('Must be a valid email address');
  return optional ? validator.optional() : validator;
};

export const validatePassword = (field: string = 'password'): ValidationChain => {
  return body(field)
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number');
};

export const validatePagination = (): ValidationChain[] => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Page must be a positive integer between 1 and 10000')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: MAX_PAGE_SIZE })
      .withMessage(`Limit must be between 1 and ${MAX_PAGE_SIZE}`)
      .toInt()
  ];
};

export const validateSortOptions = (allowedFields: string[]): ValidationChain[] => {
  return [
    query('sortBy')
      .optional()
      .isIn(allowedFields)
      .withMessage(`sortBy must be one of: ${allowedFields.join(', ')}`),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('sortOrder must be either "asc" or "desc"')
  ];
};

export const validateDateRange = (): ValidationChain[] => {
  return [
    query('from')
      .optional()
      .custom((value) => {
        // Accept ISO datetime or block index number
        if (typeof value === 'string') {
          if (!isNaN(Number(value)) && Number.isInteger(Number(value))) {
            return true; // Block index
          }
          if (new Date(value).toString() !== 'Invalid Date') {
            return true; // ISO datetime
          }
        }
        throw new Error('from must be a valid ISO datetime or block index number');
      }),
    query('to')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          if (!isNaN(Number(value)) && Number.isInteger(Number(value))) {
            return true; // Block index
          }
          if (new Date(value).toString() !== 'Invalid Date') {
            return true; // ISO datetime
          }
        }
        throw new Error('to must be a valid ISO datetime or block index number');
      })
  ];
};

// Authentication validation rules
export const validateLogin = (): ValidationChain[] => {
  return [
    validateEmail('email'),
    body('password').notEmpty().withMessage('Password is required')
  ];
};

export const validateRegister = (): ValidationChain[] => {
  return [
    validateEmail('email'),
    validatePassword('password'),
    body('role')
      .optional()
      .isIn(['admin', 'pooler', 'farmer'])
      .withMessage('Role must be admin, pooler, or farmer'),
    body('entityId')
      .optional()
      .matches(UUID_REGEX)
      .withMessage('entityId must be a valid UUID')
  ];
};

export const validateRefreshToken = (): ValidationChain[] => {
  return [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isUUID()
      .withMessage('Refresh token must be a valid UUID')
  ];
};

// Pooler validation rules
export const validatePoolerDiscovery = (): ValidationChain[] => {
  return [
    ...validatePagination(),
    query('status')
      .optional()
      .isIn(['active', 'inactive', 'all'])
      .withMessage('Status must be active, inactive, or all'),
    ...validateSortOptions(['name', 'farmersCount', 'totalStaked', 'averageReward'])
  ];
};

// Contract validation rules  
export const validateContractDiscovery = (): ValidationChain[] => {
  return [
    ...validatePagination(),
    query('status')
      .optional()
      .isIn(['pending', 'active', 'exiting', 'completed', 'all'])
      .withMessage('Status must be pending, active, exiting, completed, or all'),
    query('poolerId')
      .optional()
      .matches(UUID_REGEX)
      .withMessage('poolerId must be a valid UUID'),
    query('farmerId')
      .optional()
      .matches(UUID_REGEX)
      .withMessage('farmerId must be a valid UUID'),
    ...validateDateRange()
  ];
};

// Farmer analytics validation rules
export const validateFarmerAnalytics = (): ValidationChain[] => {
  return [
    validateUUID('farmerId'),
    ...validatePagination(),
    query('poolerId')
      .optional()
      .matches(UUID_REGEX)
      .withMessage('poolerId must be a valid UUID'),
    ...validateDateRange(),
    query('status')
      .optional()
      .isIn(['success', 'failed', 'all'])
      .withMessage('Status must be success, failed, or all')
  ];
};

export const validateFarmerSummary = (): ValidationChain[] => {
  return [
    validateUUID('farmerId'),
    query('poolerId')
      .optional()
      .matches(UUID_REGEX)
      .withMessage('poolerId must be a valid UUID'),
    query('window')
      .optional()
      .isIn(['24h', '7d', '30d', 'all'])
      .withMessage('Window must be 24h, 7d, 30d, or all')
  ];
};

// Pooler analytics validation rules
export const validatePoolerAnalytics = (): ValidationChain[] => {
  return [
    validateUUID('poolerId'),
    ...validatePagination(),
    ...validateDateRange(),
    query('status')
      .optional()
      .isIn(['success', 'failed', 'all'])
      .withMessage('Status must be success, failed, or all')
  ];
};

export const validatePoolerRewards = (): ValidationChain[] => {
  return [
    validateUUID('poolerId'),
    ...validateDateRange(),
    query('window')
      .optional()
      .isIn(['24h', '7d', '30d', 'all'])
      .withMessage('Window must be 24h, 7d, 30d, or all')
  ];
};

// Stellar wallet address validation
export const validateWalletAddress = (): ValidationChain => {
  return param('address')
    .isLength({ min: 56, max: 56 })
    .matches(/^G[A-Z2-7]{55}$/)
    .withMessage('Invalid Stellar wallet address format. Must be 56 characters starting with G');
};

// Rate limiting helper
export const createRateLimitErrorResponse = (req: Request): object => {
  return {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later'
    },
    timestamp: new Date().toISOString(),
    path: req.path
  };
};