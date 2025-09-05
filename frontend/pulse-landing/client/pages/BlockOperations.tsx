/**
 * Block Operations Page
 * Coordinate Plant → Work → Harvest operations for mining blocks
 */

import { useState } from 'react';
import { usePlant, useWork, useHarvest } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PlantRequest,
  PlantResponse,
  WorkRequest,
  WorkResponse,
  HarvestRequest,
  HarvestResponse,
  WorkSubmission
} from '@shared/api';
import {
  Leaf,
  Pickaxe,
  Truck,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Activity,
  ArrowRight,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';

interface OperationResult {
  type: 'plant' | 'work' | 'harvest';
  data: PlantResponse | WorkResponse | HarvestResponse;
  timestamp: string;
}

function PlantOperation() {
  const [blockIndex, setBlockIndex] = useState('');
  const [poolerId, setPoolerId] = useState('pool-stellar-01');
  const [maxFarmers, setMaxFarmers] = useState('25');
  const [result, setResult] = useState<PlantResponse | null>(null);

  const { toast } = useToast();
  
  const plant = usePlant({
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: 'Plant Operation Complete',
        description: `Successfully planted ${data.successfulPlants.length} farmers`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Plant Operation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockIndex || !poolerId || !maxFarmers) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive'
      });
      return;
    }

    const request: PlantRequest = {
      blockIndex: parseInt(blockIndex),
      poolerId,
      maxFarmersCapacity: parseInt(maxFarmers)
    };

    plant.mutate(request);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-success" />
            Plant Operation
          </CardTitle>
          <CardDescription>
            Initialize farmer contracts for a new block discovery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plant-block">Block Index</Label>
                <Input
                  id="plant-block"
                  type="number"
                  value={blockIndex}
                  onChange={(e) => setBlockIndex(e.target.value)}
                  placeholder="12345"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plant-pooler">Pooler ID</Label>
                <Select value={poolerId} onValueChange={setPoolerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pool-stellar-01">Stellar Pool Alpha</SelectItem>
                    <SelectItem value="pool-horizon-02">Horizon Pool Beta</SelectItem>
                    <SelectItem value="pool-testnet-03">TestNet Pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plant-farmers">Max Farmers</Label>
                <Input
                  id="plant-farmers"
                  type="number"
                  value={maxFarmers}
                  onChange={(e) => setMaxFarmers(e.target.value)}
                  placeholder="25"
                  min="1"
                  max="50"
                />
              </div>
            </div>

            <Button type="submit" disabled={plant.isPending} className="w-full">
              {plant.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Planting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Plant Operation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Plant Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Plant Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold">{result.totalRequested}</div>
                <div className="text-xs text-muted-foreground">Requested</div>
              </div>
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <div className="text-xl font-bold text-success">{result.successfulPlants.length}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{result.failedPlants.length}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-xl font-bold text-primary">{result.totalStaked}</div>
                <div className="text-xs text-muted-foreground">Total Staked</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Processed in {result.processingTimeMs}ms • {new Date(result.timestamp).toLocaleString()}
            </div>

            {/* Success Details */}
            {result.successfulPlants.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-success">Successful Plants</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.successfulPlants.slice(0, 5).map((plant, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-success/5 rounded">
                      <span className="font-mono">{plant.farmerId.slice(0, 12)}...</span>
                      <span>{plant.stakeAmount} XLM</span>
                    </div>
                  ))}
                  {result.successfulPlants.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      + {result.successfulPlants.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Failure Details */}
            {result.failedPlants.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Failed Plants</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.failedPlants.slice(0, 3).map((plant, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-destructive/5 rounded">
                      <span className="font-mono">{plant.farmerId.slice(0, 12)}...</span>
                      <span className="text-destructive">{plant.error}</span>
                    </div>
                  ))}
                  {result.failedPlants.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      + {result.failedPlants.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WorkOperation() {
  const [blockIndex, setBlockIndex] = useState('');
  const [poolerId, setPoolerId] = useState('pool-stellar-01');
  const [submissions, setSubmissions] = useState<WorkSubmission[]>([
    { farmerId: '', nonce: '', blockIndex: 0, timestamp: 0 }
  ]);
  const [result, setResult] = useState<WorkResponse | null>(null);

  const { toast } = useToast();
  
  const work = useWork({
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: 'Work Operation Complete',
        description: `Processed ${data.totalSubmissions} submissions, ${data.validNonces.length} valid`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Work Operation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const addSubmission = () => {
    setSubmissions([...submissions, { farmerId: '', nonce: '', blockIndex: 0, timestamp: 0 }]);
  };

  const removeSubmission = (index: number) => {
    setSubmissions(submissions.filter((_, i) => i !== index));
  };

  const updateSubmission = (index: number, field: keyof WorkSubmission, value: string | number) => {
    const updated = [...submissions];
    updated[index] = { ...updated[index], [field]: value };
    setSubmissions(updated);
  };

  const generateSampleSubmissions = () => {
    const sampleSubmissions: WorkSubmission[] = Array.from({ length: 5 }, (_, i) => ({
      farmerId: `farmer_${i + 1}_${Math.random().toString(36).substr(2, 8)}`,
      nonce: `0x${Math.random().toString(16).substr(2, 16)}`,
      blockIndex: parseInt(blockIndex) || 12345,
      timestamp: Date.now() - Math.floor(Math.random() * 60000)
    }));
    setSubmissions(sampleSubmissions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockIndex || !poolerId) {
      toast({
        title: 'Validation Error',
        description: 'Block index and pooler ID are required',
        variant: 'destructive'
      });
      return;
    }

    const validSubmissions = submissions.filter(s => s.farmerId && s.nonce);
    if (validSubmissions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one valid submission is required',
        variant: 'destructive'
      });
      return;
    }

    const request: WorkRequest = {
      blockIndex: parseInt(blockIndex),
      poolerId,
      submissions: validSubmissions.map(s => ({
        ...s,
        blockIndex: parseInt(blockIndex),
        timestamp: s.timestamp || Date.now()
      }))
    };

    work.mutate(request);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-chart-2" />
            Work Operation
          </CardTitle>
          <CardDescription>
            Process nonce submissions from farmers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="work-block">Block Index</Label>
                <Input
                  id="work-block"
                  type="number"
                  value={blockIndex}
                  onChange={(e) => setBlockIndex(e.target.value)}
                  placeholder="12345"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="work-pooler">Pooler ID</Label>
                <Select value={poolerId} onValueChange={setPoolerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pool-stellar-01">Stellar Pool Alpha</SelectItem>
                    <SelectItem value="pool-horizon-02">Horizon Pool Beta</SelectItem>
                    <SelectItem value="pool-testnet-03">TestNet Pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Submissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Work Submissions</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={generateSampleSubmissions}>
                    <Upload className="w-4 h-4 mr-2" />
                    Generate Sample
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addSubmission}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Submission
                  </Button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {submissions.map((submission, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                    <div className="col-span-4">
                      <Label className="text-xs">Farmer ID</Label>
                      <Input
                        placeholder="farmer_123..."
                        value={submission.farmerId}
                        onChange={(e) => updateSubmission(index, 'farmerId', e.target.value)}
                      />
                    </div>
                    <div className="col-span-6">
                      <Label className="text-xs">Nonce</Label>
                      <Input
                        placeholder="0xabc123..."
                        value={submission.nonce}
                        onChange={(e) => updateSubmission(index, 'nonce', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubmission(index)}
                        disabled={submissions.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={work.isPending} className="w-full">
              {work.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing Work...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Work Operation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Work Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Work Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold">{result.totalSubmissions}</div>
                <div className="text-xs text-muted-foreground">Total Submissions</div>
              </div>
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <div className="text-xl font-bold text-success">{result.validNonces.length}</div>
                <div className="text-xs text-muted-foreground">Valid Nonces</div>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{result.invalidNonces.length}</div>
                <div className="text-xs text-muted-foreground">Invalid Nonces</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-xl font-bold text-primary">{result.totalRewards}</div>
                <div className="text-xs text-muted-foreground">Total Rewards</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Processed in {result.processingTimeMs}ms • {new Date(result.timestamp).toLocaleString()}
            </div>

            {/* Valid Nonces */}
            {result.validNonces.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-success">Valid Nonces</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.validNonces.slice(0, 5).map((nonce, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-success/5 rounded">
                      <span className="font-mono">{nonce.farmerId.slice(0, 12)}...</span>
                      <span>{nonce.reward} XLM</span>
                    </div>
                  ))}
                  {result.validNonces.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      + {result.validNonces.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HarvestOperation() {
  const [blockIndex, setBlockIndex] = useState('');
  const [poolerId, setPoolerId] = useState('pool-stellar-01');
  const [result, setResult] = useState<HarvestResponse | null>(null);

  const { toast } = useToast();
  
  const harvest = useHarvest({
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: 'Harvest Operation Complete',
        description: `Distributed ${data.totalRewards} XLM to ${data.successfulHarvests.length} farmers`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Harvest Operation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockIndex || !poolerId) {
      toast({
        title: 'Validation Error',
        description: 'Block index and pooler ID are required',
        variant: 'destructive'
      });
      return;
    }

    const request: HarvestRequest = {
      blockIndex: parseInt(blockIndex),
      poolerId
    };

    harvest.mutate(request);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-warning" />
            Harvest Operation
          </CardTitle>
          <CardDescription>
            Collect and distribute mining rewards to farmers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="harvest-block">Block Index</Label>
                <Input
                  id="harvest-block"
                  type="number"
                  value={blockIndex}
                  onChange={(e) => setBlockIndex(e.target.value)}
                  placeholder="12345"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="harvest-pooler">Pooler ID</Label>
                <Select value={poolerId} onValueChange={setPoolerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pool-stellar-01">Stellar Pool Alpha</SelectItem>
                    <SelectItem value="pool-horizon-02">Horizon Pool Beta</SelectItem>
                    <SelectItem value="pool-testnet-03">TestNet Pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <DollarSign className="w-4 h-4" />
              <AlertDescription>
                This will distribute rewards to all eligible farmers who participated in the work phase.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={harvest.isPending} className="w-full">
              {harvest.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Harvesting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Harvest Operation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Harvest Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Harvest Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold">{result.totalEligible}</div>
                <div className="text-xs text-muted-foreground">Eligible Farmers</div>
              </div>
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <div className="text-xl font-bold text-success">{result.successfulHarvests.length}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <div className="text-xl font-bold text-destructive">{result.failedHarvests.length}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-xl font-bold text-primary">{result.totalRewards}</div>
                <div className="text-xs text-muted-foreground">Total Distributed</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Processed in {result.processingTimeMs}ms • {new Date(result.timestamp).toLocaleString()}
            </div>

            {/* Successful Harvests */}
            {result.successfulHarvests.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-success">Successful Harvests</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.successfulHarvests.slice(0, 5).map((harvest, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-success/5 rounded">
                      <span className="font-mono">{harvest.farmerId.slice(0, 12)}...</span>
                      <span>{harvest.reward} XLM</span>
                    </div>
                  ))}
                  {result.successfulHarvests.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      + {result.successfulHarvests.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BlockOperations() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Block Operations</h1>
        <p className="text-muted-foreground">
          Coordinate Plant → Work → Harvest operations for mining blocks
        </p>
      </div>

      {/* Operations Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Operation Flow</CardTitle>
          <CardDescription>
            The three-stage process for coordinating mining operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 p-4">
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
              <Leaf className="w-5 h-5 text-success" />
              <span className="font-medium">1. Plant</span>
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-chart-2/10 rounded-lg">
              <Pickaxe className="w-5 h-5 text-chart-2" />
              <span className="font-medium">2. Work</span>
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
              <Truck className="w-5 h-5 text-warning" />
              <span className="font-medium">3. Harvest</span>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Initialize contracts → Process work submissions → Distribute rewards
          </div>
        </CardContent>
      </Card>

      {/* Operation Tabs */}
      <Tabs defaultValue="plant" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plant" className="flex items-center gap-2">
            <Leaf className="w-4 h-4" />
            Plant
          </TabsTrigger>
          <TabsTrigger value="work" className="flex items-center gap-2">
            <Pickaxe className="w-4 h-4" />
            Work
          </TabsTrigger>
          <TabsTrigger value="harvest" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Harvest
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plant">
          <PlantOperation />
        </TabsContent>

        <TabsContent value="work">
          <WorkOperation />
        </TabsContent>

        <TabsContent value="harvest">
          <HarvestOperation />
        </TabsContent>
      </Tabs>
    </div>
  );
}
