// Database Phase 2 Extensions - Farmer Onboarding System
// User registration, pool contracts, and balance monitoring queries

import { db, DatabaseService } from './database';

// Type definitions for Phase 2
export interface UserRow {
  id: string;
  email: string;
  external_wallet: string;
  status: 'registered' | 'verified' | 'suspended';
  created_at: Date;
  verified_at?: Date;
}

export interface PoolContractRow {
  id: string;
  farmer_id: string;
  pooler_id: string;
  stake_percentage: number;
  harvest_interval: number;
  reward_split: number;
  platform_fee: number;
  status: 'pending' | 'active' | 'exiting' | 'completed';
  created_at: Date;
  confirmed_at?: Date;
  exit_requested_at?: Date;
  contract_terms: Record<string, any>;
}

export interface BalanceCheckRow {
  id: string;
  farmer_id: string;
  custodial_wallet: string;
  xlm_balance?: number;
  is_funded: boolean;
  checked_at: Date;
  status: 'checking' | 'funded' | 'insufficient';
}

export interface PoolStatisticsRow {
  id: string;
  name: string;
  reward_percentage: number;
  current_farmers: number;
  max_farmers: number;
  status: string;
  blocks_participated: number;
  success_rate: number;
  avg_reward_per_block: number;
  created_at: Date;
  last_seen?: Date;
}

// ======================
// USER QUERIES
// ======================

export class UserQueries {
  constructor(private db: DatabaseService) {}

  async createUser(
    email: string,
    externalWallet: string
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO users (email, external_wallet, status) 
       VALUES ($1, $2, 'registered') 
       RETURNING id`,
      [email, externalWallet]
    );
    
    return result.rows[0].id;
  }

  async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return result.rows[0] || null;
  }

  async getUserById(userId: string): Promise<UserRow | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    return result.rows[0] || null;
  }

  async updateUserStatus(
    userId: string,
    status: 'registered' | 'verified' | 'suspended'
  ): Promise<void> {
    await this.db.query(
      'UPDATE users SET status = $1 WHERE id = $2',
      [status, userId]
    );
  }

  async verifyUser(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET status = $1, verified_at = NOW() WHERE id = $2',
      ['verified', userId]
    );
  }
}

// ======================
// ENHANCED FARMER QUERIES
// ======================

export class FarmerQueriesPhase2 {
  constructor(private db: DatabaseService) {}

  async createFarmerWithUser(
    userId: string,
    custodialPublicKey: string,
    custodialSecretKey: string,
    externalWallet: string
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO farmers (
        user_id, custodial_public_key, custodial_secret_key, 
        payout_wallet_address, status_new
      ) VALUES ($1, $2, $3, $4, 'wallet_created') 
      RETURNING id`,
      [userId, custodialPublicKey, custodialSecretKey, externalWallet]
    );
    
