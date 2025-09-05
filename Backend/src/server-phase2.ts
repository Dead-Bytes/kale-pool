// KALE Pool Mining Backend API Server - Phase 2
// Express-based server with farmer onboarding and pool contracts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { plantService } from './services/plant-service';
import { workService } from './services/work-service';
import { harvestService } from './services/harvest-service';
import { automatedHarvestService } from './services/automated-harvest-service';
import { stellarWalletManager, type WalletKeypair } from './services/wallet-manager';
import { initializeDatabase } from './services/database';
import Config from '../../Shared/config';
import { farmerQueriesPhase2, userQueries } from './services/database-phase2';

// Import Phase 2 routes
import { 
  checkFunding, 
  getUserStatus, 
  getAvailablePoolers, 
  getPoolerDetails,
  joinPool,
  confirmPoolJoin
} from './routes/registration-routes';

// Import new API routes
import authRoutes from './routes/auth';
import poolerRoutes from './routes/poolers';
import contractRoutes from './routes/contracts';
import farmerRoutes from './routes/farmers';

// Import rate limiting middleware
import { logRateLimitHeaders } from './middleware/rateLimit';

// Import centralized logger
import { backendLogger as logger } from '../../Shared/utils/logger';

// ======================
// EXPRESS SERVER SETUP
// ======================

