import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Users, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  BarChart3,
  Zap,
  Database,
  Server
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockPoolerStatus = {
  poolerInfo: {
    poolerId: 'main_pool_001',
    name: 'Main Pool Operator',
    status: 'active',
    uptime: 99.8,
    lastSeen: '2024-01-15T10:30:00Z',
    version: 'v1.2.3'
  },
  connections: {
    farmers: {
      total: 150,
      active: 142,
      inactive: 8,
      connecting: 0
    },
    blockchain: {
      status: 'connected',
      peers: 12,
      latency: 45,
      syncStatus: 'synced'
    }
  },
  performance: {
    blocksDiscovered: {
      total: 1250,
      last24h: 45,
      pending: 3,
      failed: 2
    },
    responseTime: {
      avg: 1.2,
      min: 0.8,
      max: 3.5,
      p95: 2.1
    },
    successRate: 98.5,
    errorRate: 1.5
  },
  resources: {
    cpu: 45,
    memory: 62,
    disk: 38,
    network: 25
  }
};

const mockRecentBlocks = [
  {
    blockIndex: 12345,
    discoveredAt: '2024-01-15T10:30:00Z',
    status: 'planted',
    farmersParticipated: 142,
    totalStake: 1000000,
    rewards: 25000
  },
  {
    blockIndex: 12344,
    discoveredAt: '2024-01-15T10:15:00Z',
    status: 'harvested',
    farmersParticipated: 140,
    totalStake: 980000,
    rewards: 24500
  },
  {
    blockIndex: 12343,
    discoveredAt: '2024-01-15T10:00:00Z',
    status: 'completed',
    farmersParticipated: 138,
    totalStake: 950000,
    rewards: 23800
  },
  {
    blockIndex: 12342,
    discoveredAt: '2024-01-15T09:45:00Z',
    status: 'failed',
    farmersParticipated: 0,
    totalStake: 0,
    rewards: 0
  }
];

const mockSystemLogs = [
  {
    timestamp: '2024-01-15T10:30:00Z',
    level: 'info',
    message: 'Block 12345 discovered and processed successfully',
    component: 'block-monitor'
  },
  {
    timestamp: '2024-01-15T10:25:00Z',
    level: 'info',
    message: 'Farmer connection established: farmer_001',
    component: 'connection-manager'
  },
  {
    timestamp: '2024-01-15T10:20:00Z',
    level: 'warning',
    message: 'High memory usage detected: 85%',
    component: 'resource-monitor'
  },
  {
    timestamp: '2024-01-15T10:15:00Z',
    level: 'error',
    message: 'Failed to process block 12342: Invalid nonce',
    component: 'work-processor'
  },
  {
    timestamp: '2024-01-15T10:10:00Z',
    level: 'info',
    message: 'Pooler status check completed',
    component: 'health-checker'
  }
];

export default function PoolerStatus() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
      case 'synced':
      case 'planted':
      case 'harvested':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'inactive':
      case 'disconnected':
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
      case 'synced':
      case 'planted':
      case 'harvested':
      case 'completed':
        return <Badge variant="default" className="bg-success">Active</Badge>;
      case 'inactive':
      case 'disconnected':
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
      case 'pending':
        return <Badge variant="secondary" className="bg-warning">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      case 'info':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pooler Status</h1>
          <p className="text-muted-foreground mt-1">
            Monitor pooler performance and connections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pooler Status</p>
                <p className="text-2xl font-bold capitalize">{mockPoolerStatus.poolerInfo.status}</p>
              </div>
              {getStatusIcon(mockPoolerStatus.poolerInfo.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                <p className="text-2xl font-bold">{mockPoolerStatus.poolerInfo.uptime}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Farmers</p>
                <p className="text-2xl font-bold">{mockPoolerStatus.connections.farmers.active}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{mockPoolerStatus.performance.responseTime.avg}s</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="blocks">Recent Blocks</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pooler Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pooler ID</span>
                  <span className="font-mono text-sm">{mockPoolerStatus.poolerInfo.poolerId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Name</span>
                  <span className="font-medium">{mockPoolerStatus.poolerInfo.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  {getStatusBadge(mockPoolerStatus.poolerInfo.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version</span>
                  <span className="text-sm">{mockPoolerStatus.poolerInfo.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Seen</span>
                  <span className="text-sm">
                    {new Date(mockPoolerStatus.poolerInfo.lastSeen).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm">{mockPoolerStatus.resources.cpu}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.resources.cpu} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm">{mockPoolerStatus.resources.memory}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.resources.memory} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Disk Usage</span>
                    <span className="text-sm">{mockPoolerStatus.resources.disk}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.resources.disk} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Network Usage</span>
                    <span className="text-sm">{mockPoolerStatus.resources.network}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.resources.network} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Farmer Connections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Farmers</span>
                  <span className="font-bold">{mockPoolerStatus.connections.farmers.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active</span>
                  <span className="font-bold text-success">{mockPoolerStatus.connections.farmers.active}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Inactive</span>
                  <span className="font-bold text-destructive">{mockPoolerStatus.connections.farmers.inactive}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connecting</span>
                  <span className="font-bold text-warning">{mockPoolerStatus.connections.farmers.connecting}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blockchain Connection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  {getStatusBadge(mockPoolerStatus.connections.blockchain.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connected Peers</span>
                  <span className="font-bold">{mockPoolerStatus.connections.blockchain.peers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Latency</span>
                  <span className="font-bold">{mockPoolerStatus.connections.blockchain.latency}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sync Status</span>
                  {getStatusBadge(mockPoolerStatus.connections.blockchain.syncStatus)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Block Discovery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Blocks</span>
                  <span className="font-bold">{mockPoolerStatus.performance.blocksDiscovered.total.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last 24h</span>
                  <span className="font-bold">{mockPoolerStatus.performance.blocksDiscovered.last24h}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending</span>
                  <span className="font-bold text-warning">{mockPoolerStatus.performance.blocksDiscovered.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Failed</span>
                  <span className="font-bold text-destructive">{mockPoolerStatus.performance.blocksDiscovered.failed}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average</span>
                  <span className="font-bold">{mockPoolerStatus.performance.responseTime.avg}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Minimum</span>
                  <span className="font-bold">{mockPoolerStatus.performance.responseTime.min}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Maximum</span>
                  <span className="font-bold">{mockPoolerStatus.performance.responseTime.max}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">95th Percentile</span>
                  <span className="font-bold">{mockPoolerStatus.performance.responseTime.p95}s</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Success Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="font-bold text-success">{mockPoolerStatus.performance.successRate}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.performance.successRate} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className="font-bold text-destructive">{mockPoolerStatus.performance.errorRate}%</span>
                  </div>
                  <Progress value={mockPoolerStatus.performance.errorRate} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Block Activity</CardTitle>
              <CardDescription>
                Latest blocks discovered and processed by this pooler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRecentBlocks.map((block, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Block #{block.blockIndex}</h3>
                        <p className="text-sm text-muted-foreground">
                          {block.farmersParticipated} farmers • {block.totalStake.toLocaleString()} stake
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(block.discoveredAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-2">
                        {getStatusBadge(block.status)}
                      </div>
                      {block.rewards > 0 && (
                        <p className="font-bold text-success">+{block.rewards.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Recent system events and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSystemLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium uppercase ${getLogLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {log.component}
                        </Badge>
                      </div>
                      <p className="text-sm">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
