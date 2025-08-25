// Database service for KALE Pool Mining Backend
// Phase 1: PostgreSQL connection and query utilities

// Simple logger implementation
class DatabaseLogger {
  constructor(private component: string) {}

  info(message: string, context?: any): void {
    console.log(`[${new Date().toISOString()}] INFO [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
  }

  warn(message: string, context?: any): void {
    console.warn(`[${new Date().toISOString()}] WARN [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
  }

  error(message: string, error?: Error, context?: any): void {
    console.error(`[${new Date().toISOString()}] ERROR [${this.component}] ${message} ${error?.message || ''} ${context ? JSON.stringify(context) : ''}`);
  }

  debug(message: string, context?: any): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${new Date().toISOString()}] DEBUG [${this.component}] ${message} ${context ? JSON.stringify(context) : ''}`);
    }
  }
}

const logger = new DatabaseLogger('DatabaseService');

// Use dynamic import for pg to avoid build issues
let pgModule: any = null;

async function getPgModule() {
  if (!pgModule) {
    pgModule = await import('pg');
  }
  return pgModule;
}

// Simple retry utility
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
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

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
};

const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

const getEnvVarAsNumber = (name: string, defaultValue: number): number => {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  
  return parsed;
};

// Simple error creation
class PoolMiningError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;

  constructor(code: string, message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'PoolMiningError';
    this.code = code;
    this.context = context;
  }
}

const createError = (code: string, message: string, context?: Record<string, any>): PoolMiningError => {
  return new PoolMiningError(code, message, context);
};

// ======================
// DATABASE CONNECTION
// ======================

export class DatabaseService {
  private pool: any;
  private isConnected: boolean = false;

  async initialize(): Promise<void> {
    const pg = await getPgModule();
    
    const connectionString = getRequiredEnvVar('DATABASE_URL');
    const poolSize = getEnvVarAsNumber('DB_POOL_SIZE', 20);
    const timeoutMs = getEnvVarAsNumber('DB_TIMEOUT', 30000);

    this.pool = new pg.Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: timeoutMs,
      connectionTimeoutMillis: timeoutMs,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error', err, { pool_size: poolSize });
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.pool) {
        await this.initialize();
      }
      
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      
      logger.info('Database connection established', {
        pool_size: this.pool.totalCount,
        idle_connections: this.pool.idleCount,
        waiting_connections: this.pool.waitingCount
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database', error as Error);
      throw createError('DB_CONNECTION_FAILED', 'Failed to establish database connection', {
        error: (error as Error).message
      });
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
      }
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', error as Error);
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    return retryWithBackoff(async () => {
      const start = Date.now();
      
      try {
        const result = await this.pool.query(text, params);
        const duration = Date.now() - start;
        
        logger.debug('Database query executed', {
          query: text.substring(0, 100),
          params_count: params?.length || 0,
          rows_affected: result.rowCount,
          duration_ms: duration
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Database query failed', error as Error, {
          query: text.substring(0, 100),
          params_count: params?.length || 0,
          duration_ms: duration
        });
        
        throw createError('DB_QUERY_FAILED', 'Database query execution failed', {
          query: text.substring(0, 100),
          error: (error as Error).message
        });
      }
    });
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', error as Error);
      
      throw createError('DB_TRANSACTION_FAILED', 'Database transaction failed', {
        error: (error as Error).message
      });
    } finally {
      client.release();
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.pool && this.pool.totalCount > 0;
  }

  getConnectionStats() {
    if (!this.pool) {
      return {
        total_connections: 0,
        idle_connections: 0,
        waiting_connections: 0,
        is_connected: false
      };
    }
    
    return {
      total_connections: this.pool.totalCount,
      idle_connections: this.pool.idleCount,
      waiting_connections: this.pool.waitingCount,
      is_connected: this.isConnected
    };
  }
}

// ======================
// INTERFACE DEFINITIONS
// ======================

export interface FarmerRow {
  id: string;
  custodial_public_key: string;
  custodial_secret_key: string;
  pooler_id: string;
  payout_wallet_address: string;
  stake_percentage: number;
  current_balance: string;
  is_funded: boolean;
  status: string;
  created_at: string;
}

export interface PoolerRow {
  id: string;
  name: string;
  public_key: string;
  api_key: string;
  api_endpoint: string;
  max_farmers: number;
  current_farmers: number;
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

export interface PlantingRow {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  stake_amount: string;
  transaction_hash: string;
  status: string;
  error_message: string | null;
  planted_at: string;
}

export interface WorkRow {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  nonce: string;
  hash: string;
  zeros: number;
  gap: number;
  transaction_hash: string;
  status: string;
  error_message: string | null;
  compensation_required: boolean;
  worked_at: string;
}

export interface HarvestRow {
  id: string;
  block_index: number;
  farmer_id: string;
  pooler_id: string;
  custodial_wallet: string;
  reward_amount: string;
  transaction_hash: string;
  status: string;
  error_message: string | null;
  harvested_at: string;
}

// ======================
// QUERY CLASSES
// ======================

export class FarmerQueries {
  constructor(private db: DatabaseService) {}

  async createFarmer(
    poolerId: string,
    custodialPublicKey: string,
    custodialSecretKey: string,
    payoutWallet: string,
    stakePercentage: number
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO farmers (
        pooler_id, custodial_public_key, custodial_secret_key, 
        payout_wallet_address, stake_percentage
      ) VALUES ($1, $2, $3, $4, $5) 
      RETURNING id`,
      [poolerId, custodialPublicKey, custodialSecretKey, payoutWallet, stakePercentage]
    );
    