    return result.rows[0].id;
  }

  async getFarmerByUserId(userId: string): Promise<any | null> {
    const result = await this.db.query(
      'SELECT * FROM farmers WHERE user_id = $1',
      [userId]
    );
    
    return result.rows[0] || null;
  }

  async updateFarmerStatus(
    farmerId: string,
    status: 'wallet_created' | 'funded' | 'active_in_pool' | 'exiting' | 'exited'
  ): Promise<void> {
    const updateFields = ['status_new = $1'];
    const values = [status];
    
    if (status === 'funded') {
      updateFields.push('funded_at = NOW()');
    } else if (status === 'active_in_pool') {
      updateFields.push('joined_pool_at = NOW()');
    }
    
    await this.db.query(
      `UPDATE farmers SET ${updateFields.join(', ')} WHERE id = $2`,
      [...values, farmerId]
    );
  }

  async getFarmersWithActiveContracts(poolerId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT f.*, pc.stake_percentage, pc.harvest_interval, pc.reward_split
       FROM farmers f
       JOIN pool_contracts pc ON f.id = pc.farmer_id
       WHERE pc.pooler_id = $1 AND pc.status = 'active' AND f.status_new = 'active_in_pool'
       ORDER BY pc.created_at ASC`,
      [poolerId]
    );
    
    return result.rows;
  }

  async updateFarmerBalance(farmerId: string, newBalance: string): Promise<void> {
    await this.db.query(
      'UPDATE farmers SET current_balance = $1 WHERE id = $2',
      [newBalance, farmerId]
    );
  }
}

// ======================
// POOL CONTRACT QUERIES
// ======================

export class PoolContractQueries {
  constructor(private db: DatabaseService) {}

  async createPoolContract(
    farmerId: string,
    poolerId: string,
    stakePercentage: number,
    harvestInterval: number,
    rewardSplit: number,
    platformFee: number = 0.05,
    contractTerms: Record<string, any> = {}
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO pool_contracts (
        farmer_id, pooler_id, stake_percentage, harvest_interval,
        reward_split, platform_fee, status, contract_terms
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) 
      RETURNING id`,
      [farmerId, poolerId, stakePercentage, harvestInterval, rewardSplit, platformFee, JSON.stringify(contractTerms)]
    );
    
    return result.rows[0].id;
  }

  async getPoolContract(contractId: string): Promise<PoolContractRow | null> {
    const result = await this.db.query(
      'SELECT * FROM pool_contracts WHERE id = $1',
      [contractId]
    );
    
    return result.rows[0] || null;
  }

  async confirmPoolContract(contractId: string): Promise<void> {
    await this.db.query(
      `UPDATE pool_contracts 
       SET status = 'active', confirmed_at = NOW() 
       WHERE id = $1`,
      [contractId]
    );
  }

  async getActiveContractByFarmer(farmerId: string): Promise<PoolContractRow | null> {
    const result = await this.db.query(
      'SELECT * FROM pool_contracts WHERE farmer_id = $1 AND status = $2',
      [farmerId, 'active']
    );
    
    return result.rows[0] || null;
  }

  async getActiveContractsByPooler(poolerId: string): Promise<PoolContractRow[]> {
    const result = await this.db.query(
      'SELECT * FROM pool_contracts WHERE pooler_id = $1 AND status = $2 ORDER BY created_at ASC',
      [poolerId, 'active']
    );
    
    return result.rows;
  }

  async requestContractExit(contractId: string): Promise<void> {
    await this.db.query(
      `UPDATE pool_contracts 
       SET status = 'exiting', exit_requested_at = NOW() 
       WHERE id = $1`,
      [contractId]
    );
  }

  async completeContractExit(contractId: string): Promise<void> {
    await this.db.query(
      'UPDATE pool_contracts SET status = $1 WHERE id = $2',
      ['completed', contractId]
    );
  }
}

// ======================
// BALANCE CHECK QUERIES
// ======================

export class BalanceCheckQueries {
  constructor(private db: DatabaseService) {}

  async recordBalanceCheck(
    farmerId: string,
    custodialWallet: string,
    xlmBalance: number | null,
    isFunded: boolean,
    status: 'checking' | 'funded' | 'insufficient'
  ): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO balance_checks (
        farmer_id, custodial_wallet, xlm_balance, is_funded, status
      ) VALUES ($1, $2, $3, $4, $5) 
      RETURNING id`,
      [farmerId, custodialWallet, xlmBalance, isFunded, status]
    );
    
    return result.rows[0].id;
  }

  async getLatestBalanceCheck(farmerId: string): Promise<BalanceCheckRow | null> {
    const result = await this.db.query(
      `SELECT * FROM balance_checks 
       WHERE farmer_id = $1 
       ORDER BY checked_at DESC 
       LIMIT 1`,
      [farmerId]
    );
    
    return result.rows[0] || null;
  }

  async getFarmersNeedingBalanceCheck(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT f.id 
       FROM farmers f
       LEFT JOIN balance_checks bc ON f.id = bc.farmer_id
       WHERE f.status_new IN ('wallet_created', 'funded') 
       AND (bc.checked_at IS NULL OR bc.checked_at < NOW() - INTERVAL '1 hour')`,
      []
    );
    
    return result.rows.map((row: { id: string }) => row.id);
  }
}