export const createServer = (): express.Application => {
  const app = express();

  // Middleware
  app.use(cors({
    origin: Config.BACKEND.CORS_ORIGIN,
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Rate limiting headers logging
  app.use(logRateLimitHeaders);

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`Incoming request ${JSON.stringify({
      method: req.method,
      url: req.url,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    })}`);
    next();
  });

  // Response logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.info(`Request completed ${JSON.stringify({
        method: req.method,
        url: req.url,
        status_code: res.statusCode,
        response_time_ms: responseTime
      })}`);
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
      message: Config.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
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

  // ======================
  // NEW API ENDPOINTS (SRS SPECIFICATION)
  // ======================
  
  // Authentication endpoints
  app.use('/auth', authRoutes);
  
  // Pooler discovery and management
  app.use('/poolers', poolerRoutes);
  
  // Contract management
  app.use('/contracts', contractRoutes);
  
  // Farmer analytics
  app.use('/farmers', farmerRoutes);

  // ======================
  // LEGACY/HEALTH ENDPOINTS
  // ======================

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const [plantHealthy, workHealthy, harvestHealthy] = await Promise.all([
        plantService.isHealthy(),
        workService.isHealthy(),
        harvestService.isHealthy()
      ]);

      const automatedHarvestStatus = automatedHarvestService.getStatus();
      const healthy = plantHealthy && workHealthy && harvestHealthy && automatedHarvestStatus.running;

      const response = {
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        phase: 2,
        services: {
          plant: plantHealthy,
          work: workHealthy,
          harvest: harvestHealthy,
          automated_harvest: automatedHarvestStatus.running,
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
          automated_harvest: false,
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
          harvest: harvestService.getServiceInfo(),
          automated_harvest: automatedHarvestStatus
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

  // Unified farmer registration (handles both users and farmers tables)
  app.post('/register-farmer', async (req: Request, res: Response) => {
    try {
      const { email, password, externalWallet } = req.body;

      if (!email || !password || !externalWallet) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Email, password, and external wallet address are required'
        });
      }

      // Check if user already exists
      const existingUser = await userQueries.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: 'USER_EXISTS',
          message: 'A user with this email already exists'
        });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user with external wallet and hashed password
      const newUserId = await userQueries.createUser(email, hashedPassword, externalWallet);
      if (!newUserId) {
        return res.status(500).json({
          error: 'USER_CREATION_FAILED',
          message: 'Failed to create user record'
        });
      }

      // Generate custodial wallet
      let wallet: WalletKeypair;
      try {
        const walletResult = await stellarWalletManager.generateCustodialWallet();
        if (!walletResult.success || !walletResult.publicKey || !walletResult.secretKey) {
          // Clean up by removing the user record since wallet generation failed
          await userQueries.deleteUserById(newUserId);
          return res.status(500).json({
            error: 'WALLET_GENERATION_FAILED',
            message: 'Failed to generate custodial wallet'
          });
        }
        wallet = {
          publicKey: walletResult.publicKey,
          secretKey: walletResult.secretKey
        };
      } catch (error) {
        // Clean up by removing the user record since wallet generation failed
        await userQueries.deleteUserById(newUserId);
        return res.status(500).json({
          error: 'WALLET_GENERATION_FAILED',
          message: 'Failed to generate custodial wallet'
        });
      }

      // Create farmer record
      try {
        const farmerId = await farmerQueriesPhase2.createFarmerWithUser(
          newUserId,
          wallet.publicKey,
          wallet.secretKey,
          externalWallet
        );

        // Generate JWT token for the new user
        const token = jwt.sign(
          { userId: newUserId, farmerId: farmerId },
          Config.BACKEND.JWT_SECRET,
          { expiresIn: '24h' }
        );

        return res.status(201).json({
          success: true,
          message: 'Farmer registered successfully',
          data: {
            userId: newUserId,
            farmerId: farmerId,
            token
          }
        });
      } catch (error) {
        // If farmer creation fails, clean up the user record
        await userQueries.deleteUserById(newUserId);
        return res.status(500).json({
          error: 'REGISTRATION_FAILED',
          message: 'Failed to register farmer'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user with proper external wallet
      const { db } = await import('./services/database');
      const userId = await db.query(`
        INSERT INTO users (email, external_wallet, status, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [email, externalWallet, 'registered', passwordHash, 'farmer']).then(res => res.rows[0].id);
      
      // Create farmer record
      const farmerId = await farmerQueriesPhase2.createFarmerWithUser(
        userId,
        wallet.publicKey,
        wallet.secretKey,
        externalWallet
      );

      // Generate JWT token
      const token = jwt.sign({
        userId,
        email,
        role: 'farmer',
        entityId: farmerId
      }, Config.BACKEND.JWT_SECRET, {
        expiresIn: Config.BACKEND.JWT_EXPIRES_IN
      });

      logger.info(`Unified farmer registration successful ${JSON.stringify({
        user_id: userId,
        farmer_id: farmerId,
        email,
        custodial_wallet: wallet.publicKey
      })}`);

      res.status(201).json({
        userId,
        farmerId,
        email,
        custodialWallet: wallet.publicKey,
        token,
        role: 'farmer',
        status: 'wallet_created',
        message: 'Registration successful. Please fund your custodial wallet with XLM.',
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Unified farmer registration error', error as Error);
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to register farmer'
      });
    }
  });

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
      const { poolerId, blockIndex, blockData, metadata } = req.body;
      
      // Extract fields from nested blockData
      const entropy = blockData?.entropy || '';
      const blockTimestamp = blockData?.timestamp;
      const blockAge = blockData?.blockAge || 0;
      const discoveredAt = metadata?.discoveredAt;

      logger.info(`Block discovered notification ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        entropy_preview: entropy ? entropy.substring(0, 16) + '...' : 'none',
        block_age: blockAge,
        plantable: blockData?.plantable,
        full_request_body: JSON.stringify(req.body)
      })}`);

      // Import block operations and pool contract queries
      const { blockOperationsQueries, poolContractQueries } = await import('./services/database-phase2');
      
      // 1. Check for active farmers first (needed for immediate DB record)
      const activeFarmers = await poolContractQueries.getActiveFarmersForPlanting();
      
      // 2. Record block discovery immediately in block_operations table
      const blockOperationId = await blockOperationsQueries.recordBlockDiscovery(
        blockIndex,
        poolerId,
        {
          entropy: entropy,
          plantable: blockData?.plantable || false,
          blockAge: blockAge,
          timestamp: blockTimestamp,
          minStake: blockData?.min_stake || '0',
          maxStake: blockData?.max_stake || '250000000',
          minZeros: blockData?.min_zeros || 5,
          maxZeros: blockData?.max_zeros || 9,
          discoveredBy: poolerId,
          discoveredAt: discoveredAt || new Date().toISOString(),
          activeFarmersCount: activeFarmers.length
        }
      );
      
      // 3. Handle planting logic based on block age and farmer availability
      let plantResults = null;
      if (activeFarmers.length > 0) {
        const isPlantable = blockAge >= 30;
        if (isPlantable) {
          // Block is ready for immediate planting
          logger.info(`Triggering immediate plant operations for plantable block ${JSON.stringify({
            block_index: blockIndex,
            active_farmers: activeFarmers.length,
            block_age: blockAge
          })}`);
          
          // TODO: Trigger parallel plant operations via Launchtube
          plantResults = {
            status: 'immediate_planting',
            triggered: true,
            farmerCount: activeFarmers.length,
            message: 'Plant operations initiated immediately'
          };
        } else {
          // Block is too young, schedule for later planting
          const safeBlockAge = typeof blockAge === 'number' ? blockAge : 0;
          const timeToWait = Math.max(0, 30 - safeBlockAge);
          
          logger.info(`Block too young, scheduling for delayed planting ${JSON.stringify({
            block_index: blockIndex,
            active_farmers: activeFarmers.length,
            current_age: blockAge,
            time_to_wait: timeToWait
          })}`);
          
          // Schedule planting when block reaches 30 seconds
          setTimeout(async () => {
            try {
              logger.info(`Executing scheduled plant operations ${JSON.stringify({
                block_index: blockIndex,
                scheduled_delay: timeToWait
              })}`);
              
              // Re-check active farmers (they might have changed)
              const currentActiveFarmers = await poolContractQueries.getActiveFarmersForPlanting();
              
              // Get the stored block data from database
              const storedBlockData = await blockOperationsQueries.getBlockData(blockIndex);
              
              if (!storedBlockData || !storedBlockData.entropy) {
                logger.error(`No block data found in database for scheduled planting ${JSON.stringify({
                  block_index: blockIndex,
                  has_stored_data: !!storedBlockData
                })}`);
                return;
              }
              
              logger.debug(`Retrieved block data for scheduled planting ${JSON.stringify({
                block_index: blockIndex,
                has_entropy: !!storedBlockData.entropy,
                entropy_length: storedBlockData.entropy?.length || 0,
                entropy_preview: storedBlockData.entropy ? storedBlockData.entropy.substring(0, 16) + '...' : 'none',
                stored_block_data: JSON.stringify(storedBlockData)
              })}`);
              
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
                
                // Notify Pooler about planting completion with planted farmers for work coordination
                const successfullyPlantedFarmers = plantingResults.details
                  .filter((result: any) => result.success === true)
                  .map((result: any) => {
                    // Find the original farmer data to get custodial keys
                    const farmerData = currentActiveFarmers.find(f => f.id === result.farmerId);
                    return {
                      farmerId: result.farmerId,
                      custodialWallet: farmerData?.custodial_public_key,
                      custodialSecretKey: farmerData?.custodial_secret_key,
                      stakeAmount: result.stakeAmount.toString(),
                      plantingTime: new Date().toISOString()
                    };
                  });

                await notifyPoolerPlantingStatus(poolerId, {
                  blockIndex,
                  plantingStatus: 'completed',
                  farmersPlanted: currentActiveFarmers.length,
                  successfulPlants: plantingResults.successCount,
                  failedPlants: plantingResults.failCount,
                  plantingStartTime: plantStartTime.toISOString(),
                  plantingEndTime: plantEndTime.toISOString(),
                  duration: plantDuration,
                  details: plantingResults.details,
                  // Add planted farmers for work coordination
                  plantedFarmers: successfullyPlantedFarmers,
                  blockData: storedBlockData
                });
                
                logger.info(`Scheduled plant operations completed with Pooler notification ${JSON.stringify({
                  block_index: blockIndex,
                  farmers_planted: currentActiveFarmers.length,
                  successful_plants: plantingResults.successCount,
                  failed_plants: plantingResults.failCount,
                  duration_ms: plantDuration
                })}`);
              } else {
                logger.warn(`No active farmers available for scheduled planting ${JSON.stringify({
                  block_index: blockIndex
                })}`);
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
        logger.info(`No active farmers available for planting ${JSON.stringify({
          block_index: blockIndex,
          plantable: blockAge >= 30,
          reason: 'no_active_farmers'
        })}`);
        
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

  // Work completion notification from Pooler
  app.post('/pooler/work-completed', async (req: Request, res: Response) => {
    try {
      const { blockIndex, poolerId, workResults, summary } = req.body;
      
      // Import required services
      const { blockOperationsQueries } = await import('./services/database-phase2');
      const { db } = await import('./services/database');
      
      logger.info(`Work completion notification received from Pooler ${JSON.stringify({
        pooler_id: poolerId,
        block_index: blockIndex,
        total_farmers: summary?.totalFarmers || 0,
        successful_work: summary?.successfulWork || 0,
        failed_work: summary?.failedWork || 0,
        total_time_ms: summary?.totalWorkTime || 0,
        work_results: JSON.stringify(workResults),
        summary: JSON.stringify(summary)
      })}`);

      // Process work results
      if (workResults && Array.isArray(workResults)) {
        const successfulFarmers: string[] = [];
        let successfulWorksCount = 0;
        let failedWorksCount = 0;
        
        // Save each work result to database
        for (const result of workResults) {
          try {
            // Insert work record into works table
            await db.query(`
              INSERT INTO works (
                block_index, farmer_id, pooler_id, custodial_wallet, 
                nonce, hash, zeros, gap, transaction_hash, 
                status, error_message, compensation_required, worked_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            `, [
              blockIndex,
              result.farmerId, 
              poolerId,
              result.custodialWallet || '',
              result.nonce || '',
              result.hash || '',
              result.zeros || 0,
              result.gap || 0,
              result.transactionHash || '',
              result.status,
              result.error || null,
              result.compensationRequired || false
            ]);

            if (result.status === 'success' || result.status === 'recovered') {
              logger.info(`Successful work result saved to database ${JSON.stringify({
                farmer_id: result.farmerId,
                nonce: result.nonce,
                zeros: result.zeros,
                work_time_ms: result.workTime
              })}`);
              successfulFarmers.push(result.farmerId);
              successfulWorksCount++;
            } else {
              failedWorksCount++;
              if (result.compensationRequired) {
                logger.warn(`Failed work requiring compensation saved to database ${JSON.stringify({
                  farmer_id: result.farmerId,
                  error: result.error,
                  attempts: result.attempts
                })}`);
              }
            }
          } catch (dbError) {
            logger.error('Failed to save work result to database', dbError as Error, {
              farmer_id: result.farmerId,
              block_index: blockIndex
            });
            failedWorksCount++;
          }
        }

        // Update block operation with work completion
        try {
          await blockOperationsQueries.updateBlockOperationWorkCompletion(blockIndex, {
            successfulWorks: successfulWorksCount,
            totalWorks: workResults.length,
            workCompletedAt: new Date()
          });
          
          logger.info(`Updated block operation with work completion ${JSON.stringify({
            block_index: blockIndex,
            successful_works: successfulWorksCount,
            failed_works: failedWorksCount,
            total_works: workResults.length
          })}`);
        } catch (updateError) {
          logger.error('Failed to update block operation with work completion', updateError as Error, {
            block_index: blockIndex
          });
        }

        // Log harvest eligibility notification
        if (successfulFarmers.length > 0) {
          logger.info(`🌾 Farmers now eligible for harvest ${JSON.stringify({
            block_index: blockIndex,
            eligible_farmers: successfulFarmers.length,
            farmer_ids: successfulFarmers.map(id => id.substring(0, 8) + '...'),
            note: 'Automated harvest service will process these farmers after their configured intervals'
          })}`);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Work completion notification processed',
        blockIndex: blockIndex,
        processedResults: workResults?.length || 0,
        compensationInstructions: [], // Future: Add compensation logic
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to process work completion notification', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to process work completion notification',
        timestamp: new Date().toISOString()
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

      logger.info(`Plant request received ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        max_farmers_capacity: maxFarmersCapacity
      })}`);

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

      logger.info(`Plant request completed ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        successful_plants: result.successfulPlants.length,
        failed_plants: result.failedPlants.length,
        total_staked: result.totalStaked
      })}`);

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

      logger.info(`Work request received ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        submission_count: submissions?.length || 0
      })}`);

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

      logger.info(`Work request completed ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        valid_nonces: result.validNonces.length,
        invalid_nonces: result.invalidNonces.length,
        submitted_work: result.submittedWork.length
      })}`);

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

      logger.info(`Harvest request received ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId
      })}`);

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

      logger.info(`Harvest request completed ${JSON.stringify({
        block_index: blockIndex,
        pooler_id: poolerId,
        successful_harvests: result.successfulHarvests.length,
        failed_harvests: result.failedHarvests.length,
        total_rewards: result.totalRewards
      })}`);

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

  // Automated Harvest Service Management
  app.post('/harvest/start', async (req: Request, res: Response) => {
    try {
      automatedHarvestService.start();
      
      res.json({
        success: true,
        message: 'Automated harvest service started',
        status: automatedHarvestService.getStatus(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to start automated harvest service', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to start automated harvest service',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/harvest/stop', async (req: Request, res: Response) => {
    try {
      automatedHarvestService.stop();
      
      res.json({
        success: true,
        message: 'Automated harvest service stopped',
        status: automatedHarvestService.getStatus(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to stop automated harvest service', error as Error);
      res.status(500).json({
        error: 'Internal Server Error', 
        message: 'Failed to stop automated harvest service',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/harvest/status', async (req: Request, res: Response) => {
    try {
      res.json({
        service: 'automated-harvest',
        status: automatedHarvestService.getStatus(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get harvest service status', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get harvest service status', 
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/harvest/trigger', async (req: Request, res: Response) => {
    try {
      logger.info('Manual harvest trigger requested');
      
      const result = await automatedHarvestService.triggerImmediateHarvest();
      
      res.json({
        success: true,
        message: 'Manual harvest completed',
        result: {
          processed_count: result.processedCount,
          successful_harvests: result.successfulHarvests.length,
          failed_harvests: result.failedHarvests.length,
          total_rewards: (Number(result.totalRewards) / 10**7).toFixed(4) + ' KALE',
          batch_duration_ms: result.batchDurationMs
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Manual harvest trigger failed', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Manual harvest trigger failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Force harvest - bypasses all delays for testing
  app.post('/harvest/force', async (req: Request, res: Response) => {
    try {
      logger.info('🚨 FORCE HARVEST triggered - bypassing all delays for testing');
      
      // Use the existing automated harvest service force trigger
      const harvestResult = await automatedHarvestService.triggerImmediateHarvest();
      
      res.json({
        success: true,
        message: 'Force harvest completed',
        result: {
          processed_count: harvestResult.processedCount,
          successful_harvests: harvestResult.successfulHarvests.length,
          failed_harvests: harvestResult.failedHarvests.length,
          total_rewards: (Number(harvestResult.totalRewards) / 10**7).toFixed(4) + ' KALE',
          batch_duration_ms: harvestResult.batchDurationMs
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Force harvest failed', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Force harvest failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test harvest endpoint for debugging
  app.post('/test-direct-harvest', async (req: Request, res: Response) => {
    try {
      logger.info(`Direct harvest test triggered ${JSON.stringify({ body: req.body })}`);
      
      const { farmerPublicKey, farmerSecretKey, blockIndex } = req.body;
      
      if (!farmerPublicKey || !farmerSecretKey || !blockIndex) {
        return res.status(400).json({
          error: 'Missing required fields: farmerPublicKey, farmerSecretKey, blockIndex'
        });
      }

      // Import LaunchtubeService
      const { launchtubeService } = await import('./services/launchtube-service');
      
      // Attempt direct harvest
      const harvestResult = await launchtubeService.harvest({
        farmerPublicKey,
        farmerSecretKey,
        blockIndex: parseInt(blockIndex)
      });

      logger.info(`Direct harvest result ${JSON.stringify({ result: harvestResult })}`);

      res.json({
        success: true,
        message: 'Direct harvest test completed',
        result: harvestResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Direct harvest test failed', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Direct harvest test failed',
        details: (error as Error).message,
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
    
    const port = Config.BACKEND.PORT;
    const host = Config.BACKEND.HOST;
    
    app.listen(port, host, () => {
      logger.info(`Backend API server started ${JSON.stringify({
        port,
        host,
        environment: Config.NODE_ENV,
        phase: 2,
        features: 'Farmer Onboarding + Pool Contracts'
      })}`);

      // Start automated harvest service after server is running
      setTimeout(() => {
        try {
          automatedHarvestService.start();
          logger.info('✅ Automated harvest service started successfully');
        } catch (error) {
          logger.error('Failed to start automated harvest service', error as Error);
        }
      }, 3000); // 3 second delay to ensure everything is initialized
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
  logger.info(`Executing parallel plant operations ${JSON.stringify({
    block_index: blockIndex,
    farmer_count: activeFarmers.length
  })}`);

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
  
  // Record each plant operation in database
  const { plantingQueries } = await import('./services/database-phase2');
  
  for (const result of results) {
    try {
      await plantingQueries.recordPlantOperation({
        block_index: blockIndex,
        farmer_id: result.farmerId,
        pooler_id: '12345678-1234-5678-9abc-123456789000', // Current pooler ID
        custodial_wallet: activeFarmers.find(f => f.id === result.farmerId)?.custodial_public_key || '',
        stake_amount: (result.stakeAmount || 0).toString(),
        transaction_hash: result.success ? result.transactionHash : undefined,
        status: result.success ? 'success' : 'failed',
        error_message: result.success ? undefined : result.error
      });
    } catch (dbError) {
      logger.error('Failed to record plant operation in database', dbError as Error, {
        farmer_id: result.farmerId,
        block_index: blockIndex
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger.info(`Parallel plant operations completed ${JSON.stringify({
    block_index: blockIndex,
    total_farmers: results.length,
    successful: successCount,
    failed: failCount
  })}`);

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
      logger.warn(`Pooler endpoint not found, skipping notification ${JSON.stringify({ pooler_id: poolerId })}`);
      return;
    }

    const notification = {
      event: 'planting_completed',
      backendId: Config.BACKEND.ID,
      block_index: plantingData.blockIndex,
      pooler_id: poolerId,
      plantingStatus: plantingData.plantingStatus,
      successful_plants: plantingData.successfulPlants,
      failed_plants: plantingData.failedPlants,
      farmers_planted: plantingData.farmersPlanted,
      duration_ms: plantingData.duration,
      plantingStartTime: plantingData.plantingStartTime,
      plantingEndTime: plantingData.plantingEndTime,
      details: plantingData.details,
      plantedFarmers: plantingData.plantedFarmers || [],
      blockData: plantingData.blockData || {},
      timestamp: new Date().toISOString()
    };

    logger.info(`Notifying Pooler about planting completion ${JSON.stringify({
      pooler_id: poolerId,
      pooler_endpoint: pooler.api_endpoint,
      block_index: plantingData.blockIndex,
      successful_plants: plantingData.successfulPlants,
      planted_farmers_count: plantingData.plantedFarmers?.length || 0,
      has_block_data: !!(plantingData.blockData?.entropy)
    })}`);

    const response = await fetch(`${pooler.api_endpoint}/backend/planting-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Backend-ID': Config.BACKEND.ID,
        'Authorization': `Bearer ${pooler.api_key || 'dev-key'}`
      },
      body: JSON.stringify(notification)
    });

    if (response.ok) {
      const result = await response.json();
      logger.info(`Pooler notification successful ${JSON.stringify({
        pooler_id: poolerId,
        response: result
      })}`);
    } else {
      const errorText = await response.text();
      logger.warn(`Pooler notification failed ${JSON.stringify({
        pooler_id: poolerId,
        status: response.status,
        error: errorText
      })}`);
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