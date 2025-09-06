import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Download,
  Filter,
  RefreshCw,
  Target,
  Zap
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockPerformanceData = {
  successRates: [
    { date: '2024-01-01', rate: 95.2, pool: 'Main Pool' },
    { date: '2024-01-02', rate: 94.8, pool: 'Main Pool' },
    { date: '2024-01-03', rate: 96.1, pool: 'Main Pool' },
    { date: '2024-01-04', rate: 95.7, pool: 'Main Pool' },
    { date: '2024-01-05', rate: 97.2, pool: 'Main Pool' },
    { date: '2024-01-06', rate: 96.8, pool: 'Main Pool' },
    { date: '2024-01-07', rate: 98.1, pool: 'Main Pool' },
  ],
  poolComparison: [
    { name: 'Main Pool', successRate: 96.8, farmers: 150, blocks: 1250 },
    { name: 'Secondary Pool', successRate: 94.2, farmers: 89, blocks: 890 },
    { name: 'Test Pool', successRate: 92.1, farmers: 45, blocks: 320 },
  ],
  metrics: {
    totalBlocks: 2460,
    avgSuccessRate: 94.4,
    activeFarmers: 284,
    avgProcessingTime: 1.2,
    totalRewards: 125000,
    uptime: 99.9
  }
};

export default function PerformanceAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedPool, setSelectedPool] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = () => {
    // Implement CSV/PDF export
    console.log('Exporting performance data...');
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Monitor pool performance metrics and analyze trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Pool</label>
              <Select value={selectedPool} onValueChange={setSelectedPool}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pools</SelectItem>
                  <SelectItem value="main">Main Pool</SelectItem>
                  <SelectItem value="secondary">Secondary Pool</SelectItem>
                  <SelectItem value="test">Test Pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Blocks</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.totalBlocks.toLocaleString()}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.avgSuccessRate}%</p>
              </div>
              <Target className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Farmers</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.activeFarmers}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Processing</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.avgProcessingTime}s</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Rewards</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.totalRewards.toLocaleString()}</p>
              </div>
              <Zap className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                <p className="text-2xl font-bold">{mockPerformanceData.metrics.uptime}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analysis */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Success Rate Trends</TabsTrigger>
          <TabsTrigger value="comparison">Pool Comparison</TabsTrigger>
          <TabsTrigger value="efficiency">Processing Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate Over Time</CardTitle>
              <CardDescription>
                Track pool success rates and identify performance trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Success Rate Chart</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Line chart showing success rates over {timeRange}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pool Performance Comparison</CardTitle>
              <CardDescription>
                Compare performance metrics across different pools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPerformanceData.poolComparison.map((pool, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <div>
                        <h3 className="font-medium">{pool.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {pool.farmers} farmers • {pool.blocks} blocks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={pool.successRate > 95 ? 'default' : pool.successRate > 90 ? 'secondary' : 'destructive'}>
                        {pool.successRate}% success
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Efficiency</CardTitle>
              <CardDescription>
                Analyze block processing times and efficiency metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Efficiency Chart</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bar chart showing processing times and efficiency metrics
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
          <CardDescription>
            AI-generated insights and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <h4 className="font-medium text-success">Performance Improving</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Success rates have increased by 2.3% over the last 7 days. 
                    Consider maintaining current pool configurations.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <h4 className="font-medium text-warning">Processing Time Alert</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Average processing time has increased by 0.3s. 
                    Monitor farmer connections and network latency.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-primary">Farmer Growth Opportunity</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Secondary Pool has capacity for 11 more farmers. 
                    Consider expanding farmer recruitment efforts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
