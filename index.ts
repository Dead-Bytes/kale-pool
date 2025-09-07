// Entry point for KALE Pool Mining Backend
// Phase 1: Server startup and initialization

import { startServer } from './src/server';
import { initializeDatabase } from './src/services/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ======================
// APPLICATION STARTUP
// ======================

async function main(): Promise<void> {
  try {
    console.log('🥬 Starting KALE Pool Mining Backend...');
    
    // Initialize database
    console.log('📦 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // Start API server
    console.log('🚀 Starting API server...');
    await startServer();
    console.log('✅ KALE Pool Mining Backend started successfully');
    
  } catch (error) {
    console.error('❌ Failed to start KALE Pool Mining Backend:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('❌ Unhandled error during startup:', error);
  process.exit(1);
});
