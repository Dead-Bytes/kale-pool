import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { createRateLimitErrorResponse } from './validation';

// Rate limiting configurations based on SRS requirements
export const authRateLimit = rateLimit({
  windowMs: 600, // 1 minute
  max: 5, // 5 attempts per minute per IP
  message: (req: Request) => createRateLimitErrorResponse(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Authentication rate limit exceeded: ${JSON.stringify({
      ip: req.ip,
      path: req.path,
      user_agent: req.get('User-Agent')
    })}`);
    
    res.status(429).json(createRateLimitErrorResponse(req));
  },
  keyGenerator: (req: Request) => {
    // Use IP address and optional user ID for authenticated requests
    const baseKey = req.ip;
    const userKey = req.user ? req.user.id : '';
    return `${baseKey}:${userKey}`;
  },
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per authenticated user
  message: (req: Request) => createRateLimitErrorResponse(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`API rate limit exceeded: ${JSON.stringify({
      ip: req.ip,
      user_id: req.user?.id || 'anonymous',
      path: req.path,
      user_agent: req.get('User-Agent')
    })}`);
    
    res.status(429).json(createRateLimitErrorResponse(req));
  },
  keyGenerator: (req: Request) => {
    // Use user ID for authenticated requests, IP for anonymous
    if (req.user) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }
});

export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 60, // 60 requests per minute per IP for public endpoints
  message: (req: Request) => createRateLimitErrorResponse(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Public rate limit exceeded: ${JSON.stringify({
      ip: req.ip,
      path: req.path,
      user_agent: req.get('User-Agent')
    })}`);
    
    res.status(429).json(createRateLimitErrorResponse(req));
  },
  keyGenerator: (req: Request) => {
    return `public:${req.ip}`;
  }
});

// Stricter rate limiting for sensitive operations
export const sensitiveRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per 5 minutes
  message: (req: Request) => createRateLimitErrorResponse(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Sensitive operation rate limit exceeded: ${JSON.stringify({
      ip: req.ip,
      user_id: req.user?.id || 'anonymous',
      path: req.path,
      user_agent: req.get('User-Agent')
    })}`);
    
    res.status(429).json(createRateLimitErrorResponse(req));
  }
});

// Progressive rate limiting - increases restrictions for repeated violations
let rateLimitViolations = new Map<string, { count: number; lastViolation: Date }>();

// Clean up old violations every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [key, violation] of rateLimitViolations.entries()) {
    if (violation.lastViolation < oneHourAgo) {
      rateLimitViolations.delete(key);
    }
  }
}, 60 * 60 * 1000);

export const progressiveRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => {
    const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    const violations = rateLimitViolations.get(key);
    
    if (!violations) {
      return 100; // Default limit
    }
    
    // Reduce limit based on violation count
    const baseLimit = 100;
    const reduction = Math.min(violations.count * 10, 90);
    const adjustedLimit = Math.max(baseLimit - reduction, 10);
    
    logger.info(`Progressive rate limit applied: ${JSON.stringify({
      key,
      violations: violations.count,
      limit: adjustedLimit
    })}`);
    
    return adjustedLimit;
  },
  message: (req: Request) => createRateLimitErrorResponse(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    const existing = rateLimitViolations.get(key) || { count: 0, lastViolation: new Date() };
    
    rateLimitViolations.set(key, {
      count: existing.count + 1,
      lastViolation: new Date()
    });
    
    logger.warn(`Progressive rate limit exceeded: ${JSON.stringify({
      key,
      violation_count: existing.count + 1,
      path: req.path
    })}`);
    
    res.status(429).json(createRateLimitErrorResponse(req));
  },
  keyGenerator: (req: Request) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
});

// Custom middleware for logging rate limit headers
export const logRateLimitHeaders = (req: Request, res: Response, next: any) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log rate limit info for monitoring
    const remainingRequests = res.getHeader('X-RateLimit-Remaining');
    const resetTime = res.getHeader('X-RateLimit-Reset');
    
    if (remainingRequests !== undefined && Number(remainingRequests) < 10) {
      logger.info(`Rate limit approaching: ${JSON.stringify({
        user_id: req.user?.id || 'anonymous',
        ip: req.ip,
        path: req.path,
        remaining: remainingRequests,
        reset: resetTime
      })}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};