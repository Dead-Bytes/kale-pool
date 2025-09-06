import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Leaf, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Users,
  Settings,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Calendar,
  Wallet,
  Activity
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useUserStatus, useCurrentFarmer, useFarmerPlantings, useFarmerHarvests, useExitContract, useFarmerActiveContract } from '@/hooks/use-api';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Interfaces for type safety
interface PoolData {
  poolInfo: {
    poolerId: string;
    poolerName: string;
    joinedAt: string;
    status: string;
    contractAddress?: string;
  };
  stake: {
    currentStake: number;
    stakePercentage: number;
    totalPoolStake: number;
    minStake: number;
    maxStake: number;
  };
  contractTerms: {
    rewardSplit: number;
    platformFee: number;
    exitDelay: number;
    created_by: string;
  };
  rewards: {
    totalEarned: number;
    pendingRewards: number;
    lastHarvest: string | null;
    nextHarvest: string | null;
    harvestInterval: number;
  };
  performance: {
    successRate: number;
    blocksParticipated: number;
    avgRewardPerBlock: number;
    totalBlocks: number;
    uptime: number;
  };
  poolStats: {
    totalFarmers: number;
    activeFarmers: number;
    poolSuccessRate: number;
    avgBlockTime: number;
    totalRewardsDistributed: number;
  };
}

interface EarningsHistory {
  date: string;
  amount: number;
  blocks: number;
  status: string;
}

interface RecentActivity {
  timestamp: string;
  type: string;
  description: string;
  status: string;
  amount: number;
}

