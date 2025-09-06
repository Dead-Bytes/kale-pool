// Backend routes for handling Pooler notifications
// Receives block discovery events and coordinates pool operations

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import chalk from 'chalk';
import { poolerQueries, blockOperationQueries } from '../services/database';

interface BlockDiscoveryNotification {
  event: 'new_block_discovered';
  poolerId: string;
  blockIndex: number;
  blockData: {
    index: number;
    timestamp: string;
    entropy: string;
    blockAge: number;
    plantable: boolean;
    min_stake: string;
    max_stake: string;
    min_zeros: number;
    max_zeros: number;
    min_gap: number;
    max_gap: number;
  };
  metadata: {
    discoveredAt: string;
    poolerUptime: number;
    totalBlocksDiscovered: number;
  };
}

interface BlockNotificationResponse {
  success: boolean;
  message: string;
  acknowledged: boolean;
  timestamp: string;
  actions?: string[];
}

class PoolerRouteHandler {
  
  /**
   * Handle new block discovery notification from Pooler
   */
  static async handleBlockDiscovered(
    request: FastifyRequest<{ Body: BlockDiscoveryNotification }>,
    reply: FastifyReply
  ): Promise<BlockNotificationResponse> {
    
    const notification = request.body;
    const timestamp = new Date().toISOString();
    
    // Log the block discovery prominently
    console.log('');
    console.log(chalk.magenta.bold('🔔 BLOCK DISCOVERY NOTIFICATION RECEIVED'));
    console.log(chalk.cyan(`   Pooler: ${notification.poolerId}`));
    console.log(chalk.cyan(`   Block: ${notification.blockData.index}`));
    console.log(chalk.cyan(`   Age: ${notification.blockData.blockAge}s`));
    console.log(chalk.cyan(`   Plantable: ${notification.blockData.plantable ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.cyan(`   Entropy: ${notification.blockData.entropy.substring(0, 16)}...`));
    console.log('');

    try {
      // Validate notification
      if (!notification.poolerId || !notification.blockIndex || !notification.blockData) {
        return reply.status(400).send({
          success: false,
          message: 'Invalid notification format',
          acknowledged: false,
          timestamp
        });
      }

      // Log detailed block information
      PoolerRouteHandler.logBlockDetails(notification);

      // **CRITICAL DATABASE PERSISTENCE** - Store block operation record
      await PoolerRouteHandler.storeBlockOperation(notification);

      // Determine actions to take
      const actions: string[] = [];
      
      if (notification.blockData.plantable) {
        actions.push('block_ready_for_planting');
        console.log(chalk.green('✅ Block is plantable - ready for pool coordination'));
        
        // **FUTURE IMPLEMENTATION**: Trigger actual plant coordination
        // For now, we store the block and mark it as ready for planting
        console.log(chalk.yellow('🌱 [READY] Block stored in database - ready for plant coordination'));
        console.log(chalk.yellow('   - Block operation record created'));
        console.log(chalk.yellow('   - Plant service can now coordinate farmers'));
        console.log(chalk.yellow('   - Waiting for plant request from Pooler'));
        
      } else {
        if (notification.blockData.blockAge < 30) {
          actions.push('block_too_fresh');
          console.log(chalk.yellow(`⏰ Block too fresh (${notification.blockData.blockAge}s) - waiting`));
        } else {
          actions.push('block_too_old');
          console.log(chalk.red(`⏰ Block too old (${notification.blockData.blockAge}s) - missed opportunity`));
        }
      }

      // Success response
      const response: BlockNotificationResponse = {
        success: true,
        message: `Block ${notification.blockData.index} stored and ready for coordination`,
        acknowledged: true,
        timestamp,
        actions
      };

      console.log(chalk.green.bold('✅ Block notification processed and stored in database'));
      console.log('');

      return reply.status(200).send(response);

    } catch (error) {
      console.error(chalk.red('❌ Error processing block notification:'), error);
      
      return reply.status(500).send({
        success: false,
        message: 'Internal error processing notification',
        acknowledged: false,
        timestamp
      });
    }
  }

  /**
   * Get pooler connection status
   */
  static async getPoolerStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // TODO: Implement actual pooler status tracking
    return reply.send({
      pooler_connections: [
        {
          pooler_id: 'kale-pool-pooler-mainnet',
          status: 'connected',
          last_notification: new Date().toISOString(),
          blocks_discovered: 0, // TODO: track from database
          uptime: 0 // TODO: track from first connection
        }
      ],
      total_poolers: 1,
      active_poolers: 1,
      last_block_notification: new Date().toISOString()
    });
  }

  /**
   * Store block operation in database for tracking and coordination
   */
  private static async storeBlockOperation(notification: BlockDiscoveryNotification): Promise<void> {
    try {
      console.log(chalk.blue('📊 Storing block operation in database...'));
      
      // Validate that the pooler exists in our database
      const pooler = await poolerQueries.getPoolerById(notification.poolerId);
      if (!pooler) {
        console.log(chalk.yellow(`⚠️ Pooler ${notification.poolerId} not found in database - using notification ID`));
      }

      // Create block_operations record - the "holy bible record" for this block
      const status = notification.blockData.plantable ? 'active' : 'failed';
      const blockOperationId = await blockOperationQueries.createBlockOperation(
        notification.blockData.index,
        notification.poolerId,
        status
      );

      console.log(chalk.blue('   📝 Block operation record created:'));
      console.log(`      Record ID: ${blockOperationId}`);
      console.log(`      Block Index: ${notification.blockData.index}`);
      console.log(`      Pooler ID: ${notification.poolerId}`);
      console.log(`      Status: ${status}`);
      console.log(`      Plantable: ${notification.blockData.plantable}`);
      
      // Log block metadata for debugging (not stored in DB yet)
      console.log(chalk.blue('   🔍 Block metadata received:'));
      console.log(`      Entropy: ${notification.blockData.entropy.substring(0, 16)}...`);
      console.log(`      Block Age: ${notification.blockData.blockAge}s`);
      console.log(`      Min Stake: ${Number(notification.blockData.min_stake) / 10**7} KALE`);
      console.log(`      Max Stake: ${Number(notification.blockData.max_stake) / 10**7} KALE`);
      console.log(`      Zeros Range: ${notification.blockData.min_zeros} - ${notification.blockData.max_zeros}`);
      console.log(`      Gap Range: ${notification.blockData.min_gap} - ${notification.blockData.max_gap}`);

      console.log(chalk.green('✅ Block operation successfully stored in database'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to store block operation:'), error);
      throw error;
    }
  }

  /**
   * Log detailed block information
   */
  private static logBlockDetails(notification: BlockDiscoveryNotification): void {
    console.log(chalk.blue.bold('📈 BLOCK DETAILS:'));
    console.log(`   Index: ${notification.blockData.index}`);
    console.log(`   Timestamp: ${notification.blockData.timestamp}`);
    console.log(`   Age: ${notification.blockData.blockAge} seconds`);
    console.log(`   Min Stake: ${Number(notification.blockData.min_stake) / 10**7} KALE`);
    console.log(`   Max Stake: ${Number(notification.blockData.max_stake) / 10**7} KALE`);
    console.log(`   Zeros Range: ${notification.blockData.min_zeros} - ${notification.blockData.max_zeros}`);
    console.log(`   Gap Range: ${notification.blockData.min_gap} - ${notification.blockData.max_gap}`);
    console.log('');
    
    console.log(chalk.blue.bold('📊 POOLER METADATA:'));
    console.log(`   Pooler ID: ${notification.poolerId}`);
    console.log(`   Discovery Time: ${notification.metadata.discoveredAt}`);
    console.log(`   Pooler Uptime: ${Math.floor(notification.metadata.poolerUptime / 1000)}s`);
    console.log(`   Total Blocks Discovered: ${notification.metadata.totalBlocksDiscovered}`);
    console.log('');
  }
}

/**
 * Register pooler routes with Fastify instance
 */
export async function registerPoolerRoutes(fastify: FastifyInstance): Promise<void> {
  // Block discovery notification endpoint
  fastify.post('/pooler/block-discovered', PoolerRouteHandler.handleBlockDiscovered);
  
  // Pooler status endpoint
  fastify.get('/pooler/status', PoolerRouteHandler.getPoolerStatus);
  
  fastify.log.info('Pooler routes registered');
}

export { PoolerRouteHandler };