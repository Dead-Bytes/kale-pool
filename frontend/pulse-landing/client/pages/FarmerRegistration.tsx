/**
 * Farmer Registration Page
 * Complete registration flow with wallet funding and status monitoring
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterUser, useCheckFunding, useUserStatus } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Copy,
  ExternalLink,
  AlertTriangle,
  Wallet,
  Mail,
  QrCode,
  RefreshCw,
  Clock,
  DollarSign,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface RegistrationFormData {
  email: string;
  password: string;
  externalWallet: string;
}

function QRCodeDisplay({ address }: { address: string }) {
  // Simple QR code placeholder - in real app would use a QR library
  return (
    <div className="w-48 h-48 bg-muted rounded-lg flex flex-col items-center justify-center gap-2 mx-auto">
      <QrCode className="w-16 h-16 text-muted-foreground" />
      <p className="text-xs text-muted-foreground text-center">
        QR Code for<br />{address.slice(0, 8)}...
      </p>
    </div>
  );
}

function FundingStatus({ userId }: { userId: string }) {
  const { data: funding, isLoading, error, refetch } = useCheckFunding(userId);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Address copied to clipboard!' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Failed to check funding status</AlertDescription>
      </Alert>
    );
  }

  const progress = funding ? (funding.balance / funding.minimumRequired) * 100 : 0;
  const isFullyFunded = funding?.funded || false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Wallet Funding Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          {isFullyFunded 
            ? 'Your wallet is funded and ready!' 
            : 'Fund your custodial wallet to continue with registration'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{funding?.balance || 0} XLM</span>
            <span>{funding?.minimumRequired || 10} XLM required</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={isFullyFunded ? 'default' : 'secondary'}>
            {isFullyFunded ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Funded
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Awaiting Funding
              </>
            )}
          </Badge>
          {funding && (
            <span className="text-sm text-muted-foreground">
              Balance: {funding.balance} XLM
            </span>
          )}
        </div>

        {/* Funding Instructions */}
        {!isFullyFunded && funding && (
          <Alert>
            <DollarSign className="w-4 h-4" />
            <AlertDescription>
              Send at least {funding.minimumRequired - funding.balance} XLM to your custodial wallet to complete registration.
            </AlertDescription>
          </Alert>
        )}

        {isFullyFunded && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription className="text-success">
              Wallet successfully funded! You can now browse and join mining pools.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function RegistrationForm({ onRegistrationComplete }: { onRegistrationComplete: (userId: string, response: any) => void }) {
  const [formData, setFormData] = useState<RegistrationFormData>({
    email: '',
    password: '',
    externalWallet: ''
  });
  const [errors, setErrors] = useState<Partial<RegistrationFormData>>({});

  const registerUser = useRegisterUser({
    onSuccess: (data) => {
      onRegistrationComplete(data.userId, data);
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    }
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<RegistrationFormData> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.externalWallet) {
      newErrors.externalWallet = 'External wallet address is required';
    } else if (formData.externalWallet.length < 20) {
      newErrors.externalWallet = 'Please enter a valid wallet address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      registerUser.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Register as Farmer
        </CardTitle>
        <CardDescription>
          Join the KALE Pool network and start earning mining rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="farmer@example.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter a strong password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalWallet">External Wallet Address</Label>
            <Input
              id="externalWallet"
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={formData.externalWallet}
              onChange={(e) => setFormData(prev => ({ ...prev, externalWallet: e.target.value }))}
              className={errors.externalWallet ? 'border-destructive' : ''}
            />
            {errors.externalWallet && (
              <p className="text-sm text-destructive">{errors.externalWallet}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Your personal Stellar wallet address for receiving payouts
            </p>
          </div>

          {registerUser.error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {registerUser.error.message || 'Registration failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={registerUser.isPending}
          >
            {registerUser.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Register
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WalletDisplay({ userResponse }: { userResponse: any }) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Address copied to clipboard!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Your Custodial Wallet
        </CardTitle>
        <CardDescription>
          Fund this wallet with {userResponse.fundingRequired} XLM to complete registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <QRCodeDisplay address={userResponse.custodialWallet.publicKey} />

        {/* Wallet Address */}
        <div className="space-y-2">
          <Label>Wallet Address</Label>
          <div className="flex gap-2">
            <Input
              value={userResponse.custodialWallet.publicKey}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(userResponse.custodialWallet.publicKey)}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Funding Instructions */}
        <Alert>
          <DollarSign className="w-4 h-4" />
          <AlertDescription>
            <strong>Send exactly {userResponse.fundingRequired} XLM</strong> to the address above.
            Your registration will automatically complete once funding is confirmed.
          </AlertDescription>
        </Alert>

        {/* External Links */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="justify-start" asChild>
            <a 
              href={`https://stellar.expert/explorer/testnet/account/${userResponse.custodialWallet.publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Stellar Expert
            </a>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <a 
              href="https://laboratory.stellar.org/#account-creator"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Fund with Stellar Laboratory
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FarmerRegistration() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState<any>(null);
  const navigate = useNavigate();

  // Load from localStorage if exists
  useEffect(() => {
    const savedUserId = localStorage.getItem('kale-pool-user-id');
    const savedUserResponse = localStorage.getItem('kale-pool-user-response');
    
    if (savedUserId && savedUserResponse) {
      setUserId(savedUserId);
      setUserResponse(JSON.parse(savedUserResponse));
    }
  }, []);

  const handleRegistrationComplete = (newUserId: string, response?: any) => {
    setUserId(newUserId);
    localStorage.setItem('kale-pool-user-id', newUserId);
    
    if (response) {
      setUserResponse(response);
      localStorage.setItem('kale-pool-user-response', JSON.stringify(response));
    }

    // Redirect to dashboard after successful registration
    navigate('/dashboard');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Farmer Registration</h1>
        <p className="text-muted-foreground">
          Join the KALE Pool network and start earning rewards from coordinated mining
        </p>
      </div>

      {!userId ? (
        /* Registration Form */
        <div className="max-w-md mx-auto">
          <RegistrationForm
            onRegistrationComplete={(id, response) => {
              handleRegistrationComplete(id, response);
            }}
          />
        </div>
      ) : (
        /* Post-Registration View */
        <Tabs defaultValue="funding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="funding">
            <FundingStatus userId={userId} />
          </TabsContent>

          <TabsContent value="wallet">
            {userResponse ? (
              <WalletDisplay userResponse={userResponse} />
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Wallet information not available. Please re-register if needed.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="status">
            <UserStatusCard userId={userId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function UserStatusCard({ userId }: { userId: string }) {
  const { data: status, isLoading, error } = useUserStatus(userId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Failed to load user status</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Status</CardTitle>
        <CardDescription>
          Overview of your registration and onboarding progress
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Status */}
            <div className="space-y-3">
              <h3 className="font-medium">User Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{status.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={status.user.status === 'funded' ? 'default' : 'secondary'}>
                    {status.user.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{status.user.userId.slice(0, 12)}...</span>
                </div>
              </div>
            </div>

            {/* Farmer Status */}
            <div className="space-y-3">
              <h3 className="font-medium">Farmer Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered:</span>
                  <Badge variant={status.farmer.registered ? 'default' : 'secondary'}>
                    {status.farmer.registered ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {status.farmer.contractAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract:</span>
                    <span className="font-mono text-xs">{status.farmer.contractAddress.slice(0, 12)}...</span>
                  </div>
                )}
                {status.farmer.stakeAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stake:</span>
                    <span>{status.farmer.stakeAmount} XLM</span>
                  </div>
                )}
              </div>
            </div>

            {/* Funding Status */}
            <div className="space-y-3">
              <h3 className="font-medium">Funding Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Required:</span>
                  <span>{status.funding.required} XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current:</span>
                  <span>{status.funding.current} XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Funded:</span>
                  <Badge variant={status.funding.funded ? 'default' : 'secondary'}>
                    {status.funding.funded ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contract Status */}
            <div className="space-y-3">
              <h3 className="font-medium">Contract Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deployed:</span>
                  <Badge variant={status.contract.deployed ? 'default' : 'secondary'}>
                    {status.contract.deployed ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {status.contract.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-mono text-xs">{status.contract.address.slice(0, 12)}...</span>
                  </div>
                )}
                {status.contract.balance && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance:</span>
                    <span>{status.contract.balance} XLM</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
