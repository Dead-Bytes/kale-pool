import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Search, 
  Filter,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Eye,
  Settings,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';

// Mock data - replace with actual API calls
const mockFarmers = [
  {
    farmerId: 'farmer_001',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    status: 'active',
    joinedAt: '2024-01-10T08:30:00Z',
    stake: 50000,
    successRate: 96.8,
    totalEarnings: 12500,
    lastActivity: '2024-01-15T10:30:00Z',
    blocksParticipated: 45,
    avgRewardPerBlock: 278
  },
  {
    farmerId: 'farmer_002',
    name: 'Bob Smith',
    email: 'bob@example.com',
    status: 'active',
    joinedAt: '2024-01-12T14:20:00Z',
    stake: 25000,
    successRate: 94.2,
    totalEarnings: 6800,
    lastActivity: '2024-01-15T09:45:00Z',
    blocksParticipated: 38,
    avgRewardPerBlock: 179
  },
  {
    farmerId: 'farmer_003',
    name: 'Carol Davis',
    email: 'carol@example.com',
    status: 'inactive',
    joinedAt: '2024-01-08T11:15:00Z',
    stake: 75000,
    successRate: 98.1,
    totalEarnings: 18900,
    lastActivity: '2024-01-14T16:20:00Z',
    blocksParticipated: 52,
    avgRewardPerBlock: 363
  },
  {
    farmerId: 'farmer_004',
    name: 'David Wilson',
    email: 'david@example.com',
    status: 'pending',
    joinedAt: '2024-01-15T07:30:00Z',
    stake: 0,
    successRate: 0,
    totalEarnings: 0,
    lastActivity: '2024-01-15T07:30:00Z',
    blocksParticipated: 0,
    avgRewardPerBlock: 0
  },
  {
    farmerId: 'farmer_005',
    name: 'Eve Brown',
    email: 'eve@example.com',
    status: 'active',
    joinedAt: '2024-01-11T16:45:00Z',
    stake: 100000,
    successRate: 97.5,
    totalEarnings: 25600,
    lastActivity: '2024-01-15T11:15:00Z',
    blocksParticipated: 48,
    avgRewardPerBlock: 533
  }
];

const mockFarmerStats = {
  total: 150,
  active: 142,
  inactive: 6,
  pending: 2,
  totalStake: 2500000,
  avgSuccessRate: 95.8,
  totalEarnings: 1250000
};

export default function ManageFarmers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const filteredFarmers = mockFarmers.filter(farmer => {
    const matchesSearch = farmer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         farmer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         farmer.farmerId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || farmer.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-success">Active</Badge>;
      case 'inactive':
        return <Badge variant="destructive">Inactive</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Farmers</h1>
          <p className="text-muted-foreground mt-1">
            View and manage connected farmers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Farmer
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Farmers</p>
                <p className="text-2xl font-bold">{mockFarmerStats.total}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-success">{mockFarmerStats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Stake</p>
                <p className="text-2xl font-bold">{mockFarmerStats.totalStake.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold">{mockFarmerStats.avgSuccessRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search farmers by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedStatus('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={selectedStatus === 'active' ? 'default' : 'outline'}
                onClick={() => setSelectedStatus('active')}
                size="sm"
              >
                Active
              </Button>
              <Button
                variant={selectedStatus === 'inactive' ? 'default' : 'outline'}
                onClick={() => setSelectedStatus('inactive')}
                size="sm"
              >
                Inactive
              </Button>
              <Button
                variant={selectedStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setSelectedStatus('pending')}
                size="sm"
              >
                Pending
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Farmer List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Farmers ({filteredFarmers.length})</CardTitle>
              <CardDescription>
                Manage individual farmer accounts and monitor their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredFarmers.map((farmer) => (
                  <div key={farmer.farmerId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{farmer.name}</h3>
                          {getStatusIcon(farmer.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{farmer.email}</p>
                        <p className="text-xs text-muted-foreground font-mono">{farmer.farmerId}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">{farmer.stake.toLocaleString()} stake</p>
                        <p className="text-xs text-muted-foreground">{farmer.successRate}% success</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{farmer.totalEarnings.toLocaleString()} earned</p>
                        <p className="text-xs text-muted-foreground">{farmer.blocksParticipated} blocks</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(farmer.status)}
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Earnings Distributed</span>
                  <span className="font-bold">{mockFarmerStats.totalEarnings.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average Success Rate</span>
                  <span className="font-bold">{mockFarmerStats.avgSuccessRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Farmers</span>
                  <span className="font-bold text-success">{mockFarmerStats.active}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Inactive Farmers</span>
                  <span className="font-bold text-destructive">{mockFarmerStats.inactive}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending Approval</span>
                  <span className="font-bold text-warning">{mockFarmerStats.pending}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockFarmers
                    .filter(f => f.status === 'active')
                    .sort((a, b) => b.totalEarnings - a.totalEarnings)
                    .slice(0, 5)
                    .map((farmer, index) => (
                      <div key={farmer.farmerId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{farmer.name}</p>
                            <p className="text-xs text-muted-foreground">{farmer.successRate}% success</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{farmer.totalEarnings.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{farmer.blocksParticipated} blocks</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Farmer Management Settings</CardTitle>
              <CardDescription>
                Configure farmer onboarding and management policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Onboarding Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure how new farmers can join the pool
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Auto-approve Settings
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Requirements
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Performance Monitoring</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set thresholds and alerts for farmer performance
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Alert Thresholds
                    </Button>
                    <Button variant="outline" size="sm">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Performance Metrics
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Communication</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage notifications and communications with farmers
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Notification Settings
                    </Button>
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4 mr-2" />
                      Bulk Actions
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg border-destructive/20">
                  <h3 className="font-medium mb-2 text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Irreversible actions for farmer management
                  </p>
                  <div className="flex gap-3">
                    <Button variant="destructive" size="sm">
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove Inactive Farmers
                    </Button>
                    <Button variant="destructive" size="sm">
                      <XCircle className="w-4 h-4 mr-2" />
                      Suspend All Farmers
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
