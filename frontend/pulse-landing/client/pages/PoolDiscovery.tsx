/**
 * Pool Discovery Page
 * Browse, filter, and join mining pools with detailed performance metrics
 */

import { useState, useEffect } from 'react';
import { usePoolers, usePoolerDetails, useJoinPool, useConfirmJoin } from '@/hooks/use-api';
import { useAuth } from '@/contexts/AuthContext';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PoolerSummary, PoolerDetails, FilterParams } from '@shared/api';
import {
  Search,
  Filter,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Clock,
  Star,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Database,
  Activity,
  Percent,
  Zap,
} from 'lucide-react';

interface PoolFilters extends FilterParams {
  minReward?: number;
  maxFees?: number;
  minSuccessRate?: number;
  status?: string;
}

function PoolCard({ pool, onViewDetails, onJoinPool }: {
  pool: PoolerSummary;
  onViewDetails: (poolerId: string) => void;
  onJoinPool: (poolerId: string) => void;
}) {
  const capacityPercentage = (pool.currentFarmers / pool.maxFarmers) * 100;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{pool.name}</CardTitle>
            <CardDescription className="mt-1">{pool.description}</CardDescription>
          </div>
          <Badge variant={pool.status === 'active' ? 'default' : 'secondary'}>
            {pool.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{pool.rewardPercentage}%</div>
            <div className="text-xs text-muted-foreground">Reward Share</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-success">{pool.successRate}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Capacity</span>
            <span>{pool.currentFarmers}/{pool.maxFarmers} farmers</span>
          </div>
          <Progress value={capacityPercentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{pool.averageRewardHuman} XLM</div>
              <div className="text-xs text-muted-foreground">Avg Reward</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{pool.totalStakedHuman} XLM</div>
              <div className="text-xs text-muted-foreground">Total Staked</div>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fees:</span>
          <span>Standard pool fees</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onViewDetails(pool.id)}>
            View Details
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => onJoinPool(pool.id)}
            disabled={pool.status !== 'active' || capacityPercentage >= 100}
          >
            {capacityPercentage >= 100 ? 'Pool Full' : 'Join Pool'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PoolDetailsModal({ poolerId, open, onOpenChange }: {
  poolerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: details, isLoading, error } = usePoolerDetails(poolerId || '', undefined, {
    enabled: !!poolerId && open,
    queryKey: ['poolerDetails', poolerId, undefined]
  });

  if (!poolerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pool Details</DialogTitle>
          <DialogDescription>
            Comprehensive information about this mining pool
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>Failed to load pool details</AlertDescription>
          </Alert>
        )}

        {details && (
          <div className="space-y-6">
            {/* Pool Overview */}
            <div>
              <h3 className="text-lg font-semibold mb-3">{details.name}</h3>
              <p className="text-muted-foreground mb-4">{details.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{details.rewardPercentage}%</div>
                    <div className="text-sm text-muted-foreground">Reward Share</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-success">{details.successRate}%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-chart-2">{details.performance.uptime}%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h4 className="font-medium mb-3">Performance Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-bold">{details.performance.totalBlocksMined}</div>
                  <div className="text-xs text-muted-foreground">Total Blocks Mined</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-bold">{details.statistics.totalRewards}</div>
                  <div className="text-xs text-muted-foreground">Total Rewards (XLM)</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-bold">{details.performance.averageBlockTime}s</div>
                  <div className="text-xs text-muted-foreground">Avg Block Time</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-bold">{details.statistics.farmersActive}</div>
                  <div className="text-xs text-muted-foreground">Active Farmers</div>
                </div>
              </div>
            </div>

            {/* Terms and Fees */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Pool Terms</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Stake:</span>
                    <span>{details.terms.minimumStake}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Harvest Policy:</span>
                    <span>{details.terms.harvestPolicy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exit Delay:</span>
                    <span>{details.terms.exitDelay} blocks</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Statistics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Staked:</span>
                    <span>{details.statistics.totalStaked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Farmers Joined:</span>
                    <span>{details.statistics.farmersJoined}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime:</span>
                    <span>{details.performance.uptime}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JoinPoolModal({ poolerId, open, onOpenChange, onSuccess }: {
  poolerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [stakePercentage, setStakePercentage] = useState([0]);
  const [harvestInterval, setHarvestInterval] = useState('24');
  const [step, setStep] = useState<'configure' | 'confirm' | 'success'>('configure');
  const [joinResponse, setJoinResponse] = useState<any>(null);
  
  const { toast } = useToast();
  const { user: currentUser, isLoading: userLoading, isAuthenticated } = useAuth();
  
  const joinPool = useJoinPool({
    onSuccess: (data) => {
      setJoinResponse(data);
      setStep('confirm');
    },
    onError: (error) => {
      toast({
        title: 'Join Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const confirmJoin = useConfirmJoin({
    onSuccess: (data) => {
      if (data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 2000);
      }
    },
    onError: (error) => {
      toast({
        title: 'Confirmation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Backend expects 1-20 blocks
  const validateBlocks = (blocks: number): number => {
    return Math.max(1, Math.min(blocks, 20));
  };

  const handleJoin = () => {
    if (!poolerId) return;
    
    if (userLoading) {
      toast({
        title: 'Loading',
        description: 'Please wait while we verify your authentication.',
        variant: 'default'
      });
      return;
    }
    
    if (!isAuthenticated || !currentUser?.id) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in first.',
        variant: 'destructive'
      });
      return;
    }

    const blocksRequested = parseInt(harvestInterval);
    const blocksToSend = validateBlocks(blocksRequested);

    joinPool.mutate({
      userId: currentUser.id,
      poolerId,
      stakePercentage: stakePercentage[0] / 100, // Convert percentage to decimal
      harvestInterval: blocksToSend
    });
  };

  const handleConfirm = () => {
    if (joinResponse?.contractId) {
      confirmJoin.mutate({
        contractId: joinResponse.contractId,
        confirmed: true
      });
    }
  };

  const resetModal = () => {
    setStep('configure');
    setJoinResponse(null);
    setStakePercentage([0]);
    setHarvestInterval('24');
  };

  useEffect(() => {
    if (!open) {
      setTimeout(resetModal, 300);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Join Mining Pool</DialogTitle>
          <DialogDescription>
            Configure your participation settings
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Stake Percentage: {stakePercentage[0]}%</Label>
              <Slider
                value={stakePercentage}
                onValueChange={setStakePercentage}
                max={25}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="25"
                  value={stakePercentage[0]}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(25, parseInt(e.target.value) || 0));
                    setStakePercentage([value]);
                  }}
                  className="w-20 text-center"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of your balance to stake in this pool (0-25%)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="harvest-interval">Harvest Interval</Label>
              <Select value={harvestInterval} onValueChange={setHarvestInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 block</SelectItem>
                  <SelectItem value="6">6 blocks</SelectItem>
                  <SelectItem value="12">12 blocks</SelectItem>
                  <SelectItem value="20">20 blocks (max)</SelectItem>
                </SelectContent>
              </Select>
            </div>


            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleJoin} disabled={joinPool.isPending}>
                {joinPool.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Pool'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && joinResponse && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Pool join request created successfully!
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">Confirmation Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract ID:</span>
                  <span className="font-mono text-xs">{joinResponse.contractId.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stake:</span>
                  <span>{joinResponse.terms?.stakePercentage ?? '-'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Harvest Interval:</span>
                  <span>{joinResponse.terms?.harvestInterval ?? '-'} blocks</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={confirmJoin.isPending}>
                {confirmJoin.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm & Activate'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Pool Joined Successfully!</h3>
              <p className="text-muted-foreground mt-1">
                You are now an active member and will start earning rewards.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PoolDiscovery() {
  const [filters, setFilters] = useState<PoolFilters>({
    page: 1,
    limit: 6,
    search: '',
  });
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const { data: poolsData, isLoading, error, refetch } = usePoolers(
    undefined, // userId - could be passed for personalization
    filters
  );

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  };

  const handleViewDetails = (poolerId: string) => {
    setSelectedPoolId(poolerId);
    setDetailsModalOpen(true);
  };

  const handleJoinPool = (poolerId: string) => {
    setSelectedPoolId(poolerId);
    setJoinModalOpen(true);
  };

  const handleJoinSuccess = () => {
    refetch();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pool Discovery</h1>
          <p className="text-muted-foreground">
            Browse and join mining pools to start earning rewards
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pools by name or description..."
                  value={filters.search || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filters.status || 'all'} onValueChange={(value) => 
                setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value, page: 1 }))
              }>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Failed to load pools. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pools Grid */}
      {poolsData && poolsData.data && poolsData.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {poolsData.data.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onViewDetails={handleViewDetails}
              onJoinPool={handleJoinPool}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {poolsData && poolsData.data && poolsData.data.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Pools Found</h3>
            <p className="text-muted-foreground mb-4">
              {filters.search ? 'Try adjusting your search terms.' : 'No mining pools are available at the moment.'}
            </p>
            {filters.search && (
              <Button variant="outline" onClick={() => handleSearch('')}>
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {poolsData && poolsData.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={poolsData.pagination.page <= 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {poolsData.pagination.page} of {poolsData.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={poolsData.pagination.page >= poolsData.pagination.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Modals */}
      <PoolDetailsModal
        poolerId={selectedPoolId}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />

      <JoinPoolModal
        poolerId={selectedPoolId}
        open={joinModalOpen}
        onOpenChange={setJoinModalOpen}
        onSuccess={handleJoinSuccess}
      />
    </div>
  );
}
