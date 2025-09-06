import { db } from './database';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { AuthUser, UserRole } from '../types/auth-types';
import { authService } from './auth-service';

export interface ContractDiscoveryParams {
  page: number;
  limit: number;
  status?: 'pending' | 'active' | 'exiting' | 'completed' | 'all';
  poolerId?: string;
  farmerId?: string;
  from?: string;
  to?: string;
  user: AuthUser;
}

export interface ContractSummary {
  id: string;
  farmerId: string;
  poolerId: string;
  farmerEmail: string;
  poolerName: string;
  stakePercentage: number;
  harvestInterval: number;
  rewardSplit: number;
  platformFee: number;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  exitRequestedAt: string | null;
}

export interface ActiveContract {
  id: string;
  poolerId: string;
  poolerName: string;
  stakePercentage: number;
  harvestInterval: number;
  rewardSplit: number;
  platformFee: number;
  status: string;
  joinedAt: string;
  terms: {
    minimumStake: string;
    exitDelay: number;
    penalties: string;
  };
}

export class ContractService {
  
  async getContractDiscovery(params: ContractDiscoveryParams): Promise<{
    page: number;
    limit: number;
    total: number;
    items: ContractSummary[];
  }> {
    try {
      const { page, limit, status, poolerId, farmerId, from, to, user } = params;
      const offset = (page - 1) * limit;
      
      // Build WHERE clause based on user role and filters
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // Role-based access control
      if (user.role === UserRole.FARMER) {
        // Farmers can only see their own contracts
        whereConditions.push(`pc.farmer_id = $${paramIndex++}`);
        queryParams.push(user.entityId);
      } else if (user.role === UserRole.POOLER) {
        // Poolers can only see contracts for their pool
        whereConditions.push(`pc.pooler_id = $${paramIndex++}`);
        queryParams.push(user.entityId);
      }
      // Admins can see all contracts (no additional filter)
      
      // Status filter
      if (status && status !== 'all') {
        whereConditions.push(`pc.status = $${paramIndex++}`);
        queryParams.push(status);
      }
      
      // Pooler filter (only if user has permission)
      if (poolerId && (user.role === UserRole.ADMIN || 
          (user.role === UserRole.POOLER && user.entityId === poolerId))) {
        whereConditions.push(`pc.pooler_id = $${paramIndex++}`);
        queryParams.push(poolerId);
      }
      
      // Farmer filter (only if user has permission)
      if (farmerId && (user.role === UserRole.ADMIN || 
          (user.role === UserRole.FARMER && user.entityId === farmerId) ||
          user.role === UserRole.POOLER)) {
        whereConditions.push(`pc.farmer_id = $${paramIndex++}`);
        queryParams.push(farmerId);
      }
      
      // Date range filter
      if (from) {
        if (this.isBlockIndex(from)) {
          // Handle block index - we'll need to join with plantings to filter by block
          whereConditions.push(`EXISTS (
            SELECT 1 FROM plantings p 
            WHERE p.farmer_id = pc.farmer_id 
              AND p.pooler_id = pc.pooler_id 
              AND p.block_index >= $${paramIndex++}
          )`);
          queryParams.push(parseInt(from));
        } else {
          // Handle datetime
          whereConditions.push(`pc.created_at >= $${paramIndex++}`);
          queryParams.push(new Date(from));
        }
      }
      
      if (to) {
        if (this.isBlockIndex(to)) {
          whereConditions.push(`EXISTS (
            SELECT 1 FROM plantings p 
            WHERE p.farmer_id = pc.farmer_id 
              AND p.pooler_id = pc.pooler_id 
              AND p.block_index <= $${paramIndex++}
          )`);
          queryParams.push(parseInt(to));
        } else {
          whereConditions.push(`pc.created_at <= $${paramIndex++}`);
          queryParams.push(new Date(to));
        }
      }
      
      const whereClause = whereConditions.length > 0 ? 
        'WHERE ' + whereConditions.join(' AND ') : '';
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM pool_contracts pc
        JOIN farmers f ON pc.farmer_id = f.id
        JOIN users u ON f.user_id = u.id
        JOIN poolers p ON pc.pooler_id = p.id
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get contracts
      const mainQuery = `
        SELECT 
          pc.id,
          pc.farmer_id,
          pc.pooler_id,
          u.email as farmer_email,
          p.name as pooler_name,
          pc.stake_percentage,
          pc.harvest_interval,
          pc.reward_split,
          pc.platform_fee,
          pc.status,
          pc.created_at,
          pc.confirmed_at,
          pc.exit_requested_at
        FROM pool_contracts pc
        JOIN farmers f ON pc.farmer_id = f.id
        JOIN users u ON f.user_id = u.id
        JOIN poolers p ON pc.pooler_id = p.id
        ${whereClause}
        ORDER BY pc.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(limit, offset);
      const result = await db.query(mainQuery, queryParams);
      
      const items: ContractSummary[] = result.rows.map(row => ({
        id: row.id,
        farmerId: row.farmer_id,
        poolerId: row.pooler_id,
        farmerEmail: row.farmer_email,
        poolerName: row.pooler_name,
        stakePercentage: parseFloat(row.stake_percentage),
        harvestInterval: row.harvest_interval,
        rewardSplit: parseFloat(row.reward_split),
        platformFee: parseFloat(row.platform_fee),
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
        exitRequestedAt: row.exit_requested_at
      }));
      
      logger.info(`Contract discovery query completed: ${JSON.stringify({
        user_id: user.id,
        user_role: user.role,
        page,
        limit,
        total,
        items_returned: items.length,
        filters: { status, poolerId, farmerId }
      })}`);
      
      return {
        page,
        limit,
        total,
        items
      };
      
    } catch (error) {
      logger.error('Contract discovery query failed', error as Error, {
        user_id: params.user.id,
        params: params
      });
      throw error;
    }
  }
  
  async getActiveContract(farmerId: string, user: AuthUser): Promise<{
    farmerId: string;
    activeContract: ActiveContract | null;
  }> {
    try {
      // Check permissions
      if (user.role === UserRole.FARMER && user.entityId !== farmerId) {
        throw new Error('Access denied to farmer contracts');
      }
      
      const query = `
        SELECT 
          pc.id,
          pc.pooler_id,
          p.name as pooler_name,
          pc.stake_percentage,
          pc.harvest_interval,
          pc.reward_split,
          pc.platform_fee,
          pc.status,
          pc.confirmed_at as joined_at
        FROM pool_contracts pc
        JOIN poolers p ON pc.pooler_id = p.id
        WHERE pc.farmer_id = $1 
          AND pc.status = 'active'
        ORDER BY pc.confirmed_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [farmerId]);
      
      let activeContract: ActiveContract | null = null;
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        activeContract = {
          id: row.id,
          poolerId: row.pooler_id,
          poolerName: row.pooler_name,
          stakePercentage: parseFloat(row.stake_percentage),
          harvestInterval: row.harvest_interval,
          rewardSplit: parseFloat(row.reward_split),
          platformFee: parseFloat(row.platform_fee),
          status: row.status,
          joinedAt: row.joined_at,
          terms: {
            minimumStake: '100000000', // 10 KALE
            exitDelay: 24, // 24 hours
            penalties: '5% for early exit'
          }
        };
      }
      
