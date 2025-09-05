/**
 * Pooler Console Page
 * Monitor block discoveries, notifications, and manage pool operations
 */

import { useState, useEffect } from 'react';
import { usePoolerStatus, useNotifyBlockDiscovered } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BlockDiscoveredEvent } from '@shared/api';
import {
  Activity,
  Users,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Send,
  Plus,
  Database,
  Network,
  Bell,
  Settings,
  Monitor,
  Signal,
} from 'lucide-react';

// Mock block notifications for demonstration
const mockNotifications = [
  {
    id: '1',
    blockIndex: 12345,
    poolerId: 'pool-stellar-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    entropy: '0xabc123...',
    difficulty: '0x1d00ffff',
    plantable: true,
    acknowledged: true,
  },
  {
    id: '2',
    blockIndex: 12344,
    poolerId: 'pool-stellar-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    entropy: '0xdef456...',
    difficulty: '0x1d00ffff',
    plantable: true,
    acknowledged: true,
  },
  {
    id: '3',
    blockIndex: 12343,
    poolerId: 'pool-stellar-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    entropy: '0x789abc...',
    difficulty: '0x1d00ffff',
    plantable: false,
    acknowledged: true,
  },
];

function StatusCard({ title, value, subtitle, icon: Icon, trend, status }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'error';
}) {
  const statusColors = {
    good: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    error: 'text-destructive bg-destructive/10',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              status ? statusColors[status] : "bg-primary/10 text-primary"
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1",
              trend === 'up' ? 'text-success' : 
              trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              <TrendingUp className={cn(
                "w-3 h-3",
                trend === 'down' && "rotate-180"
              )} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockNotificationCard({ notification }: { notification: any }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              notification.plantable ? "bg-success/10 text-success" : "bg-muted"
            )}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Block #{notification.blockIndex}</span>
                <Badge variant={notification.plantable ? 'default' : 'secondary'}>
                  {notification.plantable ? 'Plantable' : 'Non-plantable'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Discovered {new Date(notification.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={notification.acknowledged ? 'default' : 'secondary'}>
              {notification.acknowledged ? 'Acknowledged' : 'Pending'}
            </Badge>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Entropy:</span>
            <p className="font-mono text-xs">{notification.entropy}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Difficulty:</span>
            <p className="font-mono text-xs">{notification.difficulty}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimulateBlockModal({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [blockIndex, setBlockIndex] = useState('');
  const [entropy, setEntropy] = useState('');
  const [plantable, setPlantable] = useState(true);
  
  const { toast } = useToast();
  
  const notifyBlock = useNotifyBlockDiscovered({
    onSuccess: (data) => {
      toast({
        title: 'Block Notification Sent',
        description: data.message,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Notification Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setBlockIndex('');
    setEntropy('');
    setPlantable(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockIndex || !entropy) {
      toast({
        title: 'Validation Error',
        description: 'Block index and entropy are required',
        variant: 'destructive'
      });
      return;
    }

    const notification: BlockDiscoveredEvent = {
      event: 'new_block_discovered',
      poolerId: 'pool-stellar-01',
      blockIndex: parseInt(blockIndex),
      blockData: {
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        difficulty: '0x1d00ffff',
        timestamp: Date.now(),
        entropy: entropy,
        age: Math.floor(Math.random() * 60) + 1,
      },
      metadata: {
        plantable,
        estimatedReward: Math.round(Math.random() * 1000 + 500),
        ranges: [
          { start: 0, end: 1000000 },
          { start: 2000000, end: 3000000 }
        ]
      }
    };

    notifyBlock.mutate(notification);
  };

  useEffect(() => {
    if (open) {
      // Auto-generate values for demo
      setBlockIndex((12345 + Math.floor(Math.random() * 100)).toString());
      setEntropy(`0x${Math.random().toString(16).substr(2, 16)}...`);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate Block Discovery</DialogTitle>
          <DialogDescription>
            Send a test block discovery notification
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blockIndex">Block Index</Label>
            <Input
              id="blockIndex"
              type="number"
              value={blockIndex}
              onChange={(e) => setBlockIndex(e.target.value)}
              placeholder="12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entropy">Entropy</Label>
            <Input
              id="entropy"
              value={entropy}
              onChange={(e) => setEntropy(e.target.value)}
              placeholder="0xabc123..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="plantable"
              checked={plantable}
              onChange={(e) => setPlantable(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="plantable">Plantable block</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={notifyBlock.isPending}
            >
              {notifyBlock.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PoolerConsole() {
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);
  const { data: status, isLoading, error, refetch } = usePoolerStatus({
    refetchInterval: 30000, // Refresh every 30 seconds
    queryKey: ['poolerStatus']
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pooler Console</h1>
          <p className="text-muted-foreground">
            Monitor block discoveries and manage pool operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setSimulateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Simulate Block
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Failed to load pooler status. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notifications">Block Notifications</TabsTrigger>
          <TabsTrigger value="farmers">Connected Farmers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : status ? (
              <>
                <StatusCard
                  title="Connected Farmers"
                  value={status.connections.farmers}
                  subtitle={`${status.connections.active} active`}
                  icon={Users}
                  status="good"
                />
                <StatusCard
                  title="Blocks Discovered"
                  value={status.blocksDiscovered.total.toLocaleString()}
                  subtitle={`${status.blocksDiscovered.last24h} in 24h`}
                  icon={Database}
                  trend="up"
                  status="good"
                />
                <StatusCard
                  title="Success Rate"
                  value={`${status.performance.successRate.toFixed(1)}%`}
                  subtitle="Mining success"
                  icon={TrendingUp}
                  status={status.performance.successRate > 90 ? 'good' : 'warning'}
                />
                <StatusCard
                  title="Uptime"
                  value={`${status.performance.uptime.toFixed(1)}%`}
                  subtitle="System availability"
                  icon={Monitor}
                  status={status.performance.uptime > 98 ? 'good' : 'warning'}
                />
              </>
            ) : null}
          </div>

          {/* Performance Overview */}
          {status && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Signal className="w-5 h-5" />
                    Real-time Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Response Time</span>
                      <span>{status.performance.avgResponseTime}ms</span>
                    </div>
                    <Progress 
                      value={Math.max(0, 100 - (status.performance.avgResponseTime - 20))} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Active Connections</span>
                      <span>{status.connections.active}/{status.connections.farmers}</span>
                    </div>
                    <Progress 
                      value={(status.connections.active / status.connections.farmers) * 100} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Pending Blocks</span>
                      <span>{status.blocksDiscovered.pending}</span>
                    </div>
                    <Badge variant={status.blocksDiscovered.pending > 5 ? 'destructive' : 'default'}>
                      {status.blocksDiscovered.pending > 5 ? 'High' : 'Normal'} Load
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Latest Notification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {status.lastNotification ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Block #{status.lastNotification.blockIndex}</span>
                        <Badge variant={status.lastNotification.acknowledged ? 'default' : 'secondary'}>
                          {status.lastNotification.acknowledged ? 'Acknowledged' : 'Pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Received {new Date(status.lastNotification.timestamp).toLocaleString()}
                      </p>
                      <Alert>
                        <CheckCircle className="w-4 h-4" />
                        <AlertDescription>
                          Block notification processed successfully and farmers notified.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No recent notifications</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Block Notifications</h2>
            <Button variant="outline" onClick={() => setSimulateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Simulate Discovery
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mockNotifications.map((notification) => (
              <BlockNotificationCard key={notification.id} notification={notification} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="farmers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Farmers</CardTitle>
              <CardDescription>
                Manage and monitor farmers connected to your pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{status.connections.farmers}</div>
                      <div className="text-sm text-muted-foreground">Total Farmers</div>
                    </div>
                    <div className="text-center p-4 bg-success/10 rounded-lg">
                      <div className="text-2xl font-bold text-success">{status.connections.active}</div>
                      <div className="text-sm text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-muted-foreground">{status.connections.inactive}</div>
                      <div className="text-sm text-muted-foreground">Inactive</div>
                    </div>
                  </div>

                  <Alert>
                    <Users className="w-4 h-4" />
                    <AlertDescription>
                      Farmer management tools and detailed connection information will be available in the next update.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Detailed performance analytics and historical data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Response Times</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Average Response Time</span>
                        <span>{status.performance.avgResponseTime}ms</span>
                      </div>
                      <Progress value={Math.min(100, (100 - status.performance.avgResponseTime) / 2)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Success Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Success Rate</span>
                        <span>{status.performance.successRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={status.performance.successRate} />
                    </div>
                  </div>
                </div>
              )}

              <Alert className="mt-6">
                <Activity className="w-4 h-4" />
                <AlertDescription>
                  Advanced performance charts and historical analysis coming soon.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Simulate Block Modal */}
      <SimulateBlockModal
        open={simulateModalOpen}
        onOpenChange={setSimulateModalOpen}
      />
    </div>
  );
}
