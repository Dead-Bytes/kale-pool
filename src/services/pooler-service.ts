import { db } from './database';
import { backendLogger as logger } from '@shared/utils/logger';
import { AuthUser, UserRole } from '../types/auth-types';

export interface PoolerDiscoveryParams {
  page: number;
  limit: number;
  status: 'active' | 'inactive' | 'all';
  sortBy: 'name' | 'farmersCount' | 'totalStaked' | 'averageReward';
  sortOrder: 'asc' | 'desc';
}

export interface PoolerSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  rewardPercentage: number;
  maxFarmers: number;
  currentFarmers: number;
  totalStaked: string;
  totalStakedHuman: string;
  averageReward: string;
  averageRewardHuman: string;
  successRate: number;
  createdAt: string;
  lastSeen: string;
}

export interface PoolerDetails extends PoolerSummary {
  terms: {
    minimumStake: string;
    harvestPolicy: string;
    exitDelay: number;
  };
  performance: {
    successRate: number;
    averageBlockTime: number;
    totalBlocksMined: number;
    uptime: number;
  };
  statistics: {
    totalStaked: string;
    totalRewards: string;
    averageRewardPerBlock: string;
    farmersJoined: number;
    farmersActive: number;
  };
}

export interface PoolerDashboard {
  poolerId: string;
  overview: {
    name: string;
    status: string;
    currentFarmers: number;
    maxFarmers: number;
    utilizationRate: number;
    rewardPercentage: number;
  };
  performance: {
    successRate: number;
    averageBlockTime: number;
    blocksCompleted24h: number;
    uptime: number;
  };
  financial: {
    totalStaked: string;
    totalStakedHuman: string;
    totalRewards24h: string;
    totalRewards24hHuman: string;
    poolerShare24h: string;
    poolerShare24hHuman: string;
  };
  farmers: {
    activeCount: number;
    newJoins24h: number;
    exits24h: number;
    averageStake: string;
    averageStakeHuman: string;
  };
}

export class PoolerService {
  
