/**
 * Dashboard Page - KALE Pool System Overview
 * Displays system health, network status, and recent activity
 * For farmers: Shows stake information, rewards, and farming status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth, useInfo, useLogout } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Leaf,
  LogOut,
  Network,
  Pickaxe,
  RefreshCw,
  Server,
  Truck,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

// Mock recent activity data - in real app this would come from API
const mockRecentActivity = [
  {
    id: '1',
    type: 'plant',
    blockIndex: 12345,
    poolerId: 'pool-abc123',
    farmers: 15,
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    status: 'success',
  },
  {
    id: '2',
    type: 'work',
    blockIndex: 12344,
    poolerId: 'pool-abc123',
    submissions: 8,
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    status: 'success',
  },
  {
    id: '3',
    type: 'harvest',
    blockIndex: 12343,
    poolerId: 'pool-xyz789',
    rewards: 1250.5,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    status: 'success',
  },
];

function ServiceStatusCard({ title, status, lastCheck, responseTime, error }: {
  title: string;
  status: 'online' | 'offline' | 'error';
  lastCheck: string;
  responseTime?: number;
  error?: string;
}) {
  const statusConfig = {
    online: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    offline: { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
    error: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", config.bg)}>
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">
                {responseTime ? `${responseTime}ms` : 'Response time N/A'}
              </p>
            </div>
          </div>
          <Badge variant={status === 'online' ? 'default' : 'destructive'}>
            {status}
          </Badge>
        </div>
        {error && (
          <Alert className="mt-3">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest operations across the pool coordination system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockRecentActivity.map((activity) => {
            const icons = {
              plant: Leaf,
              work: Pickaxe,
              harvest: Truck,
            };
            const Icon = icons[activity.type as keyof typeof icons];

            return (
              <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{activity.type}</span>
                    <span className="text-sm text-muted-foreground">
                      Block #{activity.blockIndex}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.type === 'plant' && `${activity.farmers} farmers planted`}
                    {activity.type === 'work' && `${activity.submissions} work submissions`}
                    {activity.type === 'harvest' && `${activity.rewards} XLM harvested`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">Success</Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Farmer-specific data types - matches backend response
interface FarmerStatus {
  userId: string;
  email: string;
  externalWallet: string;
  userStatus: string;
  custodialWallet: string;
  farmerStatus: string;
  currentBalance: string;
  isFunded: boolean;
  lastBalanceCheck: string | null;
  poolContract: {
    contractId: string;
    poolerId: string;
    stakePercentage: number;
    harvestInterval: number;
    status: string;
    joinedAt: string;
  } | null;
  createdAt: string;
  fundedAt: string | null;
  joinedPoolAt: string | null;
}

// Farmer analytics data types
interface FarmerSummary {
  farmerId: string;
  totalStaked: number;
  totalHarvested: number;
  totalPlantings: number;
  successfulPlantings: number;
  failedPlantings: number;
  averageStakePercentage: number;
  lastActivity: string;
  currentPoolerId?: string;
  performance: {
    successRate: number;
    averageReward: number;
    totalBlocks: number;
  };
}

interface PlantingRecord {
  id: string;
  blockIndex: number;
  poolerId: string;
  status: 'success' | 'failed';
  plantedAt: string;
  stakeAmount: number;
  reward?: number;
  error?: string;
}

interface HarvestRecord {
  id: string;
  blockIndex: number;
  poolerId: string;
  status: 'success' | 'failed';
  harvestedAt: string;
  amount: number;
  stakePercentage: number;
  error?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useHealth();
  const { data: info, isLoading: infoLoading, error: infoError } = useInfo();
  const logout = useLogout({
    onSuccess: () => {
      // Navigate to landing page after successful logout
      navigate('/');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      // Still navigate to landing page even if logout fails
      navigate('/');
    }
  });
  const [uptime, setUptime] = useState(0);
  const [farmerStatus, setFarmerStatus] = useState<FarmerStatus | null>(null);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [farmerError, setFarmerError] = useState<string | null>(null);
  
  // Farmer analytics state
  const [farmerSummary, setFarmerSummary] = useState<FarmerSummary | null>(null);
  const [plantingHistory, setPlantingHistory] = useState<PlantingRecord[]>([]);
  const [harvestHistory, setHarvestHistory] = useState<HarvestRecord[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Update uptime display
  useEffect(() => {
    if (health?.uptime) {
      setUptime(health.uptime);
      const interval = setInterval(() => {
        setUptime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [health?.uptime]);

  // Fetch farmer status data
  useEffect(() => {
    const fetchFarmerStatus = async () => {
      const userId = localStorage.getItem('kale-pool-user-id');
      if (!userId) {
        setFarmerError('No user ID found. Please register first.');
        return;
      }

      setFarmerLoading(true);
      setFarmerError(null);
      
      try {
        const status = await apiClient.getUserStatus(userId) as any;
        setFarmerStatus(status);
      } catch (error) {
        console.error('Failed to fetch farmer status:', error);
        setFarmerError('Failed to load farmer status');
      } finally {
        setFarmerLoading(false);
      }
    };

    fetchFarmerStatus();
  }, []);

  // Fetch farmer analytics data
  useEffect(() => {
    const fetchFarmerAnalytics = async () => {
      const userId = localStorage.getItem('kale-pool-user-id');
      if (!userId) {
        setAnalyticsError('No user ID found. Please register first.');
        return;
      }

      setAnalyticsLoading(true);
      setAnalyticsError(null);
      
      try {
        // Fetch farmer summary
        const summary = await apiClient.getFarmerSummary(userId, '7d');
        setFarmerSummary(summary);

        // Fetch planting history
        const plantings = await apiClient.getFarmerPlantings(userId, { 
          page: 1, 
          limit: 10, 
          status: 'all' 
        });
        setPlantingHistory(plantings.plantings || []);

        // Fetch harvest history
        const harvests = await apiClient.getFarmerHarvests(userId, { 
          page: 1, 
          limit: 10, 
          status: 'all' 
        });
        setHarvestHistory(harvests.harvests || []);

      } catch (error) {
        console.error('Failed to fetch farmer analytics:', error);
        setAnalyticsError('Failed to load farmer analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    // Only fetch analytics if we have farmer status
    if (farmerStatus?.poolContract) {
      fetchFarmerAnalytics();
    }
  }, [farmerStatus?.poolContract]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Helper functions for farmer data
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 7, 
      maximumFractionDigits: 7 
    });
  };

  const formatStakePercentage = (percentage: number) => {
    return `${(percentage * 100).toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'funded':
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'checking':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'insufficient':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOverallHealthStatus = () => {
    if (!health || !health.services) return 'unknown';
    
    const services = Object.values(health.services || {});
    const onlineCount = services.filter(s => s.status === 'online').length;
    const totalCount = services.length;
    
    if (onlineCount === totalCount) return 'healthy';
    if (onlineCount === 0) return 'critical';
    return 'degraded';
  };

  const overallStatus = getOverallHealthStatus();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your KALE Pool coordination system health and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchHealth()}
            disabled={healthLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", healthLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className={cn("w-4 h-4 mr-2", logout.isPending && "animate-spin")} />
            {logout.isPending ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </div>

      {/* Error States */}
      {(healthError || infoError) && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Failed to load system information. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stakes">My Stakes</TabsTrigger>
          <TabsTrigger value="harvest">Harvest Flow</TabsTrigger>
          <TabsTrigger value="planting">Planting History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Farmer Status Overview */}
          {farmerError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{farmerError}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    farmerStatus?.isFunded ? 'bg-success/10' : 'bg-warning/10'
                  )}>
                    <Wallet className={cn(
                      "w-4 h-4",
                      farmerStatus?.isFunded ? 'text-success' : 'text-warning'
                    )} />
                  </div>
                  <div>
                    <p className="font-medium">Wallet Status</p>
                    <div className="text-sm text-muted-foreground">
                      {farmerLoading ? (
                        <Skeleton className="h-4 w-16" />
                      ) : farmerStatus?.isFunded ? (
                        'Funded'
                      ) : (
                        'Needs Funding'
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Current Balance</p>
                    {farmerLoading ? (
                      <div className="text-sm text-muted-foreground">
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {farmerStatus ? `${formatBalance(farmerStatus.currentBalance)} XLM` : 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-full">
                    <Network className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Pool Status</p>
                    {farmerLoading ? (
                      <div className="text-sm text-muted-foreground">
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {farmerStatus?.poolContract ? 'Active' : 'Not Joined'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-chart-2/10 rounded-full">
                    <Leaf className="w-4 h-4 text-chart-2" />
                  </div>
                  <div>
                    <p className="font-medium">Stake Percentage</p>
                    {farmerLoading ? (
                      <div className="text-sm text-muted-foreground">
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {farmerStatus?.poolContract ? formatStakePercentage(farmerStatus.poolContract.stakePercentage) : 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <RecentActivityCard />
        </TabsContent>

        <TabsContent value="stakes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stake Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="w-5 h-5" />
                  Stake Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : farmerSummary ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Staked:</span>
                      <span className="font-medium">{formatBalance(farmerSummary.totalStaked.toString())} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Stake %:</span>
                      <span className="font-medium">{formatStakePercentage(farmerSummary.averageStakePercentage)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span className="font-medium">{farmerSummary.performance.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Blocks:</span>
                      <span className="font-medium">{farmerSummary.performance.totalBlocks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Activity:</span>
                      <span className="font-medium">
                        {new Date(farmerSummary.lastActivity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No stake analytics available</p>
                )}
              </CardContent>
            </Card>

            {/* Stake History Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : plantingHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground mb-2">Recent Plantings:</div>
                    {plantingHistory.slice(0, 5).map((planting) => (
                      <div key={planting.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${planting.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm">Block #{planting.blockIndex}</span>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(planting.status)}>
                            {planting.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(planting.plantedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="harvest" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Harvest Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Harvest Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : farmerSummary ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Harvested:</span>
                      <span className="font-medium">{formatBalance(farmerSummary.totalHarvested.toString())} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Reward:</span>
                      <span className="font-medium">{formatBalance(farmerSummary.performance.averageReward.toString())} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Plantings:</span>
                      <span className="font-medium">{farmerSummary.totalPlantings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Successful:</span>
                      <span className="font-medium text-green-600">{farmerSummary.successfulPlantings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="font-medium text-red-600">{farmerSummary.failedPlantings}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No harvest data available</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Harvests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pickaxe className="w-5 h-5" />
                  Recent Harvests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : harvestHistory.length > 0 ? (
                  <div className="space-y-3">
                    {harvestHistory.slice(0, 5).map((harvest) => (
                      <div key={harvest.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${harvest.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm">Block #{harvest.blockIndex}</span>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{formatBalance(harvest.amount.toString())} XLM</span>
                            <Badge className={getStatusColor(harvest.status)}>
                              {harvest.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(harvest.harvestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No harvest history available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="planting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="w-5 h-5" />
                Planting History
              </CardTitle>
              <CardDescription>
                Track your planting activities and their outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : plantingHistory.length > 0 ? (
                <div className="space-y-3">
                  {plantingHistory.map((planting) => (
                    <div key={planting.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className={`w-3 h-3 rounded-full ${planting.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Block #{planting.blockIndex}</span>
                          <Badge className={getStatusColor(planting.status)}>
                            {planting.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Pooler: {planting.poolerId.substring(0, 8)}...
                          {planting.reward && ` • Reward: ${formatBalance(planting.reward.toString())} XLM`}
                        </p>
                        {planting.error && (
                          <p className="text-xs text-red-600 mt-1">{planting.error}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatBalance(planting.stakeAmount.toString())} XLM</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(planting.plantedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No planting history available</p>
                  <p className="text-sm text-muted-foreground mt-1">Start farming to see your planting activities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