    return result.rows[0].id;
  }

  async getFarmerById(farmerId: string): Promise<FarmerRow | null> {
    const result = await this.db.query(
      'SELECT * FROM farmers WHERE id = $1',
      [farmerId]
    );
    
    return result.rows[0] || null;
  }

  async getActiveFarmersByPooler(poolerId: string): Promise<FarmerRow[]> {
    const result = await this.db.query(
      'SELECT * FROM farmers WHERE pooler_id = $1 AND status = $2 AND is_funded = true',
      [poolerId, 'active']
    );
    
    return result.rows;
  }

  async updateFarmerFunding(farmerId: string, isFunded: boolean, balance?: string): Promise<void> {
    if (balance) {
      await this.db.query(
        'UPDATE farmers SET is_funded = $1, current_balance = $2 WHERE id = $3',
        [isFunded, balance, farmerId]
      );
    } else {
      await this.db.query(
        'UPDATE farmers SET is_funded = $1 WHERE id = $2',
        [isFunded, farmerId]
      );
    }
  }

  async updateFarmerBalance(farmerId: string, newBalance: string): Promise<void> {
    await this.db.query(
      'UPDATE farmers SET current_balance = $1 WHERE id = $2',
      [newBalance, farmerId]
    );
  }
}

export class PoolerQueries {
  constructor(private db: DatabaseService) {}

  async createPooler(
    name: string,
    publicKey: string,
    apiKey: string,
    apiEndpoint: string,
    maxFarmers: number
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO poolers (name, public_key, api_key, api_endpoint, max_farmers) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [name, publicKey, apiKey, apiEndpoint, maxFarmers]
    );
    
    return result.rows[0].id;
  }

  async getPoolerByApiKey(apiKey: string): Promise<PoolerRow | null> {
    const result = await this.db.query(
      'SELECT * FROM poolers WHERE api_key = $1 AND is_active = true',
      [apiKey]
    );
    
    return result.rows[0] || null;
  }

  async updatePoolerLastSeen(poolerId: string): Promise<void> {
    await this.db.query(
      'UPDATE poolers SET last_seen = NOW() WHERE id = $1',
      [poolerId]
    );
  }
}

export class PlantQueries {
  constructor(private db: DatabaseService) {}

  async recordPlanting(
    blockIndex: number,
    farmerId: string,
    poolerId: string,
    custodialWallet: string,
    stakeAmount: string,
    transactionHash: string,
    status: 'success' | 'failed',
    errorMessage?: string
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO plantings (
        block_index, farmer_id, pooler_id, custodial_wallet, 
        stake_amount, transaction_hash, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id`,
      [blockIndex, farmerId, poolerId, custodialWallet, stakeAmount, transactionHash, status, errorMessage]
    );
    
    return result.rows[0].id;
  }

  async getSuccessfulPlantings(blockIndex: number, poolerId: string): Promise<PlantingRow[]> {
    const result = await this.db.query(
      'SELECT * FROM plantings WHERE block_index = $1 AND pooler_id = $2 AND status = $3',
      [blockIndex, poolerId, 'success']
    );
    
    return result.rows;
  }
}

export class WorkQueries {
  constructor(private db: DatabaseService) {}

  async recordWork(
    blockIndex: number,
    farmerId: string,
    poolerId: string,
    custodialWallet: string,
    nonce: string,
    hash: string,
    zeros: number,
    gap: number,
    transactionHash: string,
    status: 'success' | 'failed',
    errorMessage?: string,
    compensationRequired: boolean = false
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO works (
        block_index, farmer_id, pooler_id, custodial_wallet, nonce, hash, 
        zeros, gap, transaction_hash, status, error_message, compensation_required
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING id`,
      [blockIndex, farmerId, poolerId, custodialWallet, nonce, hash, zeros, gap, 
       transactionHash, status, errorMessage, compensationRequired]
    );
    
    return result.rows[0].id;
  }
}

export class HarvestQueries {
  constructor(private db: DatabaseService) {}

  async recordHarvest(
    blockIndex: number,
    farmerId: string,
    poolerId: string,
    custodialWallet: string,
    rewardAmount: string,
    transactionHash: string,
    status: 'success' | 'failed',
    errorMessage?: string
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO harvests (
        block_index, farmer_id, pooler_id, custodial_wallet, 
        reward_amount, transaction_hash, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id`,
      [blockIndex, farmerId, poolerId, custodialWallet, rewardAmount, transactionHash, status, errorMessage]
    );
    
    return result.rows[0].id;
  }

  async getHarvestableFarmers(blockIndex: number, poolerId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT w.farmer_id 
       FROM works w
       LEFT JOIN harvests h ON w.farmer_id = h.farmer_id AND w.block_index = h.block_index
       WHERE w.block_index = $1 AND w.pooler_id = $2 AND w.status = 'success' 
       AND h.id IS NULL`,
      [blockIndex, poolerId]
    );
    
    return result.rows.map((row: { farmer_id: string }) => row.farmer_id);
  }
}

// Create and export singleton instances
const db = new DatabaseService();
export const farmerQueries = new FarmerQueries(db);
export const poolerQueries = new PoolerQueries(db);
export const plantQueries = new PlantQueries(db);
export const workQueries = new WorkQueries(db);
export const harvestQueries = new HarvestQueries(db);

export default db;
