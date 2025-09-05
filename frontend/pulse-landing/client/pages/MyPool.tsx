import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useUserStatus, useCurrentFarmer } from '@/hooks/use-api';
import { Link } from 'react-router-dom';

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

  // Get user ID and token from localStorage
  const userId = localStorage.getItem('kale-pool-user-id');
  const token = localStorage.getItem('kale-pool-token');
  
  // Fetch user status and farmer data
  const { data: userStatus, isLoading: userStatusLoading, error: userStatusError } = useUserStatus(userId || '');
  const { data: farmerData, isLoading: farmerLoading, error: farmerError } = useCurrentFarmer();

  // Process data when available
  useEffect(() => {
    if (farmerData?.farmer) {
      const farmer = farmerData.farmer;
      const contract = farmer.contract;
      
      if (contract) {
        setPoolData({
          poolInfo: {
            poolerId: contract.poolerId,
            poolerName: contract.poolerName,
            joinedAt: contract.joinedAt,
            status: contract.status,
            contractAddress: contract.id
          },
          stake: {
            currentStake: parseFloat(farmer.current.balanceHuman || '0'),
            stakePercentage: contract.stakePercentage,
            totalPoolStake: parseFloat(farmer.lifetime.totalStakedHuman || '0'),
            minStake: 0, // Not available in current API
            maxStake: 100000 // Not available in current API
          },
          rewards: {
            totalEarned: parseFloat(farmer.lifetime.totalRewardsHuman || '0'),
            pendingRewards: parseFloat(farmer.current.lastRewardAmountHuman || '0'),
            lastHarvest: farmer.current.lastRewardBlock ? new Date().toISOString() : null,
            nextHarvest: null, // Not available in current API
            harvestInterval: contract.harvestInterval
          },
          performance: {
            successRate: farmer.lifetime.successRate * 100, // Convert to percentage
            blocksParticipated: farmer.lifetime.blocksParticipated,
            avgRewardPerBlock: parseFloat(farmer.window.averageRewardPerBlock || '0'),
            totalBlocks: farmer.lifetime.blocksParticipated,
            uptime: 99.9 // Not available in current API
          },
          poolStats: {
            totalFarmers: 0, // Not available in current API
            activeFarmers: 0, // Not available in current API
            poolSuccessRate: 95.0, // Not available in current API
            avgBlockTime: 12.5, // Not available in current API
            totalRewardsDistributed: 0 // Not available in current API
          }
        });
      }
    }
  }, [farmerData]);

  // For now, we'll show empty arrays since we don't have the farmer analytics hooks yet
  // These will be populated when the farmer analytics API is implemented

  const handleRefresh = () => {
    setIsLoading(true);
    // The hooks will automatically refetch when dependencies change
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleExportEarnings = () => {
    console.log('Exporting earnings data...');
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
            <Button onClick={() => window.location.href = '/pool-discovery'}>
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
          <Button onClick={handleExportEarnings}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

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
                {recentActivity.map((activity, index) => (
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
                ))}
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
                    Leave the pool or make irreversible changes
                  </p>
                  <Button variant="destructive" size="sm">
                    Leave Pool
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
