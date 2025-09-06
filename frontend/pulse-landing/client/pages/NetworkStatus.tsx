import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Network, 
  Wifi, 
  WifiOff, 
  Server, 
  Clock, 
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  Database,
  Zap
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockNetworkData = {
  blockchain: {
    status: 'connected',
    network: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
    lastSync: '2024-01-15T10:30:00Z',
    latency: 45,
    peers: 12,
    blockHeight: 12345678,
    syncStatus: 'synced'
  },
  services: {
    horizon: { status: 'online', latency: 45, uptime: 99.9 },
    stellarCore: { status: 'online', latency: 12, uptime: 99.8 },
    database: { status: 'online', latency: 8, uptime: 99.95 },
    walletManager: { status: 'online', latency: 15, uptime: 99.7 }
  },
  connectivity: {
    internet: { status: 'connected', speed: '100 Mbps', latency: 25 },
    dns: { status: 'resolved', servers: ['8.8.8.8', '1.1.1.1'] },
    firewall: { status: 'open', ports: [3000, 8000, 443] }
  },
  performance: {
    avgResponseTime: 35,
    successRate: 99.2,
    errorRate: 0.8,
    throughput: 1250
  }
};

export default function NetworkStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdate(new Date());
    }, 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'offline':
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'synced':
        return <Badge variant="default" className="bg-success">Online</Badge>;
      case 'offline':
      case 'disconnected':
        return <Badge variant="destructive">Offline</Badge>;
      case 'warning':
      case 'degraded':
        return <Badge variant="secondary" className="bg-warning">Warning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Network Status</h1>
          <p className="text-muted-foreground mt-1">
            Monitor blockchain network health and connectivity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Overall Network Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              {getStatusIcon(mockNetworkData.blockchain.status)}
              <div>
                <p className="font-medium">Blockchain</p>
                <p className="text-sm text-muted-foreground">
                  {mockNetworkData.blockchain.network}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Wifi className="w-4 h-4 text-success" />
              <div>
                <p className="font-medium">Internet</p>
                <p className="text-sm text-muted-foreground">
                  {mockNetworkData.connectivity.internet.speed}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Server className="w-4 h-4 text-success" />
              <div>
                <p className="font-medium">Services</p>
                <p className="text-sm text-muted-foreground">
                  All operational
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Activity className="w-4 h-4 text-success" />
              <div>
                <p className="font-medium">Performance</p>
                <p className="text-sm text-muted-foreground">
                  {mockNetworkData.performance.successRate}% success
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Status Tabs */}
      <Tabs defaultValue="blockchain" className="space-y-4">
        <TabsList>
          <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="blockchain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Stellar Network Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Network</span>
                    <Badge variant="outline">{mockNetworkData.blockchain.network}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    {getStatusBadge(mockNetworkData.blockchain.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sync Status</span>
                    {getStatusBadge(mockNetworkData.blockchain.syncStatus)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Block Height</span>
                    <span className="font-mono text-sm">
                      {mockNetworkData.blockchain.blockHeight.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Latency</span>
                    <span className="text-sm">{mockNetworkData.blockchain.latency}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connected Peers</span>
                    <span className="text-sm">{mockNetworkData.blockchain.peers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Sync</span>
                    <span className="text-sm">
                      {new Date(mockNetworkData.blockchain.lastSync).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Horizon URL</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {mockNetworkData.blockchain.horizonUrl}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mockNetworkData.services).map(([service, data]) => (
                  <div key={service} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(data.status)}
                      <div>
                        <h3 className="font-medium capitalize">{service}</h3>
                        <p className="text-sm text-muted-foreground">
                          Latency: {data.latency}ms • Uptime: {data.uptime}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(data.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectivity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                Network Connectivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Wifi className="w-4 h-4" />
                      <h3 className="font-medium">Internet</h3>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        {getStatusBadge(mockNetworkData.connectivity.internet.status)}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Speed:</span>
                        <span>{mockNetworkData.connectivity.internet.speed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Latency:</span>
                        <span>{mockNetworkData.connectivity.internet.latency}ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-4 h-4" />
                      <h3 className="font-medium">DNS</h3>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        {getStatusBadge(mockNetworkData.connectivity.dns.status)}
                      </div>
                      <div className="text-sm">
                        <span>Servers:</span>
                        <div className="font-mono text-xs mt-1">
                          {mockNetworkData.connectivity.dns.servers.map(server => (
                            <div key={server}>{server}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4" />
                      <h3 className="font-medium">Firewall</h3>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        {getStatusBadge(mockNetworkData.connectivity.firewall.status)}
                      </div>
                      <div className="text-sm">
                        <span>Open Ports:</span>
                        <div className="font-mono text-xs mt-1">
                          {mockNetworkData.connectivity.firewall.ports.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg text-center">
                  <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{mockNetworkData.performance.avgResponseTime}ms</p>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-2xl font-bold">{mockNetworkData.performance.successRate}%</p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-bold">{mockNetworkData.performance.errorRate}%</p>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Database className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="text-2xl font-bold">{mockNetworkData.performance.throughput}</p>
                  <p className="text-sm text-muted-foreground">Requests/min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Network Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Network Configuration</CardTitle>
          <CardDescription>
            Current network settings and configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Stellar Network</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Passphrase:</span>
                  <span className="font-mono text-xs">
                    {mockNetworkData.blockchain.passphrase.substring(0, 30)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horizon URL:</span>
                  <span className="font-mono text-xs">
                    {mockNetworkData.blockchain.horizonUrl}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-3">Connection Settings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timeout:</span>
                  <span>30 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retry Attempts:</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keep-Alive:</span>
                  <span>Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
