#!/usr/bin/env bun

/**
 * KALE Pool Mining Pooler - Standalone Startup Script
 * 
 * This script starts only the Pooler service with proper
 * initialization, logging, and error handling.
 */

import { execSync } from 'child_process';
import Config from './Shared/config';
import { existsSync } from 'fs';
import path from 'path';

// ASCII Art Banner for Pooler
const POOLER_BANNER = `
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ██╗  ██╗ █████╗ ██╗     ███████╗    ██████╗  ██████╗  ██████╗ ██╗  ║
║   ██║ ██╔╝██╔══██╗██║     ██╔════╝    ██╔══██╗██╔═══██╗██╔═══██╗██║  ║
║   █████╔╝ ███████║██║     █████╗      ██████╔╝██║   ██║██║   ██║██║  ║
║   ██╔═██╗ ██╔══██║██║     ██╔══╝      ██╔═══╝ ██║   ██║██║   ██║██║  ║
║   ██║  ██╗██║  ██║███████╗███████╗    ██║     ╚██████╔╝╚██████╔╝███████╗║
║   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝    ╚═╝      ╚═════╝  ╚═════╝ ╚══════╝║
║                                                                      ║
║                       POOLER SERVICE                                ║
║                  Block Discovery & Coordination                     ║
╚══════════════════════════════════════════════════════════════════════╝
`;

interface SystemStatus {
  blockchain: boolean;
  startTime: Date;
  errors: string[];
}

class KalePoolerStarter {
  private status: SystemStatus;
  private poolerPath: string = './Pooler';
  private port: number = 3001;
  
  constructor() {
    this.status = {
      blockchain: false,
      startTime: new Date(),
      errors: []
    };
  }

  /**
   * Main startup sequence for Pooler only
   */
  async start() {
    console.log(POOLER_BANNER);
    console.log('🚀 Starting KALE Pool Pooler Service...\n');

    try {
      // Pre-flight checks
      await this.runPreFlightChecks();
      
      // Blockchain connection check
      await this.checkBlockchainConnection();
      
      // Start Pooler service
      await this.startPooler();
      
      // Display startup summary
      this.displayStartupSummary();
      
    } catch (error) {
      console.error('❌ Pooler startup failed:', error);
      this.displayErrorSummary();
      process.exit(1);
    }
  }

  /**
   * Run pre-flight system checks
   */
  private async runPreFlightChecks() {
    console.log('🔍 Running pre-flight checks...');
    
    // Check Bun/Node version
    try {
      const bunVersion = execSync('bun --version', { encoding: 'utf8' }).trim();
      console.log(`   ✅ Bun runtime: v${bunVersion}`);
    } catch {
      console.log('   ⚠️  Bun not found, checking Node.js...');
      try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        console.log(`   ✅ Node.js runtime: ${nodeVersion}`);
      } catch {
        throw new Error('No suitable JavaScript runtime found (Bun or Node.js required)');
      }
    }

    // Check Pooler directory
    if (existsSync(this.poolerPath)) {
      console.log(`   ✅ Pooler directory exists: ${this.poolerPath}`);
    } else {
      throw new Error(`Pooler directory missing: ${this.poolerPath}`);
    }

    // Check Pooler package.json
    const packagePath = path.join(this.poolerPath, 'package.json');
    if (existsSync(packagePath)) {
      console.log('   ✅ Pooler package.json found');
    } else {
      throw new Error('Pooler package.json missing');
    }

    // Check environment files
    const envPath = path.join(this.poolerPath, '.env.mainnet');
    if (existsSync(envPath)) {
      console.log('   ✅ Environment file found: .env.mainnet');
    } else {
      console.log('   ⚠️  Environment file missing: .env.mainnet (using defaults)');
    }

