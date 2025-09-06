#!/usr/bin/env bun
/**
 * Parallel Block Harvester - Standalone Script
 * 
 * Harvests specific blocks in parallel and returns detailed rewards info.
 * Takes block indexes as command line arguments.
 * 
 * Usage:
 *   bun parallel-harvester.ts 77001 77002 77003 77004
 *   bun parallel-harvester.ts 77001
 * 
 * Environment Variables Required:
 *   - FARMER_PK: Farmer public key
 *   - FARMER_SK: Farmer secret key 
 *   - RPC_URL: Stellar RPC endpoint
 *   - NETWORK_PASSPHRASE: Stellar network passphrase
 *   - CONTRACT_ID: KALE contract ID
 */

import { 
  Keypair,
  scValToNative
} from "@stellar/stellar-sdk/minimal";
import { Api } from "@stellar/stellar-sdk/minimal/rpc";
import { Client } from 'kale-sc-sdk';
import { send } from './utils';
import fetch from 'node-fetch';

interface HarvestResult {
  blockIndex: number;
  success: boolean;
  reward?: bigint;
  stack?: bigint;
  txHash?: string;
  error?: string;
  duration: number;
}

interface ParallelHarvestSummary {
  totalBlocks: number;
  successfulHarvests: number;
  failedHarvests: number;
  totalReward: bigint;
  totalStack: bigint;
  results: HarvestResult[];
  totalDuration: number;
}

class ParallelHarvester {
  private contract: Client;
  private backendUrl: string;

  constructor() {
    // Validate required environment variables
    this.validateEnvironment();
    
    // Set backend URL for database updates
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // Initialize KALE contract client (same as utils.ts)
    this.contract = new Client({
      rpcUrl: Bun.env.RPC_URL!,
      contractId: Bun.env.CONTRACT_ID!,
      networkPassphrase: Bun.env.NETWORK_PASSPHRASE!,
    });
  }

