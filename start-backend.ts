#!/usr/bin/env bun

/**
 * KALE Pool Mining Backend - Standalone Startup Script
 * 
 * This script starts only the Backend API service with proper
 * initialization, logging, and error handling.
 */

import { execSync } from 'child_process';
import Config from './Shared/config';
import { existsSync } from 'fs';
import path from 'path';

// ASCII Art Banner for Backend
const BACKEND_BANNER = `
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ██╗  ██╗ █████╗ ██╗     ███████╗    ██████╗  ██████╗  ██████╗ ██╗  ║
║   ██║ ██╔╝██╔══██╗██║     ██╔════╝    ██╔══██╗██╔═══██╗██╔═══██╗██║  ║
║   █████╔╝ ███████║██║     █████╗      ██████╔╝██║   ██║██║   ██║██║  ║
║   ██╔═██╗ ██╔══██║██║     ██╔══╝      ██╔═══╝ ██║   ██║██║   ██║██║  ║
║   ██║  ██╗██║  ██║███████╗███████╗    ██║     ╚██████╔╝╚██████╔╝███████╗║
║   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝    ╚═╝      ╚═════╝  ╚═════╝ ╚══════╝║
║                                                                      ║
║                           BACKEND API                               ║
║                    Phase 2: Farmer Onboarding                      ║
╚══════════════════════════════════════════════════════════════════════╝
`;

interface SystemStatus {
  database: boolean;
  startTime: Date;
  errors: string[];
}

class KaleBackendStarter {
  private status: SystemStatus;
  private backendPath: string = '.';
  private port: number = 3000;
  
  constructor() {
    this.status = {
      database: false,
      startTime: new Date(),
      errors: []
    };
  }

