// Centralized Configuration System for KALE Pool Mining
// Based on reference implementation patterns

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config()

// Load environment variables from appropriate .env file
// Try multiple paths to find the correct .env file
const envPaths = [
  join(process.cwd(), 'Backend', '.env.mainnet'),
  join(process.cwd(), 'Backend', '.env'), 
  join(process.cwd(), '.env.mainnet'),
  join(process.cwd(), '.env'),
  // Also try relative to this config file's location
  join(__dirname, '..', '..', 'Backend', '.env.mainnet'),
  join(__dirname, '..', '..', 'Backend', '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`[Config] Loading environment from: ${envPath}`);
    config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('[Config] No .env file found, using system environment variables');
}

// Declare process global (available in Node.js runtime)
declare const process: { 
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
  cwd: () => string;
};

interface KalePoolConfig {
  // Core application settings
  NODE_ENV: string;
  LOG_LEVEL: string;
  
  // Backend API settings  
  BACKEND: {
    HOST: string;
    PORT: number;
    ID: string;
    CORS_ORIGIN: string[];
    JWT_SECRET: string;
    JWT_EXPIRES_IN: number;
    REFRESH_TOKEN_EXPIRES_IN: number;
  };
  
  // Pooler settings
  POOLER: {
    HOST: string;
    PORT: number;
    ID: string;
    AUTH_TOKEN: string;
  };
  
  // Database configuration
  DATABASE: {
    URL: string;
    SSL: boolean;
    POOL_SIZE: number;
    TIMEOUT_MS: number;
  };
  
  // Stellar network configuration
  STELLAR: {
    NETWORK: string;
    RPC_URL: string;
    CONTRACT_ID: string;
    NETWORK_PASSPHRASE: string;
  };
  
  // Launchtube integration
  LAUNCHTUBE: {
    URL: string;
    JWT: string;
  };
  
  // Block monitoring configuration
  BLOCK_MONITOR: {
    POLL_INTERVAL_MS: number;
    INITIAL_DELAY_MS: number;
    MAX_ERROR_COUNT: number;
    MAX_MISSED_BLOCKS: number;
    RETRY_ATTEMPTS: number;
  };
  
  // Backend API integration
  BACKEND_API: {
    URL: string;
    TIMEOUT_MS: number;
  };
  
  // Debug settings
  DEBUG: {
    ENDPOINTS_ENABLED: boolean;
  };
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function validateEnvironmentVariable(name: string, value: string | undefined, required: boolean = true): string {
  if (!value && required) {
    throw new ConfigurationError(`Required environment variable ${name} is not set`);
  }
  
  if (value && value.trim() === '') {
    throw new ConfigurationError(`Environment variable ${name} cannot be empty`);
  }
  
  return value || '';
}

function validateNumericEnvironmentVariable(name: string, value: string | undefined, required: boolean = true, defaultValue?: number): number {
  const stringValue = validateEnvironmentVariable(name, value, required);
  
  if (!stringValue && !required && defaultValue !== undefined) {
    return defaultValue;
  }
  
  const numericValue = parseInt(stringValue);
  
  if (isNaN(numericValue)) {
    throw new ConfigurationError(`Environment variable ${name} must be a valid number, got: ${stringValue}`);
  }
  
  if (numericValue < 0) {
    throw new ConfigurationError(`Environment variable ${name} must be a positive number, got: ${numericValue}`);
  }
  
  return numericValue;
}

function validateBooleanEnvironmentVariable(name: string, value: string | undefined, required: boolean = false, defaultValue: boolean = false): boolean {
  if (!value && !required) {
    return defaultValue;
  }
  
  const stringValue = validateEnvironmentVariable(name, value, required);
  return stringValue.toLowerCase() === 'true';
}

function parseCorsOrigins(corsOrigin: string | undefined): string[] {
  if (!corsOrigin) {
    return ['http://localhost:3000']; // default
  }
  
  return corsOrigin.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
}

function loadConfig(): KalePoolConfig {
  try {
    const config: KalePoolConfig = {
      // Core settings
      NODE_ENV: validateEnvironmentVariable('NODE_ENV', process.env.NODE_ENV, false) || 'development',
      LOG_LEVEL: validateEnvironmentVariable('LOG_LEVEL', process.env.LOG_LEVEL, false) || 'info',
      
      // Backend API settings
      BACKEND: {
        HOST: validateEnvironmentVariable('HOST', process.env.HOST, false) || '0.0.0.0',
        PORT: validateNumericEnvironmentVariable('BACKEND_PORT', process.env.BACKEND_PORT || process.env.PORT, false, 3000),
        ID: validateEnvironmentVariable('BACKEND_ID', process.env.BACKEND_ID, false) || 'kale-pool-backend',
        CORS_ORIGIN: parseCorsOrigins(process.env.CORS_ORIGIN),
        JWT_SECRET: validateEnvironmentVariable('JWT_SECRET', process.env.JWT_SECRET, false) || 'dev-secret-key-change-in-production-' + Math.random().toString(36),
        JWT_EXPIRES_IN: validateNumericEnvironmentVariable('JWT_EXPIRES_IN', process.env.JWT_EXPIRES_IN, false, 3600),
        REFRESH_TOKEN_EXPIRES_IN: validateNumericEnvironmentVariable('REFRESH_TOKEN_EXPIRES_IN', process.env.REFRESH_TOKEN_EXPIRES_IN, false, 604800),
      },
      
      // Pooler settings
      POOLER: {
        HOST: validateEnvironmentVariable('HOST', process.env.HOST, false) || '0.0.0.0',
        PORT: validateNumericEnvironmentVariable('POOLER_PORT', process.env.POOLER_PORT, false, 3001),
        ID: validateEnvironmentVariable('POOLER_ID', process.env.POOLER_ID, false) || '12345678-1234-5678-9abc-123456789000',
        AUTH_TOKEN: validateEnvironmentVariable('POOLER_AUTH_TOKEN', process.env.POOLER_AUTH_TOKEN, false) || 'dev-api-key-for-testing-only',
      },
      
      // Database configuration
      DATABASE: {
        URL: validateEnvironmentVariable('DATABASE_URL', process.env.DATABASE_URL, false) || 'postgresql://kale_user:kale_pass@localhost:5432/kale_pool_mainnet',
        SSL: validateBooleanEnvironmentVariable('DATABASE_SSL', process.env.NODE_ENV, false, false),
        POOL_SIZE: validateNumericEnvironmentVariable('DATABASE_POOL_SIZE', process.env.DATABASE_POOL_SIZE, false, 20),
        TIMEOUT_MS: validateNumericEnvironmentVariable('DATABASE_TIMEOUT_MS', process.env.DATABASE_TIMEOUT_MS, false, 30000),
      },
      
      // Stellar network configuration
      STELLAR: {
        NETWORK: validateEnvironmentVariable('STELLAR_NETWORK', process.env.STELLAR_NETWORK, false) || 'mainnet',
        RPC_URL: validateEnvironmentVariable('RPC_URL', process.env.RPC_URL, false) || 'https://mainnet.sorobanrpc.com',
        CONTRACT_ID: validateEnvironmentVariable('CONTRACT_ID', process.env.CONTRACT_ID),
        NETWORK_PASSPHRASE: validateEnvironmentVariable('NETWORK_PASSPHRASE', process.env.NETWORK_PASSPHRASE, false) || 'Public Global Stellar Network ; September 2015',
      },
      
      // Launchtube integration
      LAUNCHTUBE: {
        URL: validateEnvironmentVariable('LAUNCHTUBE_URL', process.env.LAUNCHTUBE_URL, false) || 'https://launchtube.xyz',
        JWT: validateEnvironmentVariable('LAUNCHTUBE_JWT', process.env.LAUNCHTUBE_JWT, false) || '',
      },
      
      // Block monitoring configuration
      BLOCK_MONITOR: {
        POLL_INTERVAL_MS: validateNumericEnvironmentVariable('BLOCK_POLL_INTERVAL_MS', process.env.BLOCK_POLL_INTERVAL_MS, false, 5000),
        INITIAL_DELAY_MS: validateNumericEnvironmentVariable('INITIAL_BLOCK_CHECK_DELAY_MS', process.env.INITIAL_BLOCK_CHECK_DELAY_MS, false, 10000),
        MAX_ERROR_COUNT: validateNumericEnvironmentVariable('MAX_ERROR_COUNT', process.env.MAX_ERROR_COUNT, false, 10),
        MAX_MISSED_BLOCKS: validateNumericEnvironmentVariable('MAX_MISSED_BLOCKS', process.env.MAX_MISSED_BLOCKS, false, 5),
        RETRY_ATTEMPTS: validateNumericEnvironmentVariable('RETRY_ATTEMPTS', process.env.RETRY_ATTEMPTS, false, 3),
      },
      
      // Backend API integration
      BACKEND_API: {
        URL: validateEnvironmentVariable('BACKEND_API_URL', process.env.BACKEND_API_URL, false) || 'http://localhost:3000',
        TIMEOUT_MS: validateNumericEnvironmentVariable('BACKEND_TIMEOUT', process.env.BACKEND_TIMEOUT, false, 30000),
      },
      
      // Debug settings
      DEBUG: {
        ENDPOINTS_ENABLED: validateBooleanEnvironmentVariable('ENABLE_DEBUG_ENDPOINTS', process.env.ENABLE_DEBUG_ENDPOINTS, false, false),
      },
    };
    
    // Validate specific values
    if (!['development', 'production', 'test'].includes(config.NODE_ENV)) {
      throw new ConfigurationError(`NODE_ENV must be one of: development, production, test. Got: ${config.NODE_ENV}`);
    }
    
    if (!['error', 'warn', 'info', 'debug'].includes(config.LOG_LEVEL)) {
      throw new ConfigurationError(`LOG_LEVEL must be one of: error, warn, info, debug. Got: ${config.LOG_LEVEL}`);
    }
    
    if (config.BACKEND.PORT < 1024 || config.BACKEND.PORT > 65535) {
      throw new ConfigurationError(`PORT must be between 1024 and 65535. Got: ${config.BACKEND.PORT}`);
    }
    
    if (!['mainnet', 'testnet', 'futurenet'].includes(config.STELLAR.NETWORK)) {
      throw new ConfigurationError(`STELLAR_NETWORK must be one of: mainnet, testnet, futurenet. Got: ${config.STELLAR.NETWORK}`);
    }
    
    if (!config.STELLAR.RPC_URL.startsWith('http')) {
      throw new ConfigurationError(`RPC_URL must be a valid URL starting with http/https. Got: ${config.STELLAR.RPC_URL}`);
    }
    
    if (!config.LAUNCHTUBE.URL.startsWith('http')) {
      throw new ConfigurationError(`LAUNCHTUBE_URL must be a valid URL starting with http/https. Got: ${config.LAUNCHTUBE.URL}`);
    }
    
    return config;
    
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let Config: KalePoolConfig;

try {
  Config = loadConfig();
} catch (error) {
  console.error('Configuration Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

export { Config, ConfigurationError, loadConfig };
export type { KalePoolConfig };
export default Config;