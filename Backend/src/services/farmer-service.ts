import { db } from './database';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { AuthUser, UserRole } from '../types/auth-types';

interface FarmerAssociation {
  id: string;
  userId: string;
  status: string;
}

export interface FarmerAnalyticsParams {
  farmerId: string;
  poolerId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  status?: 'success' | 'failed' | 'all';
  user: AuthUser;
}

export interface FarmerSummaryParams {
  farmerId: string;
  poolerId?: string;
  window: '24h' | '7d' | '30d' | 'all';
  user: AuthUser;
}

export interface PlantingRecord {
  id: string;
  blockIndex: number;
  poolerId: string;
  poolerName: string;
  stakeAmount: string;
  stakeAmountHuman: string;
  transactionHash: string;
  status: string;
  plantedAt: string;
}

export interface HarvestRecord {
  id: string;
  blockIndex: number;
  poolerId: string;
  poolerName: string;
  rewardAmount: string;
  rewardAmountHuman: string;
  transactionHash: string;
  status: string;
  harvestedAt: string;
}

export interface FarmerSummary {
  farmerId: string;
  contract: {
    id: string;
    poolerId: string;
    poolerName: string;
    stakePercentage: number;
    harvestInterval: number;
    rewardSplit: number;
    status: string;
    joinedAt: string;
  } | null;
  current: {
    balance: string;
    balanceHuman: string;
    lastStakeAmount: string;
    lastStakeAmountHuman: string;
    lastStakeBlock: number | null;
    lastRewardAmount: string;
    lastRewardAmountHuman: string;
    lastRewardBlock: number | null;
  };
  lifetime: {
    totalStaked: string;
    totalStakedHuman: string;
    totalRewards: string;
    totalRewardsHuman: string;
    blocksParticipated: number;
    successRate: number;
  };
  window: {
    range: string;
    staked: string;
    stakedHuman: string;
    rewards: string;
    rewardsHuman: string;
    blocks: number;
    averageRewardPerBlock: string;
  };
}

export class FarmerService {
  
  async validateFarmerAssociation(userId: string): Promise<{ farmerId: string } | null> {
    try {
      const result = await db.query(
        `SELECT f.id as farmer_id
         FROM farmers f
         WHERE f.user_id = $1
         AND f.status = 'active'
         LIMIT 1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        logger.info('No active farmer found for user:', { userId });
        return null;
      }
      
      logger.debug('Found farmer association:', { 
        userId, 
        farmerId: result.rows[0].farmer_id 
      });
      
      return { farmerId: result.rows[0].farmer_id };
    } catch (error) {
      logger.error('Failed to validate farmer association:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
      throw error;
    }
  }

  async getFarmerById(farmerId: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT f.id,
                f.user_id,
                f.pooler_id,
                f.custodial_public_key,
                f.payout_wallet_address,
                f.stake_percentage,
                f.current_balance,
                f.is_funded,
                f.status,
                f.status_new,
                f.created_at,
                f.funded_at,
                f.joined_pool_at,
                f.last_exit_at,
                f.exit_count,
                u.email,
                u.created_at as user_created_at,
                u.last_login_at as user_last_login,
                pc.id as contract_id,
                pc.status as contract_status,
                pc.created_at as contract_created_at,
                pc.stake_percentage as contract_stake_percentage,
                pc.harvest_interval,
                pc.reward_split,
                pc.platform_fee,
                pc.contract_terms
         FROM farmers f
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN pool_contracts pc ON f.id = pc.farmer_id AND pc.status = 'active'
         WHERE f.id = $1`,
        [farmerId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Structure the response with contract details if available
      const farmer = result.rows[0];
      const response = {
        farmer: {
          id: farmer.id,
          user_id: farmer.user_id,
          pooler_id: farmer.pooler_id,
          custodial_public_key: farmer.custodial_public_key,
          payout_wallet_address: farmer.payout_wallet_address,
          stake_percentage: farmer.stake_percentage,
          current_balance: farmer.current_balance,
          is_funded: farmer.is_funded,
          status: farmer.status,
          status_new: farmer.status_new,
          created_at: farmer.created_at,
          funded_at: farmer.funded_at,
          joined_pool_at: farmer.joined_pool_at,
          last_exit_at: farmer.last_exit_at,
          exit_count: farmer.exit_count,
          email: farmer.email,
          user_created_at: farmer.user_created_at,
          user_last_login: farmer.user_last_login
        },
        active_contract: farmer.contract_id ? {
          id: farmer.contract_id,
          status: farmer.contract_status,
          created_at: farmer.contract_created_at,
          stake_percentage: farmer.contract_stake_percentage,
          harvest_interval: farmer.harvest_interval,
          reward_split: farmer.reward_split,
          platform_fee: farmer.platform_fee,
          contract_terms: farmer.contract_terms
        } : null
      };
      
      return response;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get farmer by id:', {
        message: err.message,
        farmerId,
        stack: err.stack
      });
      throw err;
    }
  }