      logger.info(`Active contract query completed: ${JSON.stringify({
        farmer_id: farmerId,
        has_active_contract: !!activeContract,
        contract_id: activeContract?.id,
        user_id: user.id
      })}`);
      
      return {
        farmerId,
        activeContract
      };
      
    } catch (error) {
      logger.error('Get active contract failed', error as Error, {
        farmer_id: farmerId,
        user_id: user.id
      });
      throw error;
    }
  }
  
  async getContractById(contractId: string, user: AuthUser): Promise<ContractSummary | null> {
    try {
      const query = `
        SELECT 
          pc.id,
          pc.farmer_id,
          pc.pooler_id,
          u.email as farmer_email,
          p.name as pooler_name,
          pc.stake_percentage,
          pc.harvest_interval,
          pc.reward_split,
          pc.platform_fee,
          pc.status,
          pc.created_at,
          pc.confirmed_at,
          pc.exit_requested_at
        FROM pool_contracts pc
        JOIN farmers f ON pc.farmer_id = f.id
        JOIN users u ON f.user_id = u.id
        JOIN poolers p ON pc.pooler_id = p.id
        WHERE pc.id = $1
      `;
      
      const result = await db.query(query, [contractId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      // Check permissions - using proper farmer/pooler associations instead of deprecated entityId
      if (user.role === UserRole.FARMER) {
        // Get farmer association for this user
        const farmerAssociation = await authService.getFarmerIdByUserId(user.id);
        
        logger.debug(`Contract access check: ${JSON.stringify({
          user_id: user.id,
          user_role: user.role,
          farmer_association: farmerAssociation,
          contract_farmer_id: row.farmer_id,
          farmer_association_id: farmerAssociation ? farmerAssociation.id : 'null',
          access_granted: farmerAssociation && farmerAssociation.id === row.farmer_id
        })}`);
        
        // The getFarmerIdByUserId returns { id: farmerId }, so check the id field
        if (!farmerAssociation || farmerAssociation.id !== row.farmer_id) {
          logger.error(`Access denied: farmer association mismatch`, {
            user_id: user.id,
            farmer_association_id: farmerAssociation?.id,
            contract_farmer_id: row.farmer_id,
            contract_id: contractId
          });
          throw new Error('Access denied to this contract');
        }
      }
      if (user.role === UserRole.POOLER) {
        // For now, allow any pooler to access contracts (you may want to add proper pooler association check)
        // TODO: Implement proper pooler association check if needed
      }
      
      const contract: ContractSummary = {
        id: row.id,
        farmerId: row.farmer_id,
        poolerId: row.pooler_id,
        farmerEmail: row.farmer_email,
        poolerName: row.pooler_name,
        stakePercentage: parseFloat(row.stake_percentage),
        harvestInterval: row.harvest_interval,
        rewardSplit: parseFloat(row.reward_split),
        platformFee: parseFloat(row.platform_fee),
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
        exitRequestedAt: row.exit_requested_at
      };
      
      logger.info(`Contract retrieved: ${JSON.stringify({
        contract_id: contractId,
        farmer_id: contract.farmerId,
        pooler_id: contract.poolerId,
        status: contract.status,
        user_id: user.id
      })}`);
      
      return contract;
      
    } catch (error) {
      logger.error('Get contract by ID failed', error as Error, {
        contract_id: contractId,
        user_id: user.id
      });
      throw error;
    }
  }
  
  async getContractsByPooler(poolerId: string, user: AuthUser): Promise<ContractSummary[]> {
    try {
      // Check permissions
      if (user.role === UserRole.POOLER && user.entityId !== poolerId) {
        throw new Error('Access denied to pooler contracts');
      }
      
      const query = `
        SELECT 
          pc.id,
          pc.farmer_id,
          pc.pooler_id,
          u.email as farmer_email,
          p.name as pooler_name,
          pc.stake_percentage,
          pc.harvest_interval,
          pc.reward_split,
          pc.platform_fee,
          pc.status,
          pc.created_at,
          pc.confirmed_at,
          pc.exit_requested_at
        FROM pool_contracts pc
        JOIN farmers f ON pc.farmer_id = f.id
        JOIN users u ON f.user_id = u.id
        JOIN poolers p ON pc.pooler_id = p.id
        WHERE pc.pooler_id = $1
        ORDER BY pc.created_at DESC
      `;
      
      const result = await db.query(query, [poolerId]);
      
      const contracts: ContractSummary[] = result.rows.map(row => ({
        id: row.id,
        farmerId: row.farmer_id,
        poolerId: row.pooler_id,
        farmerEmail: row.farmer_email,
        poolerName: row.pooler_name,
        stakePercentage: parseFloat(row.stake_percentage),
        harvestInterval: row.harvest_interval,
        rewardSplit: parseFloat(row.reward_split),
        platformFee: parseFloat(row.platform_fee),
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
        exitRequestedAt: row.exit_requested_at
      }));
      
      logger.info(`Pooler contracts retrieved: ${JSON.stringify({
        pooler_id: poolerId,
        contract_count: contracts.length,
        user_id: user.id
      })}`);
      
      return contracts;
      
    } catch (error) {
      logger.error('Get contracts by pooler failed', error as Error, {
        pooler_id: poolerId,
        user_id: user.id
      });
      throw error;
    }
  }
  
  async requestContractExit(contractId: string, user: AuthUser) {
    try {
      logger.info(`Requesting contract exit: ${JSON.stringify({
        contract_id: contractId,
        user_id: user.id,
        user_role: user.role
      })}`);
      
      // Get the contract first to verify it exists and user can access it
      const contract = await this.getContractById(contractId, user);
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Check if contract is in active status
      if (contract.status !== 'active') {
        throw new Error('Contract is not active and cannot be exited');
      }
      
      // Calculate final rewards before exit
      const finalRewards = await this.calculateFinalRewards(contract.farmerId);
      
      // Update contract status to 'exiting' and set exit_requested_at
      const updateResult = await db.query(
        `UPDATE pool_contracts 
         SET status = 'exiting', exit_requested_at = NOW()
         WHERE id = $1 
         RETURNING status, exit_requested_at`,
        [contractId]
      );
      
      if (updateResult.rows.length === 0) {
        throw new Error('Failed to update contract status');
      }
      
      // Get exit delay from contract terms (default 24 hours)
      const exitDelay = contract.exitDelay || 24;
      
      logger.info(`Contract exit requested successfully: ${JSON.stringify({
        contract_id: contractId,
        farmer_id: contract.farmerId,
        final_rewards: finalRewards.totalRewards,
        exit_delay_hours: exitDelay
      })}`);
      
      return {
        contract: {
          ...contract,
          status: 'exiting',
          exitRequestedAt: updateResult.rows[0].exit_requested_at
        },
        finalRewards,
        exitDelay
      };
      
    } catch (error) {
      logger.error('Request contract exit failed', error as Error, {
        contract_id: contractId,
        user_id: user.id
      });
      throw error;
    }
  }
  
  private async calculateFinalRewards(farmerId: string) {
    try {
      logger.info(`Calculating final rewards for farmer: ${farmerId}`);
      
      const result = await db.query(
        `WITH farmer_rewards AS (
          SELECT 
            COALESCE(SUM(CASE WHEN h.status = 'success' THEN h.reward_amount::numeric ELSE 0 END), 0) as total_rewards,
            COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.stake_amount::numeric ELSE 0 END), 0) as total_staked,
            COUNT(DISTINCT CASE WHEN h.status = 'success' THEN h.block_index END) as successful_harvests,
            COUNT(DISTINCT CASE WHEN p.status = 'success' THEN p.block_index END) as successful_plantings
          FROM farmers f
          LEFT JOIN plantings p ON f.id = p.farmer_id
          LEFT JOIN harvests h ON f.id = h.farmer_id AND p.block_index = h.block_index
          WHERE f.id = $1
        ),
        pending_rewards AS (
          SELECT 
            COALESCE(SUM(p.stake_amount::numeric), 0) as pending_stake_amount
          FROM plantings p
          LEFT JOIN harvests h ON p.farmer_id = h.farmer_id AND p.block_index = h.block_index
          WHERE p.farmer_id = $1 AND p.status = 'success' AND h.id IS NULL
        )
        SELECT 
          fr.total_rewards,
          fr.total_staked,
          fr.successful_harvests,
          fr.successful_plantings,
          pr.pending_stake_amount,
          (fr.total_rewards + pr.pending_stake_amount * 0.1) as estimated_final_rewards
        FROM farmer_rewards fr, pending_rewards pr`,
        [farmerId]
      );
      
      const rewards = result.rows[0] || {
        total_rewards: '0',
        total_staked: '0',
        successful_harvests: 0,
        successful_plantings: 0,
        pending_stake_amount: '0',
        estimated_final_rewards: '0'
      };
      
      return {
        totalRewards: parseFloat(rewards.total_rewards),
        totalStaked: parseFloat(rewards.total_staked),
        successfulHarvests: parseInt(rewards.successful_harvests),
        successfulPlantings: parseInt(rewards.successful_plantings),
        pendingStakeAmount: parseFloat(rewards.pending_stake_amount),
        estimatedFinalRewards: parseFloat(rewards.estimated_final_rewards)
      };
      
    } catch (error) {
      logger.error('Calculate final rewards failed', error as Error, {
        farmer_id: farmerId
      });
      throw error;
    }
  }
  
  private isBlockIndex(value: string): boolean {
    return !isNaN(Number(value)) && Number.isInteger(Number(value));
  }
}

export const contractService = new ContractService();