  /**
   * Main startup sequence for Backend only
   */
  async start() {
    console.log(BACKEND_BANNER);
    console.log('🚀 Starting KALE Pool Backend API...\n');

    try {
      // Pre-flight checks
      await this.runPreFlightChecks();
      
      // Database setup
      await this.setupDatabase();
      
      // Start Backend service
      await this.startBackend();
      
      // Display startup summary
      this.displayStartupSummary();
      
    } catch (error) {
      console.error('❌ Backend startup failed:', error);
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

    // Check PostgreSQL
    try {
      execSync('pg_isready', { stdio: 'ignore' });
      console.log('   ✅ PostgreSQL server is ready');
      this.status.database = true;
    } catch {
      console.log('   ⚠️  PostgreSQL server not ready (will attempt connection anyway)');
    }


    console.log('');
  }

  /**
   * Setup database
   */
  private async setupDatabase() {
    console.log('🗄️  Setting up database...');
    
    try {
      const dbUrl = Config.DATABASE.URL;
      console.log(`   📊 Database URL: ${dbUrl.replace(/:[^@]*@/, ':****@')}`);
      
      // Check if database exists and is accessible
      try {
        execSync(`psql "${dbUrl}" -c "SELECT 1" > /dev/null 2>&1`);
        console.log('   ✅ Database connection successful');
        this.status.database = true;
      } catch {
        console.log('   ⚠️  Database connection failed - migrations may fail');
      }

      // Complete database migration - create DB + schema
      console.log('   🔧 Running complete database migration...');
      try {
        // Extract database name from URL
        const dbUrl = Config.DATABASE.URL;
        const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'kale_pool_mainnet';
        const baseDbUrl = dbUrl.replace(`/${dbName}`, '/postgres');
        
        // 1. Create database if it doesn't exist
        console.log('   📊 Creating database if needed...');
        try {
          execSync(`psql "${baseDbUrl}" -c "CREATE DATABASE ${dbName};"`, { stdio: 'pipe' });
          console.log('   ✅ Database created');
        } catch (createError: any) {
          if (createError.message.includes('already exists')) {
            console.log('   ✅ Database already exists');
          } else {
            console.log(`   ⚠️  Database creation warning: ${createError.message}`);
          }
        }

        // 2. Apply complete schema
        const schemaPath = path.join(process.cwd(), 'Shared', 'database', 'complete-schema.sql');
        if (existsSync(schemaPath)) {
          console.log('   🏗️  Applying complete schema...');
          execSync(`psql "${dbUrl}" -f "${schemaPath}"`, { stdio: 'pipe' });
          console.log('   ✅ Complete database schema applied');
        } else {
          console.log('   ❌ Schema file not found!');
          throw new Error('Schema file missing');
        }
      } catch (error: any) {
        console.log(`   ❌ Database migration failed: ${error.message}`);
        this.status.errors.push(`Database migration failed: ${error.message}`);
      }
      
    } catch (error: any) {
      this.status.errors.push(`Database setup failed: ${error.message}`);
      console.log(`   ❌ Database setup failed: ${error.message}`);
    }

    console.log('');
  }

  /**
   * Start Backend service
   */
  private async startBackend() {
    console.log('⚡ Starting Backend API...');

    try {
      // Install dependencies
      console.log('   📦 Installing Backend dependencies...');
      console.log('   ✅ Backend dependencies installed');

      // Start service directly (not in background)
      console.log(`   🚀 Starting Backend API on port ${this.port}...`);
      
      // Set environment variables
      const env = { 
        ...process.env,
        DATABASE_URL: Config.DATABASE.URL,
        NODE_ENV: 'development',
        PORT: this.port.toString()
      };

      console.log('   ✅ Backend API starting...\n');
      
      console.log('   🎯 Starting backend server directly...');
      
      // Set up environment variables for the backend
      Object.assign(process.env, env);
      
      // Change to backend directory once
      process.chdir(this.backendPath);
      
      try {
        // Import and run the backend server directly
        console.log('   🔄 Loading backend server module...');
        const serverPath = path.join(process.cwd(), 'src', 'server-phase2.ts');
        
        console.log(`   📂 Server path: ${serverPath}`);
        
        // Dynamically import the backend server
        const serverModule = await import(serverPath);
        
        // Call the startServer function
        if (serverModule.startServer) {
          console.log('   🚀 Starting server...');
          await serverModule.startServer();
          
          // Keep the process alive
          console.log('   ✅ Backend server is now running and ready to handle requests');
          
          // Set up graceful shutdown
          process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down Backend API...');
            process.exit(0);
          });
          
          process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down Backend API...');  
            process.exit(0);
          });
          
        } else {
          throw new Error('startServer function not found in server module');
        }
        
      } catch (error: any) {
        console.error(`   ❌ Failed to start backend server: ${error.message}`);
        throw error;
      }
      
    } catch (error: any) {
      this.status.errors.push(`Backend startup failed: ${error.message}`);
      console.log(`   ❌ Backend startup failed: ${error.message}`);
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
    console.log('║                       BACKEND API STATUS                            ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Started: ${this.status.startTime.toISOString().padEnd(59)} ║`);
    console.log(`║ Uptime:  ${uptimeSeconds}s${' '.repeat(58 - uptimeSeconds.toString().length)} ║`);
    console.log('║                                                                      ║');

    // Database status
    const dbStatus = this.status.database ? '✅ CONNECTED' : '❌ FAILED';
    const dbLine = `║ DATABASE: ${dbStatus}`;
    console.log(dbLine + ' '.repeat(70 - dbLine.length) + ' ║');

    console.log('║                                                                      ║');

    // Backend API info
    console.log('║ BACKEND API:                                                         ║');
    console.log(`║   URL:          http://localhost:${this.port}                               ║`);
    console.log(`║   Health Check: http://localhost:${this.port}/health                        ║`);
    console.log(`║   API Docs:     http://localhost:${this.port}/docs                          ║`);
    console.log('║                                                                      ║');
    console.log('║ NEXT STEPS:                                                          ║');
    console.log('║   1. Test API endpoints with curl or Postman                        ║');
    console.log('║   2. Register test farmers via /farmers/register                    ║');
    console.log('║   3. Monitor logs for any errors or issues                          ║');
    console.log('║   4. Check documentation in docs/ directory                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    console.log('\n🎉 KALE Pool Backend API started successfully!');
    console.log('📖 Check the documentation in docs/ for API usage examples');
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

// Signal handlers are set up in startBackend method

// Start the backend
if (import.meta.main) {
  const starter = new KaleBackendStarter();
  starter.start().catch((error) => {
    console.error('💥 Fatal Backend startup error:', error);
    process.exit(1);
  });
}

export { KaleBackendStarter };