  async getAllFarmers(options: { page: number; limit: number; }): Promise<{
    page: number;
    limit: number;
    total: number;
    items: any[];
  }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;
      
      const countResult = await db.query('SELECT COUNT(*) FROM farmers');
      const total = parseInt(countResult.rows[0].count);
      
      const result = await db.query(
        `SELECT f.*,
                u.email,
                u.created_at as user_created_at,
                u.last_login_at as user_last_login
         FROM farmers f
         LEFT JOIN users u ON f.user_id = u.id
         ORDER BY f.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      return {
        page,
        limit,
        total,
        items: result.rows
      };
    } catch (error) {
      logger.error('Failed to get all farmers:', { error });
      throw error;
    }
  }
  
  async getFarmerPlantings(params: FarmerAnalyticsParams): Promise<{
    farmerId: string;
    page: number;
    limit: number;
    total: number;
    items: PlantingRecord[];
  }> {
    try {
      const { farmerId, poolerId, from, to, page, limit, status, user } = params;
      const offset = (page - 1) * limit;
      
      // Check permissions
      if (user.role === UserRole.FARMER && user.entityId !== farmerId) {
        throw new Error('Access denied to farmer plantings');
      }
      
      // Build WHERE clause
      const whereConditions: string[] = ['p.farmer_id = $1'];
      const queryParams: any[] = [farmerId];
      let paramIndex = 2;
      
      if (poolerId) {
        whereConditions.push(`p.pooler_id = $${paramIndex++}`);
        queryParams.push(poolerId);
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`p.status = $${paramIndex++}`);
        queryParams.push(status);
      }
      
      if (from) {
        if (this.isBlockIndex(from)) {
          whereConditions.push(`p.block_index >= $${paramIndex++}`);
          queryParams.push(parseInt(from));
        } else {
          whereConditions.push(`p.planted_at >= $${paramIndex++}`);
          queryParams.push(new Date(from));
        }
      }
      
      if (to) {
        if (this.isBlockIndex(to)) {
          whereConditions.push(`p.block_index <= $${paramIndex++}`);
          queryParams.push(parseInt(to));
        } else {
          whereConditions.push(`p.planted_at <= $${paramIndex++}`);
          queryParams.push(new Date(to));
        }
      }
      
      const whereClause = 'WHERE ' + whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM plantings p
        JOIN poolers po ON p.pooler_id = po.id
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get plantings
      const mainQuery = `
        SELECT 
          p.id,
          p.block_index,
          p.pooler_id,
          po.name as pooler_name,
          p.stake_amount,
          p.transaction_hash,
          p.status,
          p.planted_at
        FROM plantings p
        JOIN poolers po ON p.pooler_id = po.id
        ${whereClause}
        ORDER BY p.planted_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(limit, offset);
      const result = await db.query(mainQuery, queryParams);
      
      const items: PlantingRecord[] = result.rows.map(row => ({
        id: row.id,
        blockIndex: row.block_index,
        poolerId: row.pooler_id,
        poolerName: row.pooler_name,
        stakeAmount: row.stake_amount?.toString() || '0',
        stakeAmountHuman: this.formatKaleAmount(row.stake_amount?.toString() || '0'),
        transactionHash: row.transaction_hash || '',
        status: row.status,
        plantedAt: row.planted_at
      }));
      
      logger.info(`Farmer plantings query completed: ${JSON.stringify({
        farmer_id: farmerId,
        user_id: user.id,
        page,
        limit,
        total,
        items_returned: items.length
      })}`);
      
      return {
        farmerId,
        page,
        limit,
        total,
        items
      };
      
    } catch (error) {
      logger.error('Farmer plantings query failed', error as Error, {
        farmer_id: params.farmerId,
        user_id: params.user.id
      });
      throw error;
    }
  }
  
  async getFarmerHarvests(params: FarmerAnalyticsParams): Promise<{
    farmerId: string;
    page: number;
    limit: number;
    total: number;
    items: HarvestRecord[];
  }> {
    try {
      const { farmerId, poolerId, from, to, page, limit, status, user } = params;
      const offset = (page - 1) * limit;
      
      // Check permissions
      if (user.role === UserRole.FARMER && user.entityId !== farmerId) {
        throw new Error('Access denied to farmer harvests');
      }
      
      // Build WHERE clause
      const whereConditions: string[] = ['h.farmer_id = $1'];
      const queryParams: any[] = [farmerId];
      let paramIndex = 2;
      
      if (poolerId) {
        whereConditions.push(`h.pooler_id = $${paramIndex++}`);
        queryParams.push(poolerId);
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`h.status = $${paramIndex++}`);
        queryParams.push(status);
      }
      
      if (from) {
        if (this.isBlockIndex(from)) {
          whereConditions.push(`h.block_index >= $${paramIndex++}`);
          queryParams.push(parseInt(from));
        } else {
          whereConditions.push(`h.harvested_at >= $${paramIndex++}`);
          queryParams.push(new Date(from));
        }
      }
      
      if (to) {
        if (this.isBlockIndex(to)) {
          whereConditions.push(`h.block_index <= $${paramIndex++}`);
          queryParams.push(parseInt(to));
        } else {
          whereConditions.push(`h.harvested_at <= $${paramIndex++}`);
          queryParams.push(new Date(to));
        }
      }
      
      const whereClause = 'WHERE ' + whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM harvests h
        JOIN poolers po ON h.pooler_id = po.id
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get harvests
      const mainQuery = `
        SELECT 
          h.id,
          h.block_index,
          h.pooler_id,
          po.name as pooler_name,
          h.reward_amount,
          h.transaction_hash,
          h.status,
          h.harvested_at
        FROM harvests h
        JOIN poolers po ON h.pooler_id = po.id
        ${whereClause}
        ORDER BY h.harvested_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(limit, offset);
      const result = await db.query(mainQuery, queryParams);
      
      const items: HarvestRecord[] = result.rows.map(row => ({
        id: row.id,
        blockIndex: row.block_index,
        poolerId: row.pooler_id,
        poolerName: row.pooler_name,
        rewardAmount: row.reward_amount?.toString() || '0',
        rewardAmountHuman: this.formatKaleAmount(row.reward_amount?.toString() || '0'),
        transactionHash: row.transaction_hash || '',
        status: row.status,
        harvestedAt: row.harvested_at
      }));
      
      logger.info(`Farmer harvests query completed: ${JSON.stringify({
        farmer_id: farmerId,
        user_id: user.id,
        page,
        limit,
        total,
        items_returned: items.length
      })}`);
      
      return {
        farmerId,
        page,
        limit,
        total,
        items
      };
      
    } catch (error) {
      logger.error('Farmer harvests query failed', error as Error, {
        farmer_id: params.farmerId,
        user_id: params.user.id
      });
      throw error;
    }
  }
  
  async getFarmerSummary(params: FarmerSummaryParams): Promise<FarmerSummary> {
    try {
      const { farmerId, poolerId, window, user } = params;
      
      // Check permissions
      if (user.role === UserRole.FARMER && user.entityId !== farmerId) {
        throw new Error('Access denied to farmer summary');
      }
      
      // Build time window clause
      let windowClause = '';
      switch (window) {
        case '24h':
          windowClause = "AND created_at >= NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          windowClause = "AND created_at >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          windowClause = "AND created_at >= NOW() - INTERVAL '30 days'";
          break;
        case 'all':
        default:
          windowClause = '';
          break;
      }
      
      // Get comprehensive farmer summary
      const query = `
        WITH farmer_info AS (
          SELECT f.id, f.current_balance, f.custodial_public_key
          FROM farmers f
          WHERE f.id = $1
        ),
        active_contract AS (
          SELECT 
            pc.id, pc.pooler_id, po.name as pooler_name,
            pc.stake_percentage, pc.harvest_interval, pc.reward_split,
            pc.status, pc.confirmed_at as joined_at
          FROM pool_contracts pc
          JOIN poolers po ON pc.pooler_id = po.id
          WHERE pc.farmer_id = $1 AND pc.status = 'active'
          LIMIT 1
        ),
        lifetime_stats AS (
          SELECT
            COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.stake_amount::numeric ELSE 0 END), 0) as total_staked,
            COALESCE(SUM(CASE WHEN h.status = 'success' THEN h.reward_amount::numeric ELSE 0 END), 0) as total_rewards,
            COUNT(DISTINCT CASE WHEN p.status = 'success' THEN p.block_index END) as blocks_participated,
            CASE 
              WHEN COUNT(p.id) > 0 
              THEN ROUND(COUNT(CASE WHEN p.status = 'success' THEN 1 END)::decimal / COUNT(p.id), 4)
              ELSE 0 
            END as success_rate
          FROM plantings p
          LEFT JOIN harvests h ON p.farmer_id = h.farmer_id AND p.block_index = h.block_index
          WHERE p.farmer_id = $1
        ),
        window_stats AS (
          SELECT
            COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.stake_amount::numeric ELSE 0 END), 0) as window_staked,
            COALESCE(SUM(CASE WHEN h.status = 'success' THEN h.reward_amount::numeric ELSE 0 END), 0) as window_rewards,
            COUNT(DISTINCT CASE WHEN p.status = 'success' THEN p.block_index END) as window_blocks
          FROM plantings p
          LEFT JOIN harvests h ON p.farmer_id = h.farmer_id AND p.block_index = h.block_index
          WHERE p.farmer_id = $1 ${windowClause.replace('created_at', 'p.planted_at')}
        ),
        recent_activity AS (
          SELECT
            (SELECT p.stake_amount FROM plantings p WHERE p.farmer_id = $1 AND p.status = 'success' ORDER BY p.planted_at DESC LIMIT 1) as last_stake_amount,
            (SELECT p.block_index FROM plantings p WHERE p.farmer_id = $1 AND p.status = 'success' ORDER BY p.planted_at DESC LIMIT 1) as last_stake_block,
            (SELECT h.reward_amount FROM harvests h WHERE h.farmer_id = $1 AND h.status = 'success' ORDER BY h.harvested_at DESC LIMIT 1) as last_reward_amount,
            (SELECT h.block_index FROM harvests h WHERE h.farmer_id = $1 AND h.status = 'success' ORDER BY h.harvested_at DESC LIMIT 1) as last_reward_block
        )
        SELECT 
          -- Farmer info
          fi.current_balance,
          
          -- Contract info
          ac.id as contract_id, ac.pooler_id, ac.pooler_name, ac.stake_percentage,
          ac.harvest_interval, ac.reward_split, ac.status as contract_status, ac.joined_at,
          
          -- Lifetime stats
          ls.total_staked, ls.total_rewards, ls.blocks_participated, ls.success_rate,
          
          -- Window stats
          ws.window_staked, ws.window_rewards, ws.window_blocks,
          
          -- Recent activity
          ra.last_stake_amount, ra.last_stake_block, ra.last_reward_amount, ra.last_reward_block
          
        FROM farmer_info fi
        CROSS JOIN lifetime_stats ls
        CROSS JOIN window_stats ws
        CROSS JOIN recent_activity ra
        LEFT JOIN active_contract ac ON true
      `;
      
      const result = await db.query(query, [farmerId]);
      
      if (result.rows.length === 0) {
        throw new Error('Farmer not found');
      }
      
      const row = result.rows[0];
      
      // Calculate average reward per block for window
      const windowBlocks = row.window_blocks || 0;
      const windowRewards = row.window_rewards || 0;
      const averageRewardPerBlock = windowBlocks > 0 ? 
        (parseFloat(windowRewards.toString()) / windowBlocks).toFixed(0) : '0';
      
      const summary: FarmerSummary = {
        farmerId,
        contract: row.contract_id ? {
          id: row.contract_id,
          poolerId: row.pooler_id,
          poolerName: row.pooler_name,
          stakePercentage: parseFloat(row.stake_percentage) || 0,
          harvestInterval: row.harvest_interval || 0,
          rewardSplit: parseFloat(row.reward_split) || 0,
          status: row.contract_status,
          joinedAt: row.joined_at
        } : null,
        current: {
          balance: row.current_balance?.toString() || '0',
          balanceHuman: this.formatKaleAmount(row.current_balance?.toString() || '0'),
          lastStakeAmount: row.last_stake_amount?.toString() || '0',
          lastStakeAmountHuman: this.formatKaleAmount(row.last_stake_amount?.toString() || '0'),
          lastStakeBlock: row.last_stake_block,
          lastRewardAmount: row.last_reward_amount?.toString() || '0',
          lastRewardAmountHuman: this.formatKaleAmount(row.last_reward_amount?.toString() || '0'),
          lastRewardBlock: row.last_reward_block
        },
        lifetime: {
          totalStaked: row.total_staked?.toString() || '0',
          totalStakedHuman: this.formatKaleAmount(row.total_staked?.toString() || '0'),
          totalRewards: row.total_rewards?.toString() || '0',
          totalRewardsHuman: this.formatKaleAmount(row.total_rewards?.toString() || '0'),
          blocksParticipated: row.blocks_participated || 0,
          successRate: parseFloat(row.success_rate) || 0
        },
        window: {
          range: window,
          staked: row.window_staked?.toString() || '0',
          stakedHuman: this.formatKaleAmount(row.window_staked?.toString() || '0'),
          rewards: row.window_rewards?.toString() || '0',
          rewardsHuman: this.formatKaleAmount(row.window_rewards?.toString() || '0'),
          blocks: row.window_blocks || 0,
          averageRewardPerBlock: averageRewardPerBlock
        }
      };
      
      logger.info(`Farmer summary retrieved: ${JSON.stringify({
        farmer_id: farmerId,
        user_id: user.id,
        window,
        has_active_contract: !!summary.contract,
        lifetime_blocks: summary.lifetime.blocksParticipated,
        success_rate: summary.lifetime.successRate
      })}`);
      
      return summary;
      
    } catch (error) {
      logger.error('Farmer summary query failed', error as Error, {
        farmer_id: params.farmerId,
        user_id: params.user.id
      });
      throw error;
    }
  }
  
  private formatKaleAmount(atomicAmount: string): string {
    try {
      const amount = parseFloat(atomicAmount);
      return (amount / 10_000_000).toFixed(7); // Convert from atomic units to KALE
    } catch {
      return '0.0000000';
    }
  }
  
  private isBlockIndex(value: string): boolean {
    return !isNaN(Number(value)) && Number.isInteger(Number(value));
  }
}

export const farmerService = new FarmerService();