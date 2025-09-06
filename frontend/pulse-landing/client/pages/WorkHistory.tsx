import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  HardHat, 
  Search, 
  Filter, 
  Download,
  RefreshCw,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { useFarmerSummary, useFarmerPlantings, useFarmerHarvests } from '@/hooks/use-api';

// Work history data will be fetched from API
interface WorkHistoryItem {
  id: string;
  blockIndex: number;
  status: 'success' | 'failed' | 'pending';
  amount: string;
  timestamp: string;
  poolerId: string;
  poolerName: string;
  type: 'planting' | 'harvest';
  transactionHash?: string;
}

interface WorkStats {
  totalSubmissions: number;
  successRate: number;
  avgProcessingTime: number;
  totalRewards: number;
  activePools: number;
  peakHour: string;
  topFarmer: string;
}

interface FarmerStats {
  farmerId: string;
  submissions: number;
  successRate: number;
  totalRewards: number;
}

export default function WorkHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poolerFilter, setPoolerFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');
  const [workHistory, setWorkHistory] = useState<WorkHistoryItem[]>([]);
  const [farmerStats, setFarmerStats] = useState<FarmerStats[]>([]);

  // Check if farmer ID exists in local storage
  const farmerId = localStorage.getItem('kale-pool-farmer-id');
  const hasFarmerId = !!farmerId;

  // API hooks - only call when farmer ID exists
  const { 
    data: farmerSummary, 
    isLoading: summaryLoading, 
    error: summaryError,
    refetch: refetchSummary 
  } = useFarmerSummary(farmerId || undefined, timeRange as '24h' | '7d' | '30d' | 'all');

  const { 
    data: plantingsData, 
    isLoading: plantingsLoading, 
    error: plantingsError,
    refetch: refetchPlantings 
  } = useFarmerPlantings(farmerId || undefined, {
    status: statusFilter === 'all' ? undefined : statusFilter as 'success' | 'failed',
    poolerId: poolerFilter === 'all' ? undefined : poolerFilter,
    page: 1,
    limit: 100
  });

  const { 
    data: harvestsData, 
    isLoading: harvestsLoading, 
    error: harvestsError,
    refetch: refetchHarvests 
  } = useFarmerHarvests(farmerId || undefined, {
    status: statusFilter === 'all' ? undefined : statusFilter as 'success' | 'failed',
    poolerId: poolerFilter === 'all' ? undefined : poolerFilter,
    page: 1,
    limit: 100
  });

  const isLoading = summaryLoading || plantingsLoading || harvestsLoading;
  const hasError = summaryError || plantingsError || harvestsError;

  // Debug logging for data structure issues
  useEffect(() => {
    if (farmerSummary) {
      console.log('Farmer Summary Data:', farmerSummary);
    }
    if (plantingsData) {
      console.log('Plantings Data:', plantingsData);
    }
    if (harvestsData) {
      console.log('Harvests Data:', harvestsData);
    }
  }, [farmerSummary, plantingsData, harvestsData]);

  const handleExport = () => {
    // Implement CSV/PDF export
    console.log('Exporting work history data...');
  };

  const handleRefresh = () => {
    refetchSummary();
    refetchPlantings();
    refetchHarvests();
  };

  // Process data from APIs
  useEffect(() => {
    if (plantingsData && harvestsData) {
      // Combine plantings and harvests data for work history
      const combinedHistory: WorkHistoryItem[] = [];
      
      // Add plantings as work submissions
      if (plantingsData.items && Array.isArray(plantingsData.items)) {
        plantingsData.items.forEach((planting: any) => {
          if (planting && planting.id) {
            combinedHistory.push({
              id: planting.id,
              blockIndex: planting.blockIndex || 0,
              status: planting.status === 'success' ? 'success' : 'failed',
              amount: planting.stakeAmountHuman || '0',
              timestamp: planting.plantedAt || new Date().toISOString(),
              poolerId: planting.poolerId || 'unknown',
              poolerName: planting.poolerName || 'Unknown Pooler',
              type: 'planting',
              transactionHash: planting.transactionHash || ''
            });
          }
        });
      }

      // Add harvests as work completions
      if (harvestsData.items && Array.isArray(harvestsData.items)) {
        harvestsData.items.forEach((harvest: any) => {
          if (harvest && harvest.id) {
            combinedHistory.push({
              id: harvest.id,
              blockIndex: harvest.blockIndex || 0,
              status: harvest.status === 'success' ? 'success' : 'failed',
              amount: harvest.rewardAmountHuman || '0',
              timestamp: harvest.harvestedAt || new Date().toISOString(),
              poolerId: harvest.poolerId || 'unknown',
              poolerName: harvest.poolerName || 'Unknown Pooler',
              type: 'harvest',
              transactionHash: harvest.transactionHash || ''
            });
          }
        });
      }

      // Sort by timestamp (newest first)
      combinedHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setWorkHistory(combinedHistory);
    }
  }, [plantingsData, harvestsData]);

  const filteredWorkHistory = workHistory
    .filter(work => {
    const matchesSearch = work.blockIndex.toString().includes(searchTerm) ||
                         work.poolerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         work.poolerId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    const matchesPooler = poolerFilter === 'all' || work.poolerId === poolerFilter;
    
    return matchesSearch && matchesStatus && matchesPooler;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Work History</h1>
          <p className="text-muted-foreground mt-1">
            Historical work submission data and performance analysis
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : 
                   (farmerSummary?.lifetime?.blocksParticipated || workHistory.length).toLocaleString()}
                </p>
              </div>
              <HardHat className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : 
                   `${Math.round((farmerSummary?.lifetime?.successRate || 0) * 100)}%`}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Processing</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : 
                   `N/A`}
                </p>
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
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : 
                   (farmerSummary?.lifetime?.totalRewardsHuman || '0')}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Pools</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : 
                   farmerSummary?.contract ? 1 : 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Peak Hour</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : 
                   'N/A'}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by farmer ID, block, or nonce..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Pooler</label>
              <Select value={poolerFilter} onValueChange={setPoolerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Poolers</SelectItem>
                  <SelectItem value="main_pool">Main Pool</SelectItem>
                  <SelectItem value="secondary_pool">Secondary Pool</SelectItem>
                  <SelectItem value="test_pool">Test Pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
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
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {!hasFarmerId && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div>
              <p>No farmer account found. Please complete your farmer registration first.</p>
              <p className="text-sm mt-1">You need to register as a farmer to view work history data.</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {hasError && hasFarmerId && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div>
              <p>Failed to load work history data. Please try refreshing the page.</p>
              {summaryError && <p className="text-sm mt-1">Summary Error: {summaryError.message}</p>}
              {plantingsError && <p className="text-sm mt-1">Plantings Error: {plantingsError.message}</p>}
              {harvestsError && <p className="text-sm mt-1">Harvests Error: {harvestsError.message}</p>}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Work History</TabsTrigger>
          <TabsTrigger value="patterns">Work Patterns</TabsTrigger>
          <TabsTrigger value="farmers">Farmer Performance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Work Submissions</CardTitle>
              <CardDescription>
                Detailed history of work submissions with filtering and search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Block Index</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Pooler</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredWorkHistory.length > 0 ? (
                      filteredWorkHistory.map((work) => (
                        <TableRow key={work.id}>
                          <TableCell className="font-mono">{work.blockIndex}</TableCell>
                          <TableCell>
                            <Badge variant={work.type === 'planting' ? 'secondary' : 'default'}>
                              {work.type === 'planting' ? 'Planting' : 'Harvest'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={work.status === 'success' ? 'default' : 'destructive'}>
                              {work.status === 'success' ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              ) : (
                                <XCircle className="w-3 h-3 mr-1" />
                              )}
                              {work.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {work.amount}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{work.poolerName}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {work.transactionHash ? `${work.transactionHash.slice(0, 8)}...` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(work.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <HardHat className="w-8 h-8 text-muted-foreground" />
                            <p className="text-muted-foreground">No work history found</p>
                            <p className="text-sm text-muted-foreground">
                              Work submissions will appear here once you start participating in pools
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Submission Patterns</CardTitle>
              <CardDescription>
                Analyze work patterns and trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Work Pattern Chart</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chart showing work submission frequency and patterns over time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="farmers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Farmer Performance Rankings</CardTitle>
              <CardDescription>
                Track individual farmer participation and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {farmerStats.length > 0 ? (
                  farmerStats.map((farmer, index) => (
                    <div key={farmer.farmerId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium font-mono">{farmer.farmerId}</h3>
                          <p className="text-sm text-muted-foreground">
                            {farmer.submissions} submissions • {farmer.totalRewards.toLocaleString()} rewards
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={farmer.successRate > 95 ? 'default' : farmer.successRate > 90 ? 'secondary' : 'destructive'}>
                          {farmer.successRate}% success
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No farmer performance data available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Performance rankings will appear once farmers start submitting work
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Reports</CardTitle>
              <CardDescription>
                Create detailed reports for work history and farmer performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-medium">Work History Report</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a comprehensive report of all work submissions for the selected time period.
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="font-medium">Farmer Performance Report</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create detailed performance analysis for individual farmers or farmer groups.
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h3 className="font-medium">Summary Report</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    High-level summary with key metrics and trends for management review.
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="font-medium">Trend Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyze trends and patterns in work submissions and performance over time.
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
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