// ======================
// POOL STATISTICS QUERIES  
// ======================

export class PoolStatisticsQueries {
  constructor(private db: DatabaseService) {}

  async getAvailablePoolers(): Promise<PoolStatisticsRow[]> {
    const result = await this.db.query(
      `SELECT * FROM pool_statistics 
       WHERE status = 'active' AND current_farmers < max_farmers
       ORDER BY reward_percentage DESC`,
      []
    );
    
    return result.rows;
  }

  async getPoolerDetails(poolerId: string): Promise<PoolStatisticsRow | null> {
    const result = await this.db.query(
      'SELECT * FROM pool_statistics WHERE id = $1',
      [poolerId]
    );
    
    return result.rows[0] || null;
  }

  async getPoolerPerformanceStats(poolerId: string, days: number = 30): Promise<any> {
    const result = await this.db.query(
      `SELECT 
        COUNT(DISTINCT bo.block_index) as blocks_participated,
        AVG(CASE WHEN bo.total_farmers > 0 THEN bo.successful_plants::DECIMAL / bo.total_farmers ELSE 0 END) as avg_plant_success_rate,
        AVG(CASE WHEN bo.successful_plants > 0 THEN bo.successful_works::DECIMAL / bo.successful_plants ELSE 0 END) as avg_work_success_rate,
        AVG(CASE WHEN bo.successful_works > 0 THEN bo.successful_harvests::DECIMAL / bo.successful_works ELSE 0 END) as avg_harvest_success_rate,
        SUM(bo.total_rewards) as total_rewards_distributed,
        AVG(bo.total_rewards::DECIMAL / GREATEST(bo.successful_harvests, 1)) as avg_reward_per_farmer
       FROM block_operations bo
       WHERE bo.pooler_id = $1 
       AND bo.plant_requested_at >= NOW() - INTERVAL '${days} days'
       AND bo.status = 'completed'`,
      [poolerId]
    );
    
    return result.rows[0] || {
      blocks_participated: 0,
      avg_plant_success_rate: 0,
      avg_work_success_rate: 0, 
      avg_harvest_success_rate: 0,
      total_rewards_distributed: 0,
      avg_reward_per_farmer: 0
    };
  }
}

// ======================
// ENHANCED POOLER QUERIES
// ======================

export class PoolerQueriesPhase2 {
  constructor(private db: DatabaseService) {}

  async updatePoolerRewardSettings(
    poolerId: string,
    rewardPercentage: number,
    terms: Record<string, any>
  ): Promise<void> {
    await this.db.query(
      `UPDATE poolers 
       SET reward_percentage = $1, terms = $2 
       WHERE id = $3`,
      [rewardPercentage, JSON.stringify(terms), poolerId]
    );
  }

  async setPoolerStatus(
    poolerId: string,
    status: 'active' | 'full' | 'paused'
  ): Promise<void> {
    await this.db.query(
      'UPDATE poolers SET status_new = $1 WHERE id = $2',
      [status, poolerId]
    );
  }

  async getPoolerWithSettings(poolerId: string): Promise<any | null> {
    const result = await this.db.query(
      'SELECT * FROM poolers WHERE id = $1',
      [poolerId]
    );
    
    return result.rows[0] || null;
  }
}

// ======================
// BLOCK OPERATIONS QUERIES
// ======================

class BlockOperationsQueries {
  constructor(private db: DatabaseService) {}

