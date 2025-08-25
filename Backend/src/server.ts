// KALE Pool Mining Backend API Server
// Phase 1: REST API for Pooler coordination

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { plantService } from './services/plant-service';
import { workService } from './services/work-service';
import { harvestService } from './services/harvest-service';
import { stellarWalletManager } from './services/wallet-manager';
import { farmerQueries, poolerQueries } from './services/database';
import { BACKEND_CONFIG } from '../../Shared/utils/constants';
import type {
  FarmerRegistrationRequest,
  FarmerRegistrationResponse,
  PlantRequestBody,
  PlantResponse,
  WorkCompleteRequestBody,
  WorkCompleteResponse,
  HarvestRequestBody,
  HarvestResponse,
  HealthCheckResponse,
  ErrorResponse
} from './types/api-types';

// Logger implementation
class APILogger {
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

const logger = new APILogger('BackendAPI');

// ======================
// FASTIFY SERVER SETUP
// ======================

export const createServer = async (): Promise<FastifyInstance> => {
  const fastifyApp = fastify({
    logger: process.env.NODE_ENV === 'development' ? {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    } : {
      level: 'info'
    }
  });

  // Request logging
  fastifyApp.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('Incoming request', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      user_agent: request.headers['user-agent']
    });
  });

  // Response logging
  fastifyApp.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      status_code: reply.statusCode,
      response_time: reply.getResponseTime()
    });
  });

  // Error handling
  fastifyApp.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    logger.error('Request error', error, {
      method: request.method,
      url: request.url,
      status_code: reply.statusCode
    });

    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    return reply.status(500).send(errorResponse);
  });

  // Register routes
  await registerRoutes(fastifyApp);

  return fastifyApp;
};

// ======================
// ROUTE REGISTRATION
// ======================

