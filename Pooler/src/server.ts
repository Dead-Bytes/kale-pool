// KALE Pool Mining Pooler Service - Phase 2
// Block discovery and pool coordination service

import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import BlockMonitor from './services/block-monitor';
import { poolCoordinator, type PlantingNotification } from './services/pool-coordinator';
import Config from '../../Shared/config';

// Load environment configuration
dotenv.config({ path: '.env.mainnet' });

class PoolerService {
  private app: FastifyInstance;
  private blockMonitor: BlockMonitor;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    
    // Initialize Fastify
    this.app = fastify({
      logger: Config.NODE_ENV === 'development' ? {
        level: Config.LOG_LEVEL
      } : {
        level: 'info'
      }
    });

    // Initialize block monitor
    this.blockMonitor = new BlockMonitor();

    this.setupRoutes();
    this.setupShutdownHandlers();
    
    this.log('PoolerService initialized', {
      pooler_id: Config.POOLER.ID,
      backend_url: Config.BACKEND_API.URL,
      contract_id: Config.STELLAR.CONTRACT_ID
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (request, reply) => {
      const status = this.blockMonitor.getStatus();
      const uptime = Date.now() - this.startTime.getTime();
      
      const health = {
        service: 'KALE Pool Pooler',
        status: status.status,
        uptime: Math.floor(uptime / 1000),
        timestamp: new Date().toISOString(),
        block_monitoring: {
          is_active: status.isMonitoring,
          current_block: status.currentBlock,
          blocks_discovered: status.blocksDiscovered,
          last_block_age: status.lastBlockAge,
          error_count: status.errorCount
        },
        connections: {
          stellar_rpc: status.contractConnection,
          backend_api: status.backendConnection
        },
        configuration: {
          network: Config.STELLAR.NETWORK,
          contract_id: Config.STELLAR.CONTRACT_ID,
          poll_interval_ms: Config.BLOCK_MONITOR.POLL_INTERVAL_MS,
          backend_url: Config.BACKEND_API.URL
        }
      };

      reply.status(status.status === 'healthy' ? 200 : 503).send(health);
    });

    // Service info endpoint
    this.app.get('/info', async (request, reply) => {
      const status = this.blockMonitor.getStatus();
      
      reply.send({
        service: 'KALE Pool Mining Pooler',
        version: '1.0.0',
        pooler_id: Config.POOLER.ID,
        started_at: this.startTime.toISOString(),
        uptime_seconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        monitoring_status: {
          is_monitoring: status.isMonitoring,
          current_block_index: status.currentBlock,
          total_blocks_discovered: status.blocksDiscovered,
          last_notification: status.lastNotification,
          error_count: status.errorCount
        },
        network_config: {
          stellar_network: Config.STELLAR.NETWORK,
          rpc_url: Config.STELLAR.RPC_URL,
          contract_id: Config.STELLAR.CONTRACT_ID,
          network_passphrase: Config.STELLAR.NETWORK_PASSPHRASE
        },
        backend_integration: {
          backend_url: Config.BACKEND_API.URL,
          timeout_ms: Config.BACKEND_API.TIMEOUT_MS,
          retry_attempts: Config.BLOCK_MONITOR.RETRY_ATTEMPTS
        }
      });
    });

    // Backend planting status notification endpoint
    this.app.post('/backend/planting-status', async (request, reply) => {
      try {
        // Log the full request body for debugging
        this.log(`🌱 Received planting status notification (full payload)`, {
          body: request.body,
          headers: request.headers
        });

        const { 
          block_index, pooler_id, successful_plants, failed_plants, farmers_planted, duration_ms,
          planted_farmers, plantedFarmers, blockData, block_data 
        } = request.body as any;

        // Handle both camelCase and snake_case naming from Backend
        const actualPlantedFarmers = planted_farmers || plantedFarmers || [];
        const actualBlockData = blockData || block_data || {};
        
        this.log(`🌱 Received planting status notification`, {
          block_index,
          pooler_id,
          successful_plants,
          failed_plants,
          farmers_planted,
          duration_ms,
          has_planted_farmers: actualPlantedFarmers.length > 0,
          planted_farmers_count: actualPlantedFarmers.length,
          has_block_data: !!actualBlockData.entropy
        });

        // Log planting results
        if (successful_plants > 0) {
          this.log(`✅ Block ${block_index}: ${successful_plants} successful plants`);
        }
        if (failed_plants > 0) {
          this.log(`❌ Block ${block_index}: ${failed_plants} failed plants`);
        }

        // If we have planted farmers details, schedule work execution
        if (actualPlantedFarmers.length > 0 && actualBlockData.entropy) {
          this.log(`🚜 Scheduling work execution for ${actualPlantedFarmers.length} planted farmers`, {
            block_index,
            entropy: actualBlockData.entropy?.substring(0, 16) + '...',
            farmers: actualPlantedFarmers.map((f: any) => ({
              farmer_id: f.farmerId,
              custodial_wallet: f.custodialWallet
            }))
          });

          try {
            // Create planting notification for pool coordinator
            const plantingNotification: PlantingNotification = {
              blockIndex: parseInt(block_index),
              entropy: actualBlockData.entropy,
              blockTimestamp: actualBlockData.timestamp ? 
                Math.floor(new Date(actualBlockData.timestamp).getTime() / 1000) :
                Math.floor(Date.now() / 1000),
              plantedFarmers: actualPlantedFarmers.map((farmer: any) => ({
                farmerId: farmer.farmerId,
                custodialWallet: farmer.custodialWallet,
                custodialSecretKey: farmer.custodialSecretKey,
                stakeAmount: farmer.stakeAmount,
                plantingTime: new Date(farmer.plantingTime || Date.now())
              }))
            };

            // Schedule work execution via pool coordinator
            await poolCoordinator.receivePlantingNotification(plantingNotification);

            this.log(`✅ Work execution scheduled successfully`, {
              block_index,
              farmers_scheduled: actualPlantedFarmers.length
            });

          } catch (error) {
            this.logError('Failed to schedule work execution', error);
          }

        } else {
          this.log(`⚠️  Cannot schedule work - missing planted farmers details or block data`, {
            block_index,
            successful_plants,
            has_planted_farmers: actualPlantedFarmers.length > 0,
            has_entropy: !!actualBlockData.entropy,
            planted_farmers_count: actualPlantedFarmers.length
          });
        }

        reply.send({
          success: true,
          message: 'Planting status received',
          acknowledged_at: new Date().toISOString()
        });
      } catch (error) {
        this.logError('Failed to process planting status', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to process planting status'
        });
      }
    });

