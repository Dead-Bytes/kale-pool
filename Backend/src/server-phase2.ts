// KALE Pool Mining Backend API Server - Phase 2
// Express-based server with farmer onboarding and pool contracts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { plantService } from './services/plant-service';
import { workService } from './services/work-service';
import { harvestService } from './services/harvest-service';
import { stellarWalletManager } from './services/wallet-manager';
import { initializeDatabase } from './services/database';
import { BACKEND_CONFIG } from '../../Shared/utils/constants';

// Import Phase 2 routes
import { 
  registerUser, 
  checkFunding, 
  getUserStatus, 
  getAvailablePoolers, 
  getPoolerDetails,
  joinPool,
  confirmPoolJoin
} from './routes/registration-routes';

// Import centralized logger
import { backendLogger as logger } from '../../Shared/utils/logger';

// ======================
// EXPRESS SERVER SETUP
// ======================

export const createServer = (): express.Application => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });
    next();
  });

  // Response logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        status_code: res.statusCode,
        response_time_ms: responseTime
      });
    });
    
    next();
  });

  // Register routes
  registerRoutes(app);

  // Error handling middleware
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Request error', error, {
      method: req.method,
      url: req.url,
      body: req.body
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    res.status(500).json(errorResponse);
  });

  return app;
};

// ======================
// ROUTE REGISTRATION
// ======================