  private validateEnvironment(): void {
    const required = ['FARMER_PK', 'FARMER_SK', 'RPC_URL', 'NETWORK_PASSPHRASE', 'CONTRACT_ID'];
    const missing = required.filter(env => !Bun.env[env]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  /**
   * Harvest a single block (same logic as harvest.ts)
   */
  private async harvestSingleBlock(blockIndex: number): Promise<HarvestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🥬 Starting harvest for block ${blockIndex}...`);
      
      // Use the same contract.harvest method as the working harvest.ts
      const at = await this.contract.harvest({
        farmer: Bun.env.FARMER_PK!,
        index: blockIndex
      });

      if (Api.isSimulationError(at.simulation!)) {
        // Handle known harvest errors (same as harvest.ts)
        if (
          at.simulation.error.includes('Error(Contract, #9)') || // PailMissing
          at.simulation.error.includes('Error(Contract, #10)') || // WorkMissing
          at.simulation.error.includes('Error(Contract, #11)') || // BlockMissing
          at.simulation.error.includes('Error(Contract, #14)')    // HarvestNotReady
        ) {
          throw new Error(`Block ${blockIndex} not ready for harvest: ${at.simulation.error}`);
        } else {
          throw new Error(`Harvest simulation failed: ${at.simulation.error}`);
        }
      } else {
        // Check if there's a reward to harvest
        if (at.result === BigInt(0)) {
          const duration = Date.now() - startTime;
          console.log(`⚠️ Block ${blockIndex}: No reward to harvest (${duration}ms)`);
          
          return {
            blockIndex,
            success: true,
            reward: 0n,
            stack: 0n, // We don't get stack info from harvest result currently
            duration
          };
        }

        // Send the transaction (same as harvest.ts)
        await send(at);

        const reward = at.result;
        const duration = Date.now() - startTime;
        
        console.log(`✅ Block ${blockIndex}: +${Number(reward) / 10**7} KALE reward (${duration}ms)`);
        
        return {
          blockIndex,
          success: true,
          reward,
          stack: 0n, // Harvest doesn't return stack info directly
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Block ${blockIndex}: ${String(error)} (${duration}ms)`);
      
      return {
        blockIndex,
        success: false,
        error: String(error),
        duration
      };
    }
  }

  /**
   * Save harvest result to database via backend API
   */
  private async saveHarvestResult(result: HarvestResult, farmerId: string): Promise<void> {
    try {
      const harvestData = {
        farmerId,
        blockIndex: result.blockIndex,
        rewardAmount: result.reward ? (Number(result.reward) / 10_000_000).toFixed(7) : '0.0000000', // Convert stroops to XLM
        status: result.success ? 'success' : 'failed',
        transactionHash: result.txHash || null,
        error: result.error || null,
        harvestedAt: new Date().toISOString(),
        processingTimeMs: result.duration
      };

      const response = await fetch(`${this.backendUrl}/api/harvest-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(harvestData)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`⚠️ Failed to save harvest result for block ${result.blockIndex}: ${response.status} ${errorBody}`);
      } else {
        console.log(`✅ Saved harvest result for block ${result.blockIndex} to database`);
      }
    } catch (error) {
      console.warn(`⚠️ Error saving harvest result for block ${result.blockIndex}:`, error);
    }
  }

  /**
   * Save all harvest results to database
   */
  private async saveHarvestResultsBatch(results: HarvestResult[], farmerId: string): Promise<void> {
    console.log(`💾 Saving ${results.length} harvest results to database...`);
    
    // Save results in parallel (but don't fail if some saves fail)
    const savePromises = results.map(result => this.saveHarvestResult(result, farmerId));
    await Promise.allSettled(savePromises);
    
    console.log(`💾 Finished saving harvest results to database`);
  }

  /**
   * Harvest multiple blocks in parallel
   */
  async harvestBlocks(blockIndexes: number[]): Promise<ParallelHarvestSummary> {
    const startTime = Date.now();
    
    console.log(`🚀 Starting parallel harvest of ${blockIndexes.length} blocks...`);
    console.log(`📦 Blocks: ${blockIndexes.join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Execute all harvests in parallel
    const harvestPromises = blockIndexes.map(blockIndex => 
      this.harvestSingleBlock(blockIndex)
    );
    
    const results = await Promise.all(harvestPromises);
    
    // Calculate summary
    const totalDuration = Date.now() - startTime;
    const successfulHarvests = results.filter(r => r.success).length;
    const failedHarvests = results.length - successfulHarvests;
    
    const totalReward = results.reduce((sum, r) => sum + (r.reward || 0n), 0n);
    const totalStack = results.reduce((sum, r) => sum + (r.stack || 0n), 0n);
    
    // Save harvest results to database
    const farmerId = process.env.FARMER_ID;
    if (farmerId) {
      await this.saveHarvestResultsBatch(results, farmerId);
    } else {
      console.warn('⚠️ FARMER_ID not set - skipping database save');
    }
    
    return {
      totalBlocks: blockIndexes.length,
      successfulHarvests,
      failedHarvests,
      totalReward,
      totalStack,
      results,
      totalDuration
    };
  }

  /**
   * Print detailed harvest summary
   */
  printSummary(summary: ParallelHarvestSummary): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 PARALLEL HARVEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Overall stats
    console.log(`📊 Total Blocks: ${summary.totalBlocks}`);
    console.log(`✅ Successful: ${summary.successfulHarvests}`);
    console.log(`❌ Failed: ${summary.failedHarvests}`);
    console.log(`⏱️ Total Time: ${summary.totalDuration}ms`);
    console.log(`⚡ Avg Time per Block: ${Math.round(summary.totalDuration / summary.totalBlocks)}ms`);
    console.log('');
    
    // Rewards summary
    console.log(`💰 Total Reward: ${Number(summary.totalReward) / 10**7} KALE`);
    console.log(`📈 Total Stack: ${Number(summary.totalStack) / 10**7} KALE`);
    console.log(`🎯 Combined Total: ${Number(summary.totalReward + summary.totalStack) / 10**7} KALE`);
    console.log('');
    
    // Individual block results
    if (summary.successfulHarvests > 0) {
      console.log('📦 SUCCESSFUL HARVESTS:');
      summary.results
        .filter(r => r.success)
        .forEach(result => {
          const reward = Number(result.reward || 0n) / 10**7;
          const stack = Number(result.stack || 0n) / 10**7;
          const total = reward + stack;
          console.log(`   Block ${result.blockIndex}: ${reward.toFixed(4)} reward + ${stack.toFixed(4)} stack = ${total.toFixed(4)} KALE (${result.duration}ms)`);
        });
      console.log('');
    }
    
    if (summary.failedHarvests > 0) {
      console.log('❌ FAILED HARVESTS:');
      summary.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`   Block ${result.blockIndex}: ${result.error} (${result.duration}ms)`);
        });
      console.log('');
    }
    
    // Success rate
    const successRate = (summary.successfulHarvests / summary.totalBlocks * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (summary.successfulHarvests > 0) {
      const avgReward = Number(summary.totalReward) / 10**7 / summary.successfulHarvests;
      const avgStack = Number(summary.totalStack) / 10**7 / summary.successfulHarvests;
      console.log(`📊 Avg Reward per Block: ${avgReward.toFixed(4)} KALE`);
      console.log(`📊 Avg Stack per Block: ${avgStack.toFixed(4)} KALE`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: bun parallel-harvester.ts <block1> <block2> <block3> ...');
    console.error('   Example: bun parallel-harvester.ts 77001 77002 77003');
    process.exit(1);
  }
  
  // Parse block indexes
  const blockIndexes: number[] = [];
  for (const arg of args) {
    const blockIndex = parseInt(arg);
    if (isNaN(blockIndex)) {
      console.error(`❌ Invalid block index: ${arg}`);
      process.exit(1);
    }
    blockIndexes.push(blockIndex);
  }
  
  // Remove duplicates and sort
  const uniqueBlocks = [...new Set(blockIndexes)].sort((a, b) => a - b);
  
  try {
    const harvester = new ParallelHarvester();
    const summary = await harvester.harvestBlocks(uniqueBlocks);
    harvester.printSummary(summary);
    
    // Exit with appropriate code
    process.exit(summary.failedHarvests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`❌ Fatal error: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { ParallelHarvester, type HarvestResult, type ParallelHarvestSummary };