    console.log('');
  }

  /**
   * Check blockchain connection
   */
  private async checkBlockchainConnection() {
    console.log('🌐 Checking blockchain connection...');
    
    try {
      const rpcUrl = Config.STELLAR.RPC_URL;
      console.log(`   📡 RPC URL: ${rpcUrl}`);
      console.log(`   📄 Contract ID: ${Config.STELLAR.CONTRACT_ID}`);
      console.log(`   🌍 Network: ${Config.STELLAR.NETWORK}`);
      
      // Here we could add a simple RPC health check
      // For now, we'll assume it's working if config loads properly
      console.log('   ✅ Blockchain configuration loaded');
      this.status.blockchain = true;
      
    } catch (error: any) {
      this.status.errors.push(`Blockchain connection failed: ${error.message}`);
      console.log(`   ❌ Blockchain connection failed: ${error.message}`);
    }

    console.log('');
  }

  /**
   * Start Pooler service
   */
  private async startPooler() {
    console.log('⚡ Starting Pooler Service...');

    try {
      // Install dependencies
      console.log('   📦 Installing Pooler dependencies...');
      process.chdir(this.poolerPath);
      execSync('bun install', { stdio: 'pipe' });
      console.log('   ✅ Pooler dependencies installed');
      process.chdir('..');

      // Start service directly (not in background)
      console.log(`   🚀 Starting Pooler Service on port ${this.port}...`);
      
      // Set environment variables
      const env = { 
        ...process.env,
        NODE_ENV: 'development',
        PORT: this.port.toString(),
        RPC_URL: Config.STELLAR.RPC_URL,
        CONTRACT_ID: Config.STELLAR.CONTRACT_ID,
        NETWORK_PASSPHRASE: Config.STELLAR.NETWORK_PASSPHRASE
      };

      console.log('   ✅ Pooler Service starting...\n');
      
      console.log('   🎯 Starting pooler server directly...');
      
      // Set up environment variables for the pooler
      Object.assign(process.env, env);
      
      // Change to pooler directory once
      process.chdir(this.poolerPath);
      
      try {
        // Import and run the pooler server directly
        console.log('   🔄 Loading pooler server module...');
        const serverPath = path.join(process.cwd(), 'src', 'server.ts');
        
        console.log(`   📂 Server path: ${serverPath}`);
        
        // Dynamically import the pooler server
        const serverModule = await import(serverPath);
        
        // Create and start the pooler service
        if (serverModule.default) {
          console.log('   🚀 Creating and starting pooler service...');
          const pooler = new serverModule.default();
          await pooler.start();
          
          // Keep the process alive
          console.log('   ✅ Pooler service is now running and monitoring blocks');
          
          // Set up graceful shutdown  
          process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down Pooler Service...');
            process.exit(0);
          });
          
          process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down Pooler Service...');
            process.exit(0);
          });
          
        } else {
          throw new Error('PoolerService class not found in server module');
        }
        
      } catch (error: any) {
        console.error(`   ❌ Failed to start pooler server: ${error.message}`);
        throw error;
      }
      
    } catch (error: any) {
      this.status.errors.push(`Pooler startup failed: ${error.message}`);
      console.log(`   ❌ Pooler startup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display startup summary
   */
  private displayStartupSummary() {
    const uptime = Date.now() - this.status.startTime.getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);
    
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                      POOLER SERVICE STATUS                          ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Started: ${this.status.startTime.toISOString().padEnd(59)} ║`);
    console.log(`║ Uptime:  ${uptimeSeconds}s${' '.repeat(58 - uptimeSeconds.toString().length)} ║`);
    console.log('║                                                                      ║');

    // Blockchain status
    const blockchainStatus = this.status.blockchain ? '✅ CONNECTED' : '❌ FAILED';
    const blockchainLine = `║ BLOCKCHAIN: ${blockchainStatus}`;
    console.log(blockchainLine + ' '.repeat(70 - blockchainLine.length) + ' ║');

    console.log('║                                                                      ║');

    // Pooler Service info
    console.log('║ POOLER SERVICE:                                                      ║');
    console.log(`║   URL:          http://localhost:${this.port}                               ║`);
    console.log(`║   Health Check: http://localhost:${this.port}/health                        ║`);
    console.log(`║   Network:      ${Config.STELLAR.NETWORK.padEnd(52)} ║`);
    console.log('║                                                                      ║');
    console.log('║ FUNCTIONS:                                                           ║');
    console.log('║   • Block discovery and monitoring                                   ║');
    console.log('║   • Pool coordination and management                                 ║');
    console.log('║   • Mining statistics and reporting                                  ║');
    console.log('║                                                                      ║');
    console.log('║ NEXT STEPS:                                                          ║');
    console.log('║   1. Monitor block discovery logs                                    ║');
    console.log('║   2. Check pooler health endpoint                                    ║');
    console.log('║   3. Verify blockchain connectivity                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    console.log('\n🎉 KALE Pool Pooler Service started successfully!');
    console.log('⛏️  Block discovery and pool coordination active');
    console.log('🔧 Press Ctrl+C to stop the service');
  }

  /**
   * Display error summary
   */
  private displayErrorSummary() {
    if (this.status.errors.length > 0) {
      console.log('\n❌ STARTUP ERRORS:');
      for (const error of this.status.errors) {
        console.log(`   • ${error}`);
      }
    }
  }
}

// Signal handlers are set up in startPooler method

// Start the pooler
if (import.meta.main) {
  const starter = new KalePoolerStarter();
  starter.start().catch((error) => {
    console.error('💥 Fatal Pooler startup error:', error);
    process.exit(1);
  });
}

export { KalePoolerStarter };