// Shared helper utilities for KALE Pool Mining system
// Phase 1: Common functions used across Backend and Pooler

import { ERROR_CODES, LOG_LEVELS } from './constants';

// Type declarations for Node.js globals
declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
  var Buffer: {
    from(str: string, encoding: 'base64' | 'hex'): {
      toString(encoding: 'hex' | 'base64'): string;
    };
  };
}

// ======================
// LOGGING UTILITIES
// ======================

export interface LogContext {
  component: string;
  operation?: string;
  farmer_id?: string;
  pooler_id?: string;
  block_index?: number;
  [key: string]: any;
}

export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx = { component: this.component, ...context };
    
    // Following CLAUDE.md rules: use string formatter with JSON.stringify for objects
    return `[${timestamp}] ${level.toUpperCase()} ${message} ${JSON.stringify(ctx)}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LOG_LEVELS.INFO, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LOG_LEVELS.WARN, message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      component: this.component,
      ...context,
      error_message: error?.message,
      error_stack: error?.stack
    };
    console.error(this.formatMessage(LOG_LEVELS.ERROR, message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if ((typeof globalThis.process !== 'undefined' && globalThis.process.env?.NODE_ENV === 'development') || 
        (typeof globalThis.process !== 'undefined' && globalThis.process.env?.LOG_LEVEL === 'debug')) {
      console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, context));
    }
  }
}

// ======================
// VALIDATION UTILITIES
// ======================

export const isValidStellarAddress = (address: string): boolean => {
  // Stellar addresses are either 56 characters (G addresses) or 63 characters (M addresses)
  // For KALE pool, we primarily use G addresses
  return /^G[A-Z2-7]{55}$/.test(address) || /^M[A-Z2-7]{62}$/.test(address);
};

export const isValidContractAddress = (address: string): boolean => {
  // Contract addresses are C addresses, 56 characters
  return /^C[A-Z2-7]{55}$/.test(address);
};

export const isValidUUID = (uuid: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
};

export const isValidAPIKey = (apiKey: string): boolean => {
  // API keys should be 32 characters of base64-like characters
  return /^[A-Za-z0-9+/]{32}$/.test(apiKey);
};

export const isValidStakePercentage = (percentage: number): boolean => {
  return percentage >= 0.1 && percentage <= 1.0;
};

export const isValidBlockIndex = (index: number): boolean => {
  return Number.isInteger(index) && index >= 0;
};

export const isValidNonce = (nonce: number): boolean => {
  return Number.isInteger(nonce) && nonce >= 0 && nonce <= 2147483647;
};

export const isValidHashZeros = (hash: string, expectedZeros: number): boolean => {
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    return false;
  }
  
  let zeros = 0;
  for (const char of hash) {
    if (char === '0') {
      zeros++;
    } else {
      break;
    }
  }
  
  return zeros >= expectedZeros;
};

// ======================
// CONVERSION UTILITIES
// ======================

export const base64ToHex = (base64: string): string => {
  try {
    if (typeof globalThis.Buffer !== 'undefined') {
      const buffer = globalThis.Buffer.from(base64, 'base64');
      return buffer.toString('hex');
    } else {
      // Fallback for environments without Buffer
      const binaryString = atob(base64);
      let hex = '';
      for (let i = 0; i < binaryString.length; i++) {
        const byte = binaryString.charCodeAt(i);
        hex += byte.toString(16).padStart(2, '0');
      }
      return hex;
    }
  } catch (error) {
    throw new Error(`Invalid base64 string: ${base64}`);
  }
};

export const hexToBase64 = (hex: string): string => {
  try {
    if (typeof globalThis.Buffer !== 'undefined') {
      const buffer = globalThis.Buffer.from(hex, 'hex');
      return buffer.toString('base64');
    } else {
      // Fallback for environments without Buffer
      let binaryString = '';
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        binaryString += String.fromCharCode(byte);
      }
      return btoa(binaryString);
    }
  } catch (error) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
};

export const bigintToString = (value: bigint): string => {
  return value.toString();
};

export const stringToBigint = (value: string): bigint => {
  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Invalid bigint string: ${value}`);
  }
};

// ======================
// TIMING UTILITIES
// ======================

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delayMs = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError!;
};

export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const getTimestampMinutesAgo = (minutes: number): string => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// ======================
// ERROR HANDLING UTILITIES
// ======================

export class PoolMiningError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;

  constructor(code: string, message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'PoolMiningError';
    this.code = code;
    this.context = context;
  }
}

export const createError = (
  code: keyof typeof ERROR_CODES,
  message: string,
  context?: Record<string, any>
): PoolMiningError => {
  return new PoolMiningError(ERROR_CODES[code], message, context);
};

export const isPoolMiningError = (error: any): error is PoolMiningError => {
  return error instanceof PoolMiningError;
};

// ======================
// CRYPTO UTILITIES
// ======================

export const generateSecureRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

export const generateAPIKey = (): string => {
  return generateSecureRandomString(32);
};

// ======================
// HASH UTILITIES (from kale-miner analysis)
// ======================

export const countLeadingZeros = (hash: string): number => {
  let zeros = 0;
  for (const char of hash.toLowerCase()) {
    if (char === '0') {
      zeros++;
    } else {
      break;
    }
  }
  return zeros;
};

export const isValidKaleHash = (hash: string): boolean => {
  // Kale hashes should be 64 character hex strings
  return /^[0-9a-f]{64}$/i.test(hash);
};

// ======================
// BATCH PROCESSING UTILITIES
// ======================

export const processBatch = async <T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
};

export const processParallel = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrency: number = 10
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const promises = batch.map(processor);
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }
  
  return results;
};

// ======================
// HEALTH CHECK UTILITIES
// ======================

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  timestamp: string;
  metrics?: Record<string, any>;
}

export const createHealthCheck = (
  name: string,
  status: HealthCheck['status'],
  message?: string,
  metrics?: Record<string, any>
): HealthCheck => {
  return {
    name,
    status,
    message,
    timestamp: getCurrentTimestamp(),
    metrics
  };
};

// ======================
// ENVIRONMENT UTILITIES
// ======================

export const getRequiredEnvVar = (name: string): string => {
  const value = typeof globalThis.process !== 'undefined' ? globalThis.process.env[name] : undefined;
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

export const getOptionalEnvVar = (name: string, defaultValue: string): string => {
  return (typeof globalThis.process !== 'undefined' ? globalThis.process.env[name] : undefined) || defaultValue;
};

export const getEnvVarAsNumber = (name: string, defaultValue: number): number => {
  const value = typeof globalThis.process !== 'undefined' ? globalThis.process.env[name] : undefined;
  if (!value) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  
  return parsed;
};

export const getEnvVarAsBoolean = (name: string, defaultValue: boolean): boolean => {
  const value = typeof globalThis.process !== 'undefined' ? globalThis.process.env[name] : undefined;
  if (!value) {
    return defaultValue;
  }
  
  return value.toLowerCase() === 'true' || value === '1';
};
