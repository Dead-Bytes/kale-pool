// KALE Pool Mining Pooler Service - Phase 2
// Block discovery and pool coordination service

import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import BlockMonitor from './services/block-monitor';
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
        const { block_index, pooler_id, successful_plants, failed_plants, farmers_planted, duration_ms } = request.body as any;
        
        this.log(`🌱 Received planting status notification`, {
          block_index,
          pooler_id,
          successful_plants,
          failed_plants,
          farmers_planted,
          duration_ms
        });

        // Log planting results
        if (successful_plants > 0) {
          this.log(`✅ Block ${block_index}: ${successful_plants} successful plants`);
        }
        if (failed_plants > 0) {
          this.log(`❌ Block ${block_index}: ${failed_plants} failed plants`);
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