  async recordBlockDiscovery(
    blockIndex: number, 
    poolerId: string, 
    blockMetadata: any
  ): Promise<string> {
    const result = await this.db.query(`
      INSERT INTO block_operations (
        block_index, pooler_id, status, 
        plant_requested_at, total_farmers,
        total_staked
      ) VALUES ($1, $2, 'discovered', NOW(), $3, 0)
      RETURNING id
    `, [
      blockIndex, 
      poolerId, 
      blockMetadata.activeFarmersCount || 0
    ]);
    
    const blockOperationId = result.rows[0].id;
    
    // Log the immediate database record creation
    const { databaseLogger } = await import('../../../Shared/utils/logger');
    databaseLogger.info('Block discovery recorded immediately', {
      block_operation_id: blockOperationId,
      block_index: blockIndex,
      pooler_id: poolerId,
      active_farmers: blockMetadata.activeFarmersCount || 0,
      plantable: blockMetadata.plantable,
      block_age: blockMetadata.blockAge
    });
    
    return blockOperationId;
  }

  async updateBlockOperationStatus(
    blockOperationId: string, 
    status: string, 
    metadata: any
  ): Promise<void> {
    await this.db.query(`
      UPDATE block_operations 
      SET status = $2, total_farmers = $3
      WHERE id = $1
    `, [blockOperationId, status, metadata.totalActiveFarmers || 0]);
  }

  async updateBlockOperationWithPlantingResults(
    blockOperationId: string,
    plantingData: {
      successfulPlants: number;
      failedPlants: number;
      totalStaked: string;
      plantingDuration: number;
      plantingDetails: any[];
    }
  ): Promise<void> {
    await this.db.query(`
      UPDATE block_operations 
      SET status = 'planting_completed',
          successful_plants = $2,
          plant_completed_at = NOW(),
          total_staked = $3
      WHERE id = $1
    `, [
      blockOperationId, 
      plantingData.successfulPlants, 
      plantingData.totalStaked
    ]);
    
    // Log comprehensive planting results
    const { databaseLogger } = await import('../../../Shared/utils/logger');
    databaseLogger.info('Block operation updated with planting results', {
      block_operation_id: blockOperationId,
      successful_plants: plantingData.successfulPlants,
      failed_plants: plantingData.failedPlants,
      total_staked: plantingData.totalStaked,
      duration_ms: plantingData.plantingDuration,
      farmers_involved: plantingData.plantingDetails.length
    });
  }

  async getActiveBlockOperations(limit: number = 10): Promise<any[]> {
    const result = await this.db.query(`
      SELECT bo.*, p.name as pooler_name
      FROM block_operations bo
      JOIN poolers p ON bo.pooler_id = p.id
      ORDER BY bo.plant_requested_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }

  async getBlockOperationsByStatus(status: string, limit: number = 10): Promise<any[]> {
    const result = await this.db.query(`
      SELECT bo.*, p.name as pooler_name
      FROM block_operations bo
      JOIN poolers p ON bo.pooler_id = p.id
      WHERE bo.status = $1
      ORDER BY bo.plant_requested_at DESC
      LIMIT $2
    `, [status, limit]);
    
    return result.rows;
  }
}

// Add missing method to PoolContractQueries
class PoolContractQueriesExtended extends PoolContractQueries {
  async getActiveFarmersForPlanting(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT DISTINCT f.id, f.custodial_public_key, f.custodial_secret_key, 
             pc.stake_percentage, pc.pooler_id, u.email
      FROM farmers f
      JOIN pool_contracts pc ON f.id = pc.farmer_id
      JOIN users u ON f.user_id = u.id
      WHERE pc.status = 'active' 
        AND f.status_new = 'active_in_pool'
        AND f.is_funded = true
      ORDER BY f.id
    `);
    
    return result.rows;
  }
}

// Create and export singleton instances extending Phase 1  
export const userQueries = new UserQueries(db);
export const farmerQueriesPhase2 = new FarmerQueriesPhase2(db);  
export const poolContractQueries = new PoolContractQueriesExtended(db);
export const balanceCheckQueries = new BalanceCheckQueries(db);
export const poolStatisticsQueries = new PoolStatisticsQueries(db);
export const poolerQueriesPhase2 = new PoolerQueriesPhase2(db);
export const blockOperationsQueries = new BlockOperationsQueries(db);