  async getPoolerDiscovery(params: PoolerDiscoveryParams): Promise<{
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
    items: PoolerSummary[];
  }> {
    try {
      const { page, limit, status, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = '';
      const queryParams: any[] = [];
      
      if (status !== 'all') {
        whereClause = 'WHERE p.is_active = $1';
        queryParams.push(status === 'active');
      }
      
      // Build ORDER BY clause
      let orderByClause = '';
      switch (sortBy) {
        case 'name':
          orderByClause = `ORDER BY p.name ${sortOrder.toUpperCase()}`;
          break;
        case 'farmersCount':
          orderByClause = `ORDER BY p.current_farmers ${sortOrder.toUpperCase()}`;
          break;
        case 'totalStaked':
          orderByClause = `ORDER BY COALESCE(stats.total_staked, 0) ${sortOrder.toUpperCase()}`;
          break;
        case 'averageReward':
          orderByClause = `ORDER BY COALESCE(stats.avg_reward, 0) ${sortOrder.toUpperCase()}`;
          break;
        default:
          orderByClause = `ORDER BY p.created_at ${sortOrder.toUpperCase()}`;
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM poolers p
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get poolers with aggregated statistics
      const mainQuery = `
        SELECT 
          p.id,
          p.name,
          COALESCE(p.api_endpoint, 'High-performance mining pool') as description,
          CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as status,
          p.reward_percentage,
          p.max_farmers,
          p.current_farmers,
          COALESCE(plant_stats.total_staked, 0) as total_staked,
          COALESCE(harvest_stats.total_rewards, 0) as total_rewards,
          COALESCE(work_stats.success_rate, 0) as success_rate,
          p.created_at,
          p.last_seen
        FROM poolers p
        LEFT JOIN (
          SELECT 
            pooler_id,
            SUM(COALESCE(stake_amount::numeric, 0)) as total_staked
          FROM plantings
          WHERE status = 'success'
          GROUP BY pooler_id
        ) plant_stats ON p.id = plant_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            SUM(COALESCE(reward_amount::numeric, 0)) as total_rewards
          FROM harvests
          WHERE status = 'success'
          GROUP BY pooler_id
        ) harvest_stats ON p.id = harvest_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            CASE 
              WHEN COUNT(*) > 0 
              THEN ROUND(COUNT(*) FILTER (WHERE status IN ('success', 'recovered'))::decimal / COUNT(*), 4)
              ELSE 0
            END as success_rate
          FROM works
          WHERE worked_at >= NOW() - INTERVAL '30 days'
          GROUP BY pooler_id
        ) work_stats ON p.id = work_stats.pooler_id
        ${whereClause}
        ${orderByClause}
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      
      queryParams.push(limit, offset);
      const result = await db.query(mainQuery, queryParams);
      
      const items: PoolerSummary[] = result.rows.map(row => {
        const totalStaked = row.total_staked || '0';
        const totalRewards = row.total_rewards || '0';
        const averageReward = row.current_farmers > 0 ? 
          (parseFloat(totalRewards) / row.current_farmers).toFixed(7) : '0';
        
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          rewardPercentage: parseFloat(row.reward_percentage),
          maxFarmers: row.max_farmers,
          currentFarmers: row.current_farmers,
          totalStaked: totalStaked,
          totalStakedHuman: this.formatKaleAmount(totalStaked),
          averageReward: averageReward + '0000000', // Convert to atomic units
          averageRewardHuman: this.formatKaleAmount(averageReward + '0000000'),
          successRate: parseFloat(row.success_rate),
          createdAt: row.created_at,
          lastSeen: row.last_seen
        };
      });
      
      logger.info(`Pooler discovery query completed: ${JSON.stringify({
        page,
        limit,
        total,
        items_returned: items.length,
        status_filter: status,
        sort_by: sortBy
      })}`);
      
      return {
        page,
        limit,
        total,
        hasNext: offset + limit < total,
        hasPrev: page > 1,
        items
      };
      
    } catch (error) {
      logger.error('Pooler discovery query failed', error as Error);
      throw error;
    }
  }
  
  async getPoolerDetails(poolerId: string): Promise<PoolerDetails | null> {
    try {
      // Get basic pooler information with statistics
      const query = `
        SELECT 
          p.id,
          p.name,
          COALESCE(p.api_endpoint, 'High-performance mining pool') as description,
          CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as status,
          p.reward_percentage,
          p.max_farmers,
          p.current_farmers,
          p.created_at,
          p.last_seen,
          
          -- Performance statistics
          COALESCE(work_stats.total_blocks, 0) as total_blocks_mined,
          COALESCE(work_stats.success_rate, 0) as success_rate,
          COALESCE(work_stats.avg_block_time, 300) as average_block_time,
          
          -- Financial statistics
          COALESCE(plant_stats.total_staked, 0) as total_staked,
          COALESCE(harvest_stats.total_rewards, 0) as total_rewards,
          COALESCE(harvest_stats.avg_reward_per_block, 0) as avg_reward_per_block,
          
          -- Farmer statistics
          COALESCE(farmer_stats.farmers_joined, 0) as farmers_joined,
          COALESCE(farmer_stats.farmers_active, 0) as farmers_active
          
        FROM poolers p
        LEFT JOIN (
          SELECT 
            pooler_id,
            COUNT(DISTINCT block_index) as total_blocks,
            ROUND(COUNT(*) FILTER (WHERE status IN ('success', 'recovered'))::decimal / NULLIF(COUNT(*), 0), 4) as success_rate,
            AVG(EXTRACT(EPOCH FROM (worked_at - (SELECT MIN(planted_at) FROM plantings WHERE plantings.block_index = works.block_index AND plantings.pooler_id = works.pooler_id)))) as avg_block_time
          FROM works
          WHERE worked_at >= NOW() - INTERVAL '30 days'
          GROUP BY pooler_id
        ) work_stats ON p.id = work_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            SUM(COALESCE(stake_amount::numeric, 0)) as total_staked
          FROM plantings
          WHERE status = 'success'
          GROUP BY pooler_id
        ) plant_stats ON p.id = plant_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            SUM(COALESCE(reward_amount::numeric, 0)) as total_rewards,
            AVG(COALESCE(reward_amount::numeric, 0)) as avg_reward_per_block
          FROM harvests
          WHERE status = 'success'
          GROUP BY pooler_id
        ) harvest_stats ON p.id = harvest_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            COUNT(*) as farmers_joined,
            COUNT(*) FILTER (WHERE status = 'active') as farmers_active
          FROM farmers
          GROUP BY pooler_id
        ) farmer_stats ON p.id = farmer_stats.pooler_id
        
        WHERE p.id = $1
      `;
      
      const result = await db.query(query, [poolerId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      const totalStaked = row.total_staked?.toString() || '0';
      const totalRewards = row.total_rewards?.toString() || '0';
      const averageReward = row.avg_reward_per_block?.toString() || '0';
      
      const details: PoolerDetails = {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        rewardPercentage: parseFloat(row.reward_percentage),
        maxFarmers: row.max_farmers,
        currentFarmers: row.current_farmers,
        totalStaked: totalStaked,
        totalStakedHuman: this.formatKaleAmount(totalStaked),
        averageReward: averageReward,
        averageRewardHuman: this.formatKaleAmount(averageReward),
        successRate: parseFloat(row.success_rate),
        createdAt: row.created_at,
        lastSeen: row.last_seen,
        
        terms: {
          minimumStake: '100000000', // 10 KALE minimum
          harvestPolicy: 'flexible',
          exitDelay: 24 // hours
        },
        
        performance: {
          successRate: parseFloat(row.success_rate),
          averageBlockTime: parseFloat(row.average_block_time) || 300,
          totalBlocksMined: row.total_blocks_mined || 0,
          uptime: 0.995 // 99.5% uptime (would be calculated from monitoring data)
        },
        
        statistics: {
          totalStaked: totalStaked,
          totalRewards: totalRewards,
          averageRewardPerBlock: averageReward,
          farmersJoined: row.farmers_joined || 0,
          farmersActive: row.farmers_active || 0
        }
      };
      
      logger.info(`Pooler details retrieved: ${JSON.stringify({
        pooler_id: poolerId,
        name: details.name,
        current_farmers: details.currentFarmers,
        success_rate: details.successRate
      })}`);
      
      return details;
      
    } catch (error) {
      logger.error('Get pooler details failed', error as Error, { pooler_id: poolerId });
      throw error;
    }
  }
  
  async getPoolerDashboard(poolerId: string): Promise<PoolerDashboard | null> {
    try {
      // Get comprehensive dashboard data
      const query = `
        SELECT 
          p.id,
          p.name,
          CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as status,
          p.current_farmers,
          p.max_farmers,
          p.reward_percentage,
          
          -- 24h performance stats
          COALESCE(today_stats.blocks_completed, 0) as blocks_completed_24h,
          COALESCE(today_stats.success_rate, 0) as success_rate_24h,
          COALESCE(today_stats.total_staked, 0) as total_staked_24h,
          COALESCE(today_stats.total_rewards, 0) as total_rewards_24h,
          COALESCE(today_stats.pooler_share, 0) as pooler_share_24h,
          
          -- Overall stats
          COALESCE(overall_stats.total_staked, 0) as total_staked_overall,
          COALESCE(overall_stats.avg_stake, 0) as avg_stake_per_farmer,
          
          -- Farmer activity
          COALESCE(farmer_activity.new_joins, 0) as new_joins_24h,
          COALESCE(farmer_activity.exits, 0) as exits_24h
          
        FROM poolers p
        LEFT JOIN (
          SELECT 
            w.pooler_id,
            COUNT(DISTINCT w.block_index) as blocks_completed,
            ROUND(COUNT(*) FILTER (WHERE w.status IN ('success', 'recovered'))::decimal / NULLIF(COUNT(*), 0), 4) as success_rate,
            SUM(COALESCE(pl.stake_amount::numeric, 0)) as total_staked,
            SUM(COALESCE(h.reward_amount::numeric, 0)) as total_rewards,
            SUM(COALESCE(h.reward_amount::numeric, 0)) * 0.05 as pooler_share
          FROM works w
          LEFT JOIN plantings pl ON w.block_index = pl.block_index AND w.farmer_id = pl.farmer_id
          LEFT JOIN harvests h ON w.block_index = h.block_index AND w.farmer_id = h.farmer_id AND h.status = 'success'
          WHERE w.worked_at >= NOW() - INTERVAL '24 hours'
          GROUP BY w.pooler_id
        ) today_stats ON p.id = today_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            SUM(COALESCE(stake_amount::numeric, 0)) as total_staked,
            AVG(COALESCE(stake_amount::numeric, 0)) as avg_stake
          FROM plantings
          WHERE status = 'success'
          GROUP BY pooler_id
        ) overall_stats ON p.id = overall_stats.pooler_id
        LEFT JOIN (
          SELECT 
            pooler_id,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_joins,
            COUNT(*) FILTER (WHERE status = 'inactive' AND (joined_pool_at IS NULL OR joined_pool_at >= NOW() - INTERVAL '24 hours')) as exits
          FROM farmers
          GROUP BY pooler_id
        ) farmer_activity ON p.id = farmer_activity.pooler_id
        
        WHERE p.id = $1
      `;
      
      const result = await db.query(query, [poolerId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const utilizationRate = row.max_farmers > 0 ? row.current_farmers / row.max_farmers : 0;
      
      const dashboard: PoolerDashboard = {
        poolerId: row.id,
        overview: {
          name: row.name,
          status: row.status,
          currentFarmers: row.current_farmers,
          maxFarmers: row.max_farmers,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          rewardPercentage: parseFloat(row.reward_percentage)
        },
        performance: {
          successRate: parseFloat(row.success_rate_24h),
          averageBlockTime: 285.5, // Would be calculated from actual data
          blocksCompleted24h: row.blocks_completed_24h,
          uptime: 0.995
        },
        financial: {
          totalStaked: row.total_staked_overall?.toString() || '0',
          totalStakedHuman: this.formatKaleAmount(row.total_staked_overall?.toString() || '0'),
          totalRewards24h: row.total_rewards_24h?.toString() || '0',
          totalRewards24hHuman: this.formatKaleAmount(row.total_rewards_24h?.toString() || '0'),
          poolerShare24h: row.pooler_share_24h?.toString() || '0',
          poolerShare24hHuman: this.formatKaleAmount(row.pooler_share_24h?.toString() || '0')
        },
        farmers: {
          activeCount: row.current_farmers,
          newJoins24h: row.new_joins_24h,
          exits24h: row.exits_24h,
          averageStake: row.avg_stake_per_farmer?.toString() || '0',
          averageStakeHuman: this.formatKaleAmount(row.avg_stake_per_farmer?.toString() || '0')
        }
      };
      
      logger.info(`Pooler dashboard retrieved: ${JSON.stringify({
        pooler_id: poolerId,
        active_farmers: dashboard.overview.currentFarmers,
        utilization: dashboard.overview.utilizationRate,
        blocks_24h: dashboard.performance.blocksCompleted24h
      })}`);
      
      return dashboard;
      
    } catch (error) {
      logger.error('Get pooler dashboard failed', error as Error, { pooler_id: poolerId });
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

  async getPoolerWorks(params: {
    poolerId: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
    status?: 'success' | 'failed' | 'all';
    user: AuthUser;
  }): Promise<{
    poolerId: string;
    page: number;
    limit: number;
    total: number;
    items: WorkRecord[];
  }> {
    try {
      const { poolerId, from, to, page, limit, status, user } = params;
      const offset = (page - 1) * limit;
      
      // Check permissions
      if (user.role === UserRole.POOLER && user.entityId !== poolerId) {
        throw new Error('Access denied to pooler works');
      }
      
      // Build WHERE clause
      const whereConditions: string[] = ['w.pooler_id = $1'];
      const queryParams: any[] = [poolerId];
      let paramIndex = 2;
      
      if (status && status !== 'all') {
        if (status === 'success') {
          whereConditions.push(`w.status IN ('success', 'recovered')`);
        } else {
          whereConditions.push(`w.status = 'failed'`);
        }
      }
      
      if (from) {
        if (this.isBlockIndex(from)) {
          whereConditions.push(`w.block_index >= $${paramIndex++}`);
          queryParams.push(parseInt(from));
        } else {
          whereConditions.push(`w.worked_at >= $${paramIndex++}`);
          queryParams.push(new Date(from));
        }
      }
      
      if (to) {
        if (this.isBlockIndex(to)) {
          whereConditions.push(`w.block_index <= $${paramIndex++}`);
          queryParams.push(parseInt(to));
        } else {
          whereConditions.push(`w.worked_at <= $${paramIndex++}`);
          queryParams.push(new Date(to));
        }
      }
      
      const whereClause = 'WHERE ' + whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM works w
        LEFT JOIN farmers f ON w.farmer_id = f.id
        LEFT JOIN users u ON f.user_id = u.id
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get works
      const mainQuery = `
        SELECT 
          w.id,
          w.block_index,
          w.farmer_id,
          COALESCE(u.email, 'Unknown') as farmer_email,
          w.nonce,
          w.hash,
          w.zeros,
          w.gap,
          w.transaction_hash,
          w.status,
          EXTRACT(EPOCH FROM (w.worked_at - (
            SELECT MIN(planted_at) FROM plantings p 
            WHERE p.block_index = w.block_index AND p.pooler_id = w.pooler_id
          ))) as work_time,
          w.worked_at
        FROM works w
        LEFT JOIN farmers f ON w.farmer_id = f.id
        LEFT JOIN users u ON f.user_id = u.id
        ${whereClause}
        ORDER BY w.worked_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(limit, offset);
      const result = await db.query(mainQuery, queryParams);
      