export default function MyPool() {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [earningsHistory, setEarningsHistory] = useState<EarningsHistory[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitRewards, setExitRewards] = useState<any>(null);

  // Get user ID and token from localStorage
  const userId = localStorage.getItem('kale-pool-user-id');
  const token = localStorage.getItem('kale-pool-token');
  const { toast } = useToast();
  
  // Fetch user status and farmer data
  const { data: userStatus, isLoading: userStatusLoading, error: userStatusError } = useUserStatus(userId || '');
  const { data: farmerData, isLoading: farmerLoading, error: farmerError } = useCurrentFarmer();
  
  // Exit contract functionality
  const exitContractMutation = useExitContract({
    onSuccess: (data) => {
      console.log('Exit contract success:', data);
      setExitRewards(data.finalRewards);
      setShowExitDialog(false);
      
      const rewards = data.finalRewards;
      const totalRewards = (rewards?.totalRewards || 0) + (rewards?.pendingStakeAmount || 0);
      const rewardCount = (rewards?.successfulHarvests || 0) + (rewards?.successfulPlantings || 0);
      
      toast({
        title: "🎉 Pool Exit Requested Successfully!",
        description: (
          <div className="space-y-2">
            <p>Your exit request has been submitted. Contract status: <strong>"exiting"</strong></p>
            <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
              <p className="font-semibold text-green-800">🥬 KALE Rewards on the way:</p>
              <p className="text-sm text-green-700">
                • Total Rewards: <strong>{totalRewards.toFixed(4)} KALE</strong>
              </p>
              <p className="text-sm text-green-700">
                • Reward Count: <strong>{rewardCount} operations</strong>
              </p>
              <p className="text-xs text-green-600 mt-1">
                ⏱️ Available after {data.exitDelay || 24} hour delay period
              </p>
            </div>
          </div>
        ),
        duration: 8000, // Show for 8 seconds since there's more info
      });
    },
    onError: (error) => {
      console.error('Exit contract failed:', error);
      toast({
        title: "Exit Failed", 
        description: error.message || "Failed to exit pool. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Fetch plantings and harvests for recent activity
  const { data: plantingsData, isLoading: plantingsLoading } = useFarmerPlantings();
  const { data: harvestsData, isLoading: harvestsLoading } = useFarmerHarvests();

  // Process data when available
  useEffect(() => {
    if (farmerData?.farmer && farmerData?.active_contract) {
      const farmer = farmerData.farmer;
      const contract = farmerData.active_contract;
      
      if (contract) {
        setPoolData({
          poolInfo: {
            poolerId: contract.id,
            poolerName: contract.contract_terms.pooler_name || "KALE Pool",
            joinedAt: farmer.joined_pool_at || contract.created_at,
            status: contract.status,
            contractAddress: contract.id
          },
          stake: {
            currentStake: parseFloat(farmer.current_balance || '0'),
            stakePercentage: parseFloat(contract.stake_percentage || farmer.stake_percentage || '0'),
            totalPoolStake: 0, // Will be available in pool stats
            minStake: 0, // Not available in current API
            maxStake: 100000 // Not available in current API
          },
          rewards: {
            totalEarned: 0, // Will be tracked in separate rewards endpoint
            pendingRewards: 0, // Will be tracked in separate rewards endpoint
            lastHarvest: null,
            nextHarvest: null,
            harvestInterval: contract.harvest_interval || 20
          },
          performance: {
            successRate: 100, // Initial value, will be updated with actual performance
            blocksParticipated: 0,
            avgRewardPerBlock: 0,
            totalBlocks: 0,
            uptime: 100 // Initial value, will be tracked
          },
          poolStats: {
            totalFarmers: 0, // Will be available in pool stats
            activeFarmers: 0, // Will be available in pool stats
            poolSuccessRate: 95.0,
            avgBlockTime: 12.5,
            totalRewardsDistributed: 0
          },
          contractTerms: {
            rewardSplit: parseFloat(contract.reward_split || '0.05'),
            platformFee: parseFloat(contract.platform_fee || '0.05'),
            exitDelay: contract.contract_terms?.exit_delay || 24,
            created_by: contract.contract_terms?.created_by || 'farmer_request'
          }
        });
      }
    }
  }, [farmerData]);

  // Populate recent activity with plantings and harvests data
  useEffect(() => {
    const activities: RecentActivity[] = [];
    
    // Add plantings to activity
    if (plantingsData?.plantings) {
      plantingsData.plantings.slice(0, 5).forEach((planting: any) => {
        if (planting.plantedAt) {
          activities.push({
            timestamp: planting.plantedAt,
            type: 'plant',
            description: `Staked ${planting.stakeAmount || '0'} XLM to Pooler ${planting.poolerId?.substring(0, 8) || 'Unknown'}...`,
            status: planting.status || 'unknown',
            amount: 0 // Plantings don't have earnings amount
          });
        }
      });
    }
    
    // Add harvests to activity
    if (harvestsData?.harvests) {
      harvestsData.harvests.slice(0, 5).forEach((harvest: any) => {
        if (harvest.harvestedAt) {
          activities.push({
            timestamp: harvest.harvestedAt,
            type: 'harvest',
            description: `Harvested from Block #${harvest.blockIndex || 'Unknown'}`,
            status: harvest.status || 'unknown',
            amount: parseFloat(harvest.amount || '0')
          });
        }
      });
    }
    
    // Sort by timestamp (newest first) and limit to 10 items
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setRecentActivity(activities.slice(0, 10));
  }, [plantingsData, harvestsData]);

  const handleRefresh = () => {
    setIsLoading(true);
    // The hooks will automatically refetch when dependencies change
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleExportEarnings = () => {
    console.log('Exporting earnings data...');
  };

  const handleExitPool = () => {
    const contractId = poolData?.poolInfo.contractAddress || farmerData?.active_contract?.id;
    if (contractId) {
      exitContractMutation.mutate(contractId);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'harvest':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'work':
        return <BarChart3 className="w-4 h-4 text-primary" />;
      case 'plant':
        return <Leaf className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
      case 'completed':
        return <Badge variant="default" className="bg-success">Active</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Show authentication required message
  if (!token) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <Wallet className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">
            You need to register as a farmer to view your pool information.
          </p>
          <Button asChild>
            <Link to="/auth/signup">Register as Farmer</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (userStatusLoading || farmerLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (userStatusError || farmerError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load pool data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show no pool message if user is not in a pool
  if (!poolData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Pool</h1>
            <p className="text-muted-foreground mt-1">
              Monitor your pool membership and earnings
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Pool</h3>
            <p className="text-muted-foreground mb-4">
              You are not currently part of any pool. Join a pool to start earning rewards.
            </p>
            <Button onClick={() => window.location.href = '/farmer/pools'}>
              Browse Pools
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Pool</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your pool membership and earnings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={handleExportEarnings}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Active Contract Details */}
      {poolData?.contractTerms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Contract Terms
            </CardTitle>
            <CardDescription>Your active pool contract details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Reward Split</span>
                <span className="text-xl font-semibold">{(poolData.contractTerms.rewardSplit * 100).toFixed(1)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Platform Fee</span>
                <span className="text-xl font-semibold">{(poolData.contractTerms.platformFee * 100).toFixed(1)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Exit Delay</span>
                <span className="text-xl font-semibold">{poolData.contractTerms.exitDelay} hours</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Created By</span>
                <span className="text-xl font-semibold capitalize">{poolData.contractTerms.created_by.replace('_', ' ')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pool Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Stake</p>
                <p className="text-2xl font-bold">{poolData?.stake.currentStake.toLocaleString() || '0'}</p>
              </div>
              <Leaf className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">{poolData?.rewards.totalEarned.toLocaleString() || '0'}</p>
              </div>
              <DollarSign className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{poolData?.performance.successRate.toFixed(1) || '0'}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Rewards</p>
                <p className="text-2xl font-bold">{poolData?.rewards.pendingRewards.toLocaleString() || '0'}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Pool Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pool Name</span>
                <span className="font-medium">{poolData?.poolInfo.poolerName || 'Unknown Pool'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(poolData?.poolInfo.status || 'inactive')}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Joined</span>
                <span className="text-sm">
                  {poolData?.poolInfo.joinedAt ? new Date(poolData.poolInfo.joinedAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Contract</span>
                <span className="text-sm font-mono text-muted-foreground">
                  {poolData?.poolInfo.contractAddress ? poolData.poolInfo.contractAddress.substring(0, 10) + '...' : 'Unknown'}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Stake Percentage</span>
                <span className="font-medium">{poolData ? (poolData.stake.stakePercentage * 100).toFixed(1) : '0'}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Harvest Interval</span>
                <span className="text-sm">{poolData?.rewards.harvestInterval || 0} hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Next Harvest</span>
                <span className="text-sm">
                  {poolData?.rewards.nextHarvest ? new Date(poolData.rewards.nextHarvest).toLocaleString() : 'Not available'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Harvest</span>
                <span className="text-sm">
                  {poolData?.rewards.lastHarvest ? new Date(poolData.rewards.lastHarvest).toLocaleString() : 'Not available'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="font-bold">{poolData?.performance.successRate.toFixed(1) || '0'}%</span>
                </div>
                <Progress value={poolData?.performance.successRate || 0} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Blocks Participated</span>
                  <span className="font-bold">{poolData?.performance.blocksParticipated || 0}</span>
                </div>
                <Progress 
                  value={poolData ? (poolData.performance.blocksParticipated / Math.max(poolData.performance.totalBlocks, 1)) * 100 : 0} 
                  className="h-2" 
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avg Reward/Block</span>
                  <span className="font-bold">{poolData?.performance.avgRewardPerBlock.toFixed(2) || '0'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="font-bold">{poolData?.performance.uptime.toFixed(1) || '0'}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pool Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Farmers</span>
                  <span className="font-bold">{poolData?.poolStats.totalFarmers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Farmers</span>
                  <span className="font-bold">{poolData?.poolStats.activeFarmers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pool Success Rate</span>
                  <span className="font-bold">{poolData?.poolStats.poolSuccessRate.toFixed(1) || '0'}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avg Block Time</span>
                  <span className="font-bold">{poolData?.poolStats.avgBlockTime.toFixed(1) || '0'}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Rewards</span>
                  <span className="font-bold">{poolData?.poolStats.totalRewardsDistributed.toLocaleString() || '0'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>
                Track your earnings over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {earningsHistory.map((earning, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {new Date(earning.date).toLocaleDateString()}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {earning.blocks} blocks processed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">+{earning.amount.toLocaleString()}</p>
                      <Badge variant="outline" className="text-xs">
                        {earning.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest pool activities and transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plantingsLoading || harvestsLoading ? (
                  // Loading state
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length > 0 ? (
                  // Show actual activity data
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium capitalize">{activity.type}</h3>
                        <p className="text-sm text-muted-foreground">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {activity.amount > 0 && (
                          <p className="font-bold text-success">+{activity.amount.toLocaleString()}</p>
                        )}
                        {getStatusBadge(activity.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  // Empty state
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
                    <p className="text-muted-foreground">
                      Your pool activities will appear here once you start farming.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pool Settings</CardTitle>
              <CardDescription>
                Manage your pool membership and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Stake Management</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adjust your stake percentage and harvest intervals
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      Adjust Stake
                    </Button>
                    <Button variant="outline" size="sm">
                      Change Harvest Interval
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Notifications</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure how you receive updates about your pool activity
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      Email Settings
                    </Button>
                    <Button variant="outline" size="sm">
                      Alert Preferences
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg border-destructive/20">
                  <h3 className="font-medium mb-2 text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Exit your pool contract and receive your final rewards
                  </p>
                  
                  <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={!poolData?.poolInfo.contractAddress && !farmerData?.active_contract?.id}>
                        Exit Pool
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Exit Pool Contract</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to exit the pool? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-medium mb-3 text-blue-800">🥬 Expected KALE Rewards Summary</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">Total KALE Rewards:</span>
                              <span className="font-medium text-blue-900">
                                {farmerData?.farmer?.current_balance ? 
                                  parseFloat(farmerData.farmer.current_balance).toFixed(4) : '0.0000'} KALE
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Successful Harvests:</span>
                              <span className="font-medium text-blue-900">
                                {exitRewards?.successfulHarvests || 'Loading...'} operations
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Successful Plantings:</span>
                              <span className="font-medium text-blue-900">
                                {exitRewards?.successfulPlantings || 'Loading...'} operations
                              </span>
                            </div>
                            <hr className="my-2 border-blue-200" />
                            <div className="flex justify-between font-medium">
                              <span className="text-blue-700">Exit Delay:</span>
                              <span className="font-medium text-blue-900">
                                {farmerData?.active_contract?.contract_terms?.exit_delay || 24} hours
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <p>• You will receive your final KALE rewards after the {poolData?.contractTerms.exitDelay || 24} hour exit delay</p>
                          <p>• All your earned KALE rewards will be transferred to your wallet</p>
                          <p>• You will no longer participate in pool mining activities</p>
                        </div>
                      </div>
                      
                      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                        <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleExitPool}
                          disabled={exitContractMutation.isPending}
                        >
                          {exitContractMutation.isPending ? 'Processing...' : 'Confirm Exit'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