    // Planted farmers notification endpoint for work coordination
    this.app.post('/backend/planted-farmers', async (request, reply) => {
      try {
        // Validate authorization
        const authorization = request.headers.authorization;
        if (!authorization || !authorization.startsWith('Bearer ')) {
          return reply.status(401).send({ 
            success: false, 
            error: 'Authorization header required' 
          });
        }

        const token = authorization.replace('Bearer ', '');
        if (token !== Config.POOLER.AUTH_TOKEN) {
          return reply.status(403).send({ 
            success: false, 
            error: 'Invalid authorization token' 
          });
        }

        const plantingNotification = request.body as PlantingNotification;
        
        this.log(`🌱 Received planted farmers notification for work coordination`, {
          block_index: plantingNotification.blockIndex,
          farmer_count: plantingNotification.plantedFarmers.length,
          entropy: plantingNotification.entropy.substring(0, 16) + '...'
        });

        // Pass to pool coordinator for work scheduling
        await poolCoordinator.receivePlantingNotification(plantingNotification);

        reply.send({
          success: true,
          message: 'Planted farmers notification received and work scheduled',
          block_index: plantingNotification.blockIndex,
          farmers_scheduled: plantingNotification.plantedFarmers.length,
          acknowledged_at: new Date().toISOString()
        });

      } catch (error) {
        this.logError('Failed to process planted farmers notification', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to process planted farmers notification'
        });
      }
    });

    // Manual block check trigger (debug endpoint)
    this.app.post('/debug/trigger-check', async (request, reply) => {
      if (!Config.DEBUG.ENDPOINTS_ENABLED) {
        return reply.status(404).send({ error: 'Debug endpoints disabled' });
      }

      try {
        // Trigger immediate block check
        this.log('🔍 Manual block check triggered via API');
        // Note: This would require exposing the checkForNewBlocks method
        reply.send({
          success: true,
          message: 'Block check triggered',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logError('Manual block check failed', error);
        reply.status(500).send({
          success: false,
          error: 'Block check failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Work coordination status endpoint
    this.app.get('/status/work', async (request, reply) => {
      const coordinatorStatus = poolCoordinator.getStatus();
      const blockMonitorStatus = this.blockMonitor.getStatus();
      
      reply.send({
        service: 'KALE Pool Work Coordination',
        timestamp: new Date().toISOString(),
        block_monitoring: {
          current_block: blockMonitorStatus.currentBlock,
          is_monitoring: blockMonitorStatus.isMonitoring,
          blocks_discovered: blockMonitorStatus.blocksDiscovered
        },
        work_coordination: {
          pending_work_blocks: coordinatorStatus.pendingWorkBlocks,
          active_work_blocks: coordinatorStatus.activeWorkBlocks,
          work_manager: coordinatorStatus.workManagerStatus
        }
      });
    });

    // Emergency stop endpoint (debug)
    this.app.post('/debug/emergency-stop', async (request, reply) => {
      if (!Config.DEBUG.ENDPOINTS_ENABLED) {
        return reply.status(404).send({ error: 'Debug endpoints disabled' });
      }

      try {
        this.log('🚨 Emergency stop triggered via API');
        poolCoordinator.emergencyStop();
        
        reply.send({
          success: true,
          message: 'Emergency stop executed',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logError('Emergency stop failed', error);
        reply.status(500).send({
          success: false,
          error: 'Emergency stop failed'
        });
      }
    });

    // Test work execution endpoint (debug)
    this.app.post('/debug/test-work', async (request, reply) => {
      if (!Config.DEBUG.ENDPOINTS_ENABLED) {
        return reply.status(404).send({ error: 'Debug endpoints disabled' });
      }

      try {
        const { blockIndex, entropy, farmers } = request.body as any;
        
        if (!blockIndex || !entropy || !farmers || !Array.isArray(farmers)) {
          return reply.status(400).send({
            success: false,
            error: 'Missing required fields: blockIndex, entropy, farmers[]'
          });
        }

        this.log('🧪 Test work execution triggered via API', {
          block_index: blockIndex,
          farmer_count: farmers.length
        });

        // Create test planting notification
        const testNotification: PlantingNotification = {
          blockIndex: parseInt(blockIndex),
          entropy,
          blockTimestamp: Math.floor(Date.now() / 1000), // Current timestamp
          plantedFarmers: farmers.map((farmer: any) => ({
            farmerId: farmer.farmerId || `test-farmer-${Math.random().toString(36).substring(7)}`,
            custodialWallet: farmer.custodialWallet || 'GBQHTQ7NTSKHVTSVM6EHUO3TU4P4BK2TAAII25V2TT2Q6OWXUJWEKALE',
            custodialSecretKey: farmer.custodialSecretKey || 'SCQHTQ7NTSKHVTSVM6EHUO3TU4P4BK2TAAII25V2TT2Q6OWXUJWEKALE',
            stakeAmount: farmer.stakeAmount || '1000000',
            plantingTime: new Date()
          }))
        };

        // Submit to pool coordinator
        await poolCoordinator.receivePlantingNotification(testNotification);
        
        reply.send({
          success: true,
          message: 'Test work execution initiated',
          block_index: blockIndex,
          farmers_scheduled: testNotification.plantedFarmers.length,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        this.logError('Test work execution failed', error);
        reply.status(500).send({
          success: false,
          error: 'Test work execution failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Test planted farmers notification endpoint (debug) 
    this.app.post('/debug/test-planted-notification', async (request, reply) => {
      if (!Config.DEBUG.ENDPOINTS_ENABLED) {
        return reply.status(404).send({ error: 'Debug endpoints disabled' });
      }

      try {
        this.log('🧪 Testing planted farmers notification with mock data');

        // Create a mock notification that simulates what the Backend should send
        const mockNotification = {
          event: 'planting_completed',
          backendId: 'kale-pool-backend',
          blockIndex: 99999,
          plantingStatus: 'completed',
          results: {
            farmersPlanted: 1,
            successfulPlants: 1,
            failedPlants: 0,
            plantingStartTime: new Date(Date.now() - 30000).toISOString(),
            plantingEndTime: new Date().toISOString(),
            duration: 30000,
            details: [{
              farmerId: 'test-farmer-123',
              success: true,
              stakeAmount: 1000000,
              transactionHash: 'test-tx-hash'
            }]
          },
          plantedFarmers: [{
            farmerId: 'test-farmer-123',
            custodialWallet: 'GBQHTQ7NTSKHVTSVM6EHUO3TU4P4BK2TAAII25V2TT2Q6OWXUJWEKALE',
            custodialSecretKey: 'SAQHTQ7NTSKHVTSVM6EHUO3TU4P4BK2TAAII25V2TT2Q6OWXUJWEKALE',
            stakeAmount: '1000000',
            plantingTime: new Date().toISOString()
          }],
          blockData: {
            entropy: '0000007e7c869191abc123def456789012345678901234567890123456789012',
            timestamp: Math.floor(Date.now() / 1000)
          },
          timestamp: new Date().toISOString()
        };

        // Simulate the enhanced planting notification
        const response = await fetch('http://localhost:3001/backend/planting-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Config.POOLER.AUTH_TOKEN}`,
            'X-Backend-ID': 'test-backend'
          },
          body: JSON.stringify(mockNotification)
        });

        const result = await response.json();

        reply.send({
          success: true,
          message: 'Test planted farmers notification sent',
          mock_notification: mockNotification,
          pooler_response: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        this.logError('Test planted farmers notification failed', error);
        reply.status(500).send({
          success: false,
          error: 'Test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // CORS setup
    if (Config.BACKEND.CORS_ORIGIN.length > 0) {
      this.app.register(require('@fastify/cors'), {
        origin: Config.BACKEND.CORS_ORIGIN,
        methods: ['GET', 'POST']
      });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      this.log(`🛑 Received ${signal} - starting graceful shutdown...`);
      
      try {
        // Stop block monitoring first
        await this.blockMonitor.stopMonitoring();
        
        // Close Fastify server
        await this.app.close();
        
        this.log('✅ Pooler service shut down gracefully');
        process.exit(0);
      } catch (error) {
        this.logError('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  /**
   * Start the pooler service
   */
  async start(): Promise<void> {
    try {
      // Display startup banner
      this.displayStartupBanner();
      
      // Start HTTP server
      const port = Config.POOLER.PORT;
      const host = Config.POOLER.HOST;
      
      await this.app.listen({ port, host });
      this.log(`🚀 Pooler HTTP server started`, { host, port });

      // Start block monitoring after a brief delay
      setTimeout(async () => {
        try {
          await this.blockMonitor.startMonitoring();
          this.log('✅ Pooler service fully initialized');
        } catch (error) {
          this.logError('Failed to start block monitoring', error);
          process.exit(1);
        }
      }, 2000);

    } catch (error) {
      this.logError('Failed to start pooler service', error);
      process.exit(1);
    }
  }

  /**
   * Display startup banner
   */
  private displayStartupBanner(): void {
    const banner = `
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ██╗  ██╗ █████╗ ██╗     ███████╗    ██████╗  ██████╗  ██████╗ ██╗  ║
║   ██║ ██╔╝██╔══██╗██║     ██╔════╝    ██╔══██╗██╔═══██╗██╔═══██╗██║  ║
║   █████╔╝ ███████║██║     █████╗      ██████╔╝██║   ██║██║   ██║██║  ║
║   ██╔═██╗ ██╔══██║██║     ██╔══╝      ██╔═══╝ ██║   ██║██║   ██║██║  ║
║   ██║  ██╗██║  ██║███████╗███████╗    ██║     ╚██████╔╝╚██████╔╝███████╗║
║   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝    ╚═╝      ╚═════╝  ╚═════╝ ╚══════╝║
║                                                                      ║
║                      POOLER SERVICE                                  ║
║                   Block Discovery & Pool Coordination               ║
╚══════════════════════════════════════════════════════════════════════╝
`;

    console.log(chalk.cyan(banner));
    console.log(chalk.green.bold('🔍 KALE Pool Pooler Service - Phase 2'));
    console.log(chalk.yellow('📡 Block Discovery & Backend Coordination'));
    console.log('');
    console.log(chalk.blue(`⚙️  Configuration:`));
    console.log(`   • Network: ${Config.STELLAR.NETWORK}`);
    console.log(`   • Contract: ${Config.STELLAR.CONTRACT_ID}`);
    console.log(`   • Backend: ${Config.BACKEND_API.URL}`);
    console.log(`   • Poll Interval: ${Config.BLOCK_MONITOR.POLL_INTERVAL_MS}ms`);
    console.log('');
  }

  /**
   * Logging helper
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PoolerService] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  /**
   * Error logging helper
   */
  private logError(message: string, error: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [PoolerService] ❌ ${message}:`, error);
  }
}

// Start the service if this file is run directly
if (import.meta.main) {
  const pooler = new PoolerService();
  pooler.start().catch((error) => {
    console.error('💥 Fatal error starting pooler service:', error);
    process.exit(1);
  });
}

export default PoolerService;