const registerRoutes = async (fastify: FastifyInstance): Promise<void> => {
  // Health check endpoint
  fastify.get<{ Reply: HealthResponse }>('/health', async (request, reply) => {
    try {
      const [plantHealthy, workHealthy, harvestHealthy] = await Promise.all([
        plantService.isHealthy(),
        workService.isHealthy(),
        harvestService.isHealthy()
      ]);

      const healthy = plantHealthy && workHealthy && harvestHealthy;

      const response: HealthResponse = {
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          plant: plantHealthy,
          work: workHealthy,
          harvest: harvestHealthy,
          wallet: await stellarWalletManager.getServerHealth()
        },
        uptime: process.uptime()
      };

      return reply.status(healthy ? 200 : 503).send(response);
    } catch (error) {
      logger.error('Health check failed', error as Error);
      
      const response: HealthResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          plant: false,
          work: false,
          harvest: false,
          wallet: false
        },
        uptime: process.uptime()
      };
      
      return reply.status(503).send(response);
    }
  });

  // Farmer registration endpoint
  fastify.post<{ Body: RegisterFarmerRequest; Reply: RegisterFarmerResponse }>('/farmers/register', async (request, reply) => {
    try {
      const { poolerId, stakePercentage, metadata } = request.body;

      logger.info('Farmer registration request', {
        pooler_id: poolerId,
        stake_percentage: stakePercentage,
        metadata
      });

      // Validate request
      if (!poolerId || typeof stakePercentage !== 'number' || stakePercentage < 0 || stakePercentage > 1) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid poolerId or stakePercentage',
          timestamp: new Date().toISOString()
        });
      }

      // Check if pooler exists
      const pooler = await poolerQueries.getPoolerById(poolerId);
      if (!pooler) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Pooler not found',
          timestamp: new Date().toISOString()
        });
      }

      // Generate custodial wallet
      const walletResult = await stellarWalletManager.generateWallet();
      if (!walletResult.success) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to generate custodial wallet',
          timestamp: new Date().toISOString()
        });
      }

      // Register farmer in database
      const farmerId = await farmerQueries.createFarmer(
        poolerId,
        walletResult.publicKey!,
        walletResult.secretKey!,
        stakePercentage,
        metadata
      );

      const response: RegisterFarmerResponse = {
        farmerId,
        custodialWallet: walletResult.publicKey!,
        poolerId,
        stakePercentage,
        status: 'active',
        currentBalance: '0',
        totalEarnings: '0',
        registeredAt: new Date().toISOString()
      };

      logger.info('Farmer registration successful', {
        farmer_id: farmerId,
        pooler_id: poolerId,
        custodial_wallet: walletResult.publicKey
      });

      return reply.status(201).send(response);

    } catch (error) {
      logger.error('Farmer registration failed', error as Error, {
        request_body: request.body
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to register farmer',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Plant endpoint
  fastify.post<{ Body: PlantRequest; Reply: PlantResponse }>('/plant', async (request, reply) => {
    try {
      const { blockIndex, poolerId, maxFarmersCapacity } = request.body;

      logger.info('Plant request received', {
        block_index: blockIndex,
        pooler_id: poolerId,
        max_farmers_capacity: maxFarmersCapacity
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId || typeof maxFarmersCapacity !== 'number') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid blockIndex, poolerId, or maxFarmersCapacity',
          timestamp: new Date().toISOString()
        });
      }

      // Process plant request
      const result = await plantService.processPlantRequest(blockIndex, poolerId, maxFarmersCapacity);

      const response: PlantResponse = {
        blockIndex: result.blockIndex,
        poolerId: result.poolerId,
        totalRequested: result.totalRequested,
        successfulPlants: result.successfulPlants.length,
        failedPlants: result.failedPlants.length,
        totalStaked: result.totalStaked,
        processingTimeMs: result.processingTimeMs,
        timestamp: new Date().toISOString()
      };

      logger.info('Plant request completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        successful_plants: result.successfulPlants.length,
        failed_plants: result.failedPlants.length,
        total_staked: result.totalStaked
      });

      return reply.status(200).send(response);

    } catch (error) {
      logger.error('Plant request failed', error as Error, {
        request_body: request.body
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process plant request',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Work endpoint
  fastify.post<{ Body: WorkRequest; Reply: WorkResponse }>('/work', async (request, reply) => {
    try {
      const { blockIndex, poolerId, submissions } = request.body;

      logger.info('Work request received', {
        block_index: blockIndex,
        pooler_id: poolerId,
        submission_count: submissions.length
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId || !Array.isArray(submissions)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid blockIndex, poolerId, or submissions',
          timestamp: new Date().toISOString()
        });
      }

      // Process work submissions
      const result = await workService.processWorkSubmissions(blockIndex, poolerId, submissions);

      const response: WorkResponse = {
        blockIndex: result.blockIndex,
        poolerId: result.poolerId,
        totalSubmissions: result.totalSubmissions,
        validNonces: result.validNonces.length,
        invalidNonces: result.invalidNonces.length,
        submittedWork: result.submittedWork.length,
        totalRewards: result.totalRewards,
        processingTimeMs: result.processingTimeMs,
        timestamp: new Date().toISOString()
      };

      logger.info('Work request completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        valid_nonces: result.validNonces.length,
        invalid_nonces: result.invalidNonces.length,
        submitted_work: result.submittedWork.length
      });

      return reply.status(200).send(response);

    } catch (error) {
      logger.error('Work request failed', error as Error, {
        request_body: request.body
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process work request',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Harvest endpoint
  fastify.post<{ Body: HarvestRequest; Reply: HarvestResponse }>('/harvest', async (request, reply) => {
    try {
      const { blockIndex, poolerId } = request.body;

      logger.info('Harvest request received', {
        block_index: blockIndex,
        pooler_id: poolerId
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid blockIndex or poolerId',
          timestamp: new Date().toISOString()
        });
      }

      // Process harvest request
      const result = await harvestService.processHarvestRequest(blockIndex, poolerId);

      const response: HarvestResponse = {
        blockIndex: result.blockIndex,
        poolerId: result.poolerId,
        totalEligible: result.totalEligible,
        successfulHarvests: result.successfulHarvests.length,
        failedHarvests: result.failedHarvests.length,
        totalRewards: result.totalRewards,
        processingTimeMs: result.processingTimeMs,
        timestamp: new Date().toISOString()
      };

      logger.info('Harvest request completed', {
        block_index: blockIndex,
        pooler_id: poolerId,
        successful_harvests: result.successfulHarvests.length,
        failed_harvests: result.failedHarvests.length,
        total_rewards: result.totalRewards
      });

      return reply.status(200).send(response);

    } catch (error) {
      logger.error('Harvest request failed', error as Error, {
        request_body: request.body
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process harvest request',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Service info endpoint
  fastify.get('/info', async (request, reply) => {
    try {
      const info = {
        service: 'KALE Pool Mining Backend',
        version: '1.0.0',
        phase: 1,
        network: stellarWalletManager.getNetworkInfo(),
        services: {
          plant: plantService.getServiceInfo(),
          work: workService.getServiceInfo(),
          harvest: harvestService.getServiceInfo()
        },
        config: {
          max_farmers_per_request: BACKEND_CONFIG.MAX_FARMERS_PER_REQUEST,
          api_rate_limit: BACKEND_CONFIG.API_RATE_LIMIT,
          request_timeout: BACKEND_CONFIG.REQUEST_TIMEOUT
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      return reply.status(200).send(info);
    } catch (error) {
      logger.error('Service info request failed', error as Error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get service info',
        timestamp: new Date().toISOString()
      });
    }
  });
};

// ======================
// SERVER STARTUP
// ======================

export const startServer = async (): Promise<void> => {
  try {
    const server = await createServer();
    
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info('Backend API server started', {
      port,
      host,
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    logger.error('Server startup failed', error);
    process.exit(1);
  });
}
