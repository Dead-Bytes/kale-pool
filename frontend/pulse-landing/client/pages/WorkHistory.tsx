import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  BarChart3
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockWorkHistory = [
  {
    id: '1',
    farmerId: 'farmer_001',
    blockIndex: 12345,
    nonce: '0x1a2b3c4d',
    status: 'success',
    reward: '1000',
    timestamp: '2024-01-15T10:30:00Z',
    poolerId: 'main_pool',
    processingTime: 1.2
  },
  {
    id: '2',
    farmerId: 'farmer_002',
    blockIndex: 12346,
    nonce: '0x5e6f7g8h',
    status: 'failed',
    reward: '0',
    timestamp: '2024-01-15T10:32:00Z',
    poolerId: 'main_pool',
    processingTime: 0.8
  },
  {
    id: '3',
    farmerId: 'farmer_003',
    blockIndex: 12347,
    nonce: '0x9i0j1k2l',
    status: 'success',
    reward: '1000',
    timestamp: '2024-01-15T10:35:00Z',
    poolerId: 'secondary_pool',
    processingTime: 1.5
  },
  {
    id: '4',
    farmerId: 'farmer_001',
    blockIndex: 12348,
    nonce: '0x3m4n5o6p',
    status: 'success',
    reward: '1000',
    timestamp: '2024-01-15T11:00:00Z',
    poolerId: 'main_pool',
    processingTime: 1.1
  },
  {
    id: '5',
    farmerId: 'farmer_004',
    blockIndex: 12349,
    nonce: '0x7q8r9s0t',
    status: 'failed',
    reward: '0',
    timestamp: '2024-01-15T11:15:00Z',
    poolerId: 'test_pool',
    processingTime: 0.9
  }
];

const mockWorkStats = {
  totalSubmissions: 1250,
  successRate: 94.2,
  avgProcessingTime: 1.3,
  totalRewards: 125000,
  activeFarmers: 45,
  peakHour: '10:00-11:00',
  topFarmer: 'farmer_001'
};

const mockFarmerStats = [
  { farmerId: 'farmer_001', submissions: 45, successRate: 97.8, totalRewards: 45000 },
  { farmerId: 'farmer_002', submissions: 38, successRate: 94.7, totalRewards: 38000 },
  { farmerId: 'farmer_003', submissions: 42, successRate: 95.2, totalRewards: 42000 },
  { farmerId: 'farmer_004', submissions: 35, successRate: 91.4, totalRewards: 35000 },
];

export default function WorkHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poolerFilter, setPoolerFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);

  const currentFarmerId = (typeof window !== 'undefined' && localStorage.getItem('currentFarmerId')) || '';

  const handleExport = () => {
    // Implement CSV/PDF export
    console.log('Exporting work history data...');
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000);
  };

  const filteredWorkHistory = mockWorkHistory
    .filter(work => (currentFarmerId ? work.farmerId === currentFarmerId : true))
    .filter(work => {
    const matchesSearch = work.farmerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         work.blockIndex.toString().includes(searchTerm) ||
                         work.nonce.toLowerCase().includes(searchTerm.toLowerCase());
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
                <p className="text-2xl font-bold">{mockWorkStats.totalSubmissions.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{mockWorkStats.successRate}%</p>
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
                <p className="text-2xl font-bold">{mockWorkStats.avgProcessingTime}s</p>
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
                <p className="text-2xl font-bold">{mockWorkStats.totalRewards.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{mockWorkStats.activeFarmers}</p>
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
                <p className="text-2xl font-bold">{mockWorkStats.peakHour}</p>
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
                      <TableHead>Farmer ID</TableHead>
                      <TableHead>Block Index</TableHead>
                      <TableHead>Nonce</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Pooler</TableHead>
                      <TableHead>Processing Time</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkHistory.map((work) => (
                      <TableRow key={work.id}>
                        <TableCell className="font-mono text-sm">{work.farmerId}</TableCell>
                        <TableCell className="font-mono">{work.blockIndex}</TableCell>
                        <TableCell className="font-mono text-sm">{work.nonce}</TableCell>
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
                        <TableCell className="font-mono">{work.reward}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{work.poolerId}</Badge>
                        </TableCell>
                        <TableCell>{work.processingTime}s</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(work.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
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
                {mockFarmerStats.map((farmer, index) => (
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
                ))}
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