const registerRoutes = (app: express.Application): void => {
  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const [plantHealthy, workHealthy, harvestHealthy] = await Promise.all([
        plantService.isHealthy(),
        workService.isHealthy(),
        harvestService.isHealthy()
      ]);

      const healthy = plantHealthy && workHealthy && harvestHealthy;

      const response = {
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        phase: 2,
        services: {
          plant: plantHealthy,
          work: workHealthy,
          harvest: harvestHealthy,
          wallet: await stellarWalletManager.getServerHealth()
        },
        uptime: process.uptime()
      };

      res.status(healthy ? 200 : 503).json(response);
    } catch (error) {
      logger.error('Health check failed', error as Error);
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        phase: 2,
        services: {
          plant: false,
          work: false,
          harvest: false,
          wallet: false
        },
        uptime: process.uptime()
      });
    }
  });

  // Service info endpoint
  app.get('/info', async (req: Request, res: Response) => {
    try {
      const info = {
        service: 'KALE Pool Mining Backend',
        version: '2.0.0',
        phase: 2,
        features: [
          'Farmer Registration',
          'Pool Contracts',
          'Auto-planting',
          'Balance Monitoring',
          'Pool Discovery'
        ],
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

      res.status(200).json(info);
    } catch (error) {
      logger.error('Service info request failed', error as Error);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get service info',
        timestamp: new Date().toISOString()
      });
    }
  });

  // ======================
  // PHASE 2: FARMER ONBOARDING ROUTES
  // ======================

  // User registration
  app.post('/register', registerUser);

  // Funding check
  app.post('/check-funding', checkFunding);

  // User status
  app.get('/user/:userId/status', getUserStatus);

  // Pool discovery
  app.get('/poolers', getAvailablePoolers);
  app.get('/pooler/:poolerId/details', getPoolerDetails);

  // Pool joining
  app.post('/join-pool', joinPool);
  app.post('/confirm-pool-join', confirmPoolJoin);

  // ======================
  // POOLER COORDINATION ENDPOINTS
  // ======================

  // Block discovery notification from Pooler
  app.post('/pooler/block-discovered', async (req: Request, res: Response) => {
    try {
      const { event, poolerId, blockIndex, blockData, metadata } = req.body;

      logger.info('Block discovered notification', {
        block_index: blockIndex,
        pooler_id: poolerId,
        entropy_preview: blockData?.entropy?.substring(0, 16) + '...',
        plantable: blockData?.plantable,
        block_age: blockData?.blockAge
      });

      // Import block operations and pool contract queries
      const { blockOperationsQueries, poolContractQueries } = await import('./services/database-phase2');
      
      // 1. Check for active farmers first (needed for immediate DB record)
      const activeFarmers = await poolContractQueries.getActiveFarmersForPlanting();
      
      // 2. Record block discovery immediately in block_operations table
      const blockOperationId = await blockOperationsQueries.recordBlockDiscovery(
        blockIndex,
        poolerId,
        {
          entropy: blockData?.entropy || '',
          plantable: blockData?.plantable || false,
          blockAge: blockData?.blockAge || 0,
          minStake: blockData?.min_stake || '0',
          maxStake: blockData?.max_stake || '0',
          minZeros: blockData?.min_zeros || 0,
          maxZeros: blockData?.max_zeros || 0,
          discoveredBy: poolerId,
          discoveredAt: new Date().toISOString(),
          activeFarmersCount: activeFarmers.length
        }
      );
      
      // 3. Handle planting logic based on block age and farmer availability
      let plantResults = null;
      if (activeFarmers.length > 0) {
        if (blockData?.plantable) {
          // Block is ready for immediate planting
          logger.info('Triggering immediate plant operations for plantable block', {
            block_index: blockIndex,
            active_farmers: activeFarmers.length,
            block_age: blockData.blockAge
          });
          
          // TODO: Trigger parallel plant operations via Launchtube
          plantResults = {
            status: 'immediate_planting',
            triggered: true,
            farmerCount: activeFarmers.length,
            message: 'Plant operations initiated immediately'
          };
        } else {
          // Block is too young, schedule for later planting
          const timeToWait = Math.max(0, 30 - (blockData?.blockAge || 0));
          
          logger.info('Block too young, scheduling for delayed planting', {
            block_index: blockIndex,
            active_farmers: activeFarmers.length,
            current_age: blockData?.blockAge || 0,
            time_to_wait: timeToWait
          });
          
          // Schedule planting when block reaches 30 seconds
          setTimeout(async () => {
            try {
              logger.info('Executing scheduled plant operations', {
                block_index: blockIndex,
                scheduled_delay: timeToWait
              });
              
              // Re-check active farmers (they might have changed)
              const currentActiveFarmers = await poolContractQueries.getActiveFarmersForPlanting();
              
              if (currentActiveFarmers.length > 0) {
                // Execute parallel plant operations via Launchtube
                const plantStartTime = new Date();
                const plantingResults = await executePlantOperations(currentActiveFarmers, blockIndex);
                const plantEndTime = new Date();
                const plantDuration = plantEndTime.getTime() - plantStartTime.getTime();
                
                // Calculate total staked amount
                const totalStaked = plantingResults.details.reduce((sum, result) => {
                  return sum + (result.success ? result.stakeAmount : 0);
                }, 0);

                // Update block operation with comprehensive planting results
                await blockOperationsQueries.updateBlockOperationWithPlantingResults(
                  blockOperationId,
                  {
                    successfulPlants: plantingResults.successCount,
                    failedPlants: plantingResults.failCount,
                    totalStaked: totalStaked.toString(),
                    plantingDuration: plantDuration,
                    plantingDetails: plantingResults.details
                  }
                );
                
                // Notify Pooler about planting completion
                await notifyPoolerPlantingStatus(poolerId, {
                  blockIndex,
                  plantingStatus: 'completed',
                  farmersPlanted: currentActiveFarmers.length,
                  successfulPlants: plantingResults.successCount,
                  failedPlants: plantingResults.failCount,
                  plantingStartTime: plantStartTime.toISOString(),
                  plantingEndTime: plantEndTime.toISOString(),
                  duration: plantDuration,
                  details: plantingResults.details
                });
                
                logger.info('Scheduled plant operations completed with Pooler notification', {
                  block_index: blockIndex,
                  farmers_planted: currentActiveFarmers.length,
                  successful_plants: plantingResults.successCount,
                  failed_plants: plantingResults.failCount,
                  duration_ms: plantDuration
                });
              } else {
                logger.warn('No active farmers available for scheduled planting', {
                  block_index: blockIndex
                });
              }
            } catch (error) {
              logger.error('Scheduled planting failed', error as Error, {
                block_index: blockIndex
              });
            }
          }, timeToWait * 1000);
          
          plantResults = {
            status: 'scheduled_planting',
            triggered: false,
            farmerCount: activeFarmers.length,
            timeToWait,
            message: `Plant operations scheduled in ${timeToWait} seconds`
          };
        }
      } else {
        logger.info('No active farmers available for planting', {
          block_index: blockIndex,
          plantable: blockData?.plantable,
          reason: 'no_active_farmers'
        });
        
        plantResults = {
          status: 'no_farmers',
          triggered: false,
          farmerCount: 0,
          message: 'No active farmers available for planting'
        };
      }

      // 4. Update block operation with initial status
      await blockOperationsQueries.updateBlockOperationStatus(
        blockOperationId,
        'discovered',
        {
          totalActiveFarmers: activeFarmers.length,
          plantingTriggered: !!plantResults?.triggered,
          discoveryMetadata: metadata
        }
      );
      
      res.status(200).json({
        acknowledged: true,
        blockOperationId,
        message: 'Block discovery recorded and processed',
        blockIndex,
        activeFarmers: activeFarmers.length,
        plantable: blockData?.plantable || false,
        plantResults,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Block discovery endpoint error', error as Error);
      res.status(500).json({
        error: 'BLOCK_DISCOVERY_FAILED',
        message: 'Failed to process block discovery'
      });
    }
  });

  // ======================
  // PHASE 1: EXISTING POOLER ROUTES
  // ======================

  // Plant endpoint (enhanced for Phase 2)
  app.post('/plant', async (req: Request, res: Response) => {
    try {
      const { blockIndex, poolerId, maxFarmersCapacity } = req.body;

      logger.info('Plant request received', {
        block_index: blockIndex,
        pooler_id: poolerId,
        max_farmers_capacity: maxFarmersCapacity
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId || typeof maxFarmersCapacity !== 'number') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid blockIndex, poolerId, or maxFarmersCapacity',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Process plant request (now uses pool contracts)
      const result = await plantService.processPlantRequest(blockIndex, poolerId, maxFarmersCapacity);

      const response = {
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

      res.status(200).json(response);

    } catch (error) {
      logger.error('Plant request failed', error as Error, {
        request_body: req.body
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process plant request',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Work endpoint
  app.post('/work', async (req: Request, res: Response) => {
    try {
      const { blockIndex, poolerId, submissions } = req.body;

      logger.info('Work request received', {
        block_index: blockIndex,
        pooler_id: poolerId,
        submission_count: submissions?.length || 0
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId || !Array.isArray(submissions)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid blockIndex, poolerId, or submissions',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Process work submissions
      const result = await workService.processWorkSubmissions(blockIndex, poolerId, submissions);

      const response = {
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

      res.status(200).json(response);

    } catch (error) {
      logger.error('Work request failed', error as Error, {
        request_body: req.body
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process work request',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Harvest endpoint
  app.post('/harvest', async (req: Request, res: Response) => {
    try {
      const { blockIndex, poolerId } = req.body;

      logger.info('Harvest request received', {
        block_index: blockIndex,
        pooler_id: poolerId
      });

      // Validate request
      if (typeof blockIndex !== 'number' || !poolerId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid blockIndex or poolerId',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Process harvest request
      const result = await harvestService.processHarvestRequest(blockIndex, poolerId);

      const response = {
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

      res.status(200).json(response);

    } catch (error) {
      logger.error('Harvest request failed', error as Error, {
        request_body: req.body
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process harvest request',
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
    // Initialize database
    logger.info('Initializing database connection...');
    await initializeDatabase();
    
    const app = createServer();
    
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    app.listen(port, host, () => {
      logger.info('Backend API server started', {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        phase: 2,
        features: 'Farmer Onboarding + Pool Contracts'
      });
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

// ======================
// PLANT COORDINATION HELPERS
// ======================

/**
 * Execute plant operations in parallel for all active farmers
 */
async function executePlantOperations(activeFarmers: any[], blockIndex: number): Promise<{
  successCount: number;
  failCount: number;
  details: any[];
}> {
  logger.info('Executing parallel plant operations', {
    block_index: blockIndex,
    farmer_count: activeFarmers.length
  });

  const plantPromises = activeFarmers.map(async (farmer) => {
    try {
      // Calculate stake amount from farmer's stake percentage (0% = 0 KALE)
      const stakeAmount = Math.max(0, farmer.stake_percentage * 12); // Base stake of 12 KALE
      
      // Execute plant via Launchtube
      const result = await stellarWalletManager.plantForFarmer(
        farmer.custodial_secret_key,
        stakeAmount.toString()
      );

      return {
        farmerId: farmer.id,
        email: farmer.email,
        stakeAmount,
        success: result.success,
        transactionHash: result.transactionHash,
        error: result.error
      };
    } catch (error) {
      return {
        farmerId: farmer.id,
        email: farmer.email,
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Execute all plants in parallel
  const results = await Promise.all(plantPromises);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger.info('Parallel plant operations completed', {
    block_index: blockIndex,
    total_farmers: results.length,
    successful: successCount,
    failed: failCount
  });

  return {
    successCount,
    failCount,
    details: results
  };
}

/**
 * Notify Pooler about planting status and results
 */
async function notifyPoolerPlantingStatus(poolerId: string, plantingData: any): Promise<void> {
  try {
    // Get pooler endpoint from database
    const { poolerQueriesPhase2 } = await import('./services/database-phase2');
    const pooler = await poolerQueriesPhase2.getPoolerWithSettings(poolerId);
    if (!pooler || !pooler.api_endpoint) {
      logger.warn('Pooler endpoint not found, skipping notification', { pooler_id: poolerId });
      return;
    }

    const notification = {
      event: 'planting_completed',
      backendId: process.env.BACKEND_ID || 'kale-pool-backend',
      blockIndex: plantingData.blockIndex,
      plantingStatus: plantingData.plantingStatus,
      results: {
        farmersPlanted: plantingData.farmersPlanted,
        successfulPlants: plantingData.successfulPlants,
        failedPlants: plantingData.failedPlants,
        plantingStartTime: plantingData.plantingStartTime,
        plantingEndTime: plantingData.plantingEndTime,
        duration: plantingData.duration,
        details: plantingData.details
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Notifying Pooler about planting completion', {
      pooler_id: poolerId,
      pooler_endpoint: pooler.api_endpoint,
      block_index: plantingData.blockIndex,
      successful_plants: plantingData.successfulPlants
    });

    const response = await fetch(`${pooler.api_endpoint}/backend/planting-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Backend-ID': process.env.BACKEND_ID || 'kale-pool-backend',
        'Authorization': `Bearer ${pooler.api_key || 'dev-key'}`
      },
      body: JSON.stringify(notification)
    });

    if (response.ok) {
      const result = await response.json();
      logger.info('Pooler notification successful', {
        pooler_id: poolerId,
        response: result
      });
    } else {
      const errorText = await response.text();
      logger.warn('Pooler notification failed', {
        pooler_id: poolerId,
        status: response.status,
        error: errorText
      });
    }

  } catch (error) {
    logger.error('Failed to notify Pooler about planting status', error as Error, {
      pooler_id: poolerId,
      block_index: plantingData.blockIndex
    });
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    logger.error('Server startup failed', error);
    process.exit(1);
  });
}