      const items: WorkRecord[] = result.rows.map(row => ({
        id: row.id,
        blockIndex: row.block_index,
        farmerId: row.farmer_id,
        farmerEmail: row.farmer_email,
        nonce: row.nonce || '',
        hash: row.hash || '',
        zeros: row.zeros || 0,
        gap: row.gap || 0,
        transactionHash: row.transaction_hash || '',
        status: row.status,
        workTime: parseFloat(row.work_time) || 0,
        workedAt: row.worked_at
      }));
      
      logger.info(`Pooler works query completed: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: user.id,
        page,
        limit,
        total,
        items_returned: items.length
      })}`);
      
      return {
        poolerId,
        page,
        limit,
        total,
        items
      };
      
    } catch (error) {
      logger.error('Pooler works query failed', error as Error, {
        pooler_id: params.poolerId,
        user_id: params.user.id
      });
      throw error;
    }
  }
  
  async getPoolerRewards(params: {
    poolerId: string;
    from?: string;
    to?: string;
    window: '24h' | '7d' | '30d' | 'all';
    user: AuthUser;
  }): Promise<PoolerRewards> {
    try {
      const { poolerId, from, to, window, user } = params;
      
      // Check permissions
      if (user.role === UserRole.POOLER && user.entityId !== poolerId) {
        throw new Error('Access denied to pooler rewards');
      }
      
      // Build time window clause
      let windowClause = '';
      switch (window) {
        case '24h':
          windowClause = "AND h.harvested_at >= NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          windowClause = "AND h.harvested_at >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          windowClause = "AND h.harvested_at >= NOW() - INTERVAL '30 days'";
          break;
        case 'all':
        default:
          windowClause = '';
          break;
      }
      
      // Add date range filters if provided
      if (from) {
        if (this.isBlockIndex(from)) {
          windowClause += ` AND h.block_index >= ${parseInt(from)}`;
        } else {
          windowClause += ` AND h.harvested_at >= '${new Date(from).toISOString()}'`;
        }
      }
      
      if (to) {
        if (this.isBlockIndex(to)) {
          windowClause += ` AND h.block_index <= ${parseInt(to)}`;
        } else {
          windowClause += ` AND h.harvested_at <= '${new Date(to).toISOString()}'`;
        }
      }
      
      const query = `
        WITH reward_summary AS (
          SELECT
            SUM(COALESCE(h.reward_amount::numeric, 0)) as total_rewards,
            COUNT(DISTINCT h.block_index) as blocks_completed,
            COUNT(DISTINCT h.farmer_id) as unique_farmers,
            AVG(COALESCE(h.reward_amount::numeric, 0)) as average_reward_per_block
          FROM harvests h
          WHERE h.pooler_id = $1 
            AND h.status = 'success'
            ${windowClause}
        ),
        farmer_distribution AS (
          SELECT 
            h.farmer_id,
            COALESCE(u.email, 'Unknown') as farmer_email,
            SUM(COALESCE(h.reward_amount::numeric, 0)) as total_rewards,
            COUNT(h.id) as blocks_participated,
            AVG(COALESCE(h.reward_amount::numeric, 0)) as average_reward
          FROM harvests h
          LEFT JOIN farmers f ON h.farmer_id = f.id
          LEFT JOIN users u ON f.user_id = u.id
          WHERE h.pooler_id = $1 
            AND h.status = 'success'
            ${windowClause}
          GROUP BY h.farmer_id, u.email
          ORDER BY total_rewards DESC
        )
        SELECT 
          rs.total_rewards,
          rs.blocks_completed,
          rs.unique_farmers,
          rs.average_reward_per_block,
          
          -- Calculate pooler and platform shares
          rs.total_rewards * 0.05 as pooler_share,
          rs.total_rewards * 0.95 as farmers_share,
          rs.total_rewards * 0.05 * 0.1 as platform_fees,
          
          -- Farmer distribution as JSON
          COALESCE(
            json_agg(
              json_build_object(
                'farmerId', fd.farmer_id,
                'farmerEmail', fd.farmer_email,
                'totalRewards', fd.total_rewards,
                'totalRewardsHuman', ROUND(fd.total_rewards / 10000000.0, 7),
                'blocksParticipated', fd.blocks_participated,
                'averageReward', fd.average_reward
              ) ORDER BY fd.total_rewards DESC
            ) FILTER (WHERE fd.farmer_id IS NOT NULL),
            '[]'::json
          ) as distribution
          
        FROM reward_summary rs
        CROSS JOIN farmer_distribution fd
        GROUP BY rs.total_rewards, rs.blocks_completed, rs.unique_farmers, rs.average_reward_per_block
      `;
      
      const result = await db.query(query, [poolerId]);
      
      if (result.rows.length === 0) {
        return {
          poolerId,
          window: {
            range: window,
            totalRewards: '0',
            totalRewardsHuman: '0.0000000',
            poolerShare: '0',
            poolerShareHuman: '0.0000000',
            farmersShare: '0',
            farmersShareHuman: '0.0000000',
            platformFees: '0',
            platformFeesHuman: '0.0000000',
            blocksCompleted: 0,
            averageRewardPerBlock: '0'
          },
          distribution: []
        };
      }
      
      const row = result.rows[0];
      
      const rewards: PoolerRewards = {
        poolerId,
        window: {
          range: window,
          totalRewards: row.total_rewards?.toString() || '0',
          totalRewardsHuman: this.formatKaleAmount(row.total_rewards?.toString() || '0'),
          poolerShare: row.pooler_share?.toString() || '0',
          poolerShareHuman: this.formatKaleAmount(row.pooler_share?.toString() || '0'),
          farmersShare: row.farmers_share?.toString() || '0',
          farmersShareHuman: this.formatKaleAmount(row.farmers_share?.toString() || '0'),
          platformFees: row.platform_fees?.toString() || '0',
          platformFeesHuman: this.formatKaleAmount(row.platform_fees?.toString() || '0'),
          blocksCompleted: row.blocks_completed || 0,
          averageRewardPerBlock: row.average_reward_per_block?.toString() || '0'
        },
        distribution: Array.isArray(row.distribution) ? row.distribution : []
      };
      
      logger.info(`Pooler rewards retrieved: ${JSON.stringify({
        pooler_id: poolerId,
        user_id: user.id,
        window,
        total_rewards: rewards.window.totalRewards,
        blocks_completed: rewards.window.blocksCompleted,
        farmers_count: rewards.distribution.length
      })}`);
      
      return rewards;
      
    } catch (error) {
      logger.error('Pooler rewards query failed', error as Error, {
        pooler_id: params.poolerId,
        user_id: params.user.id
      });
      throw error;
    }
  }
  
  private isBlockIndex(value: string): boolean {
    return !isNaN(Number(value)) && Number.isInteger(Number(value));
  }
}

// Additional interfaces for pooler analytics
export interface WorkRecord {
  id: string;
  blockIndex: number;
  farmerId: string;
  farmerEmail: string;
  nonce: string;
  hash: string;
  zeros: number;
  gap: number;
  transactionHash: string;
  status: string;
  workTime: number;
  workedAt: string;
}

export interface PoolerRewards {
  poolerId: string;
  window: {
    range: string;
    totalRewards: string;
    totalRewardsHuman: string;
    poolerShare: string;
    poolerShareHuman: string;
    farmersShare: string;
    farmersShareHuman: string;
    platformFees: string;
    platformFeesHuman: string;
    blocksCompleted: number;
    averageRewardPerBlock: string;
  };
  distribution: Array<{
    farmerId: string;
    farmerEmail: string;
    totalRewards: number;
    totalRewardsHuman: string;
    blocksParticipated: number;
    averageReward: number;
  }>;
}

export const poolerService = new PoolerService();