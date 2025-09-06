"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Mail, Shield, QrCode, Copy, RefreshCw, DollarSign, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletRegistrationFormData {
  email: string;
  password: string;
  externalWallet: string;
}

export function WalletRegistrationForm({ onComplete }: { onComplete: (userId: string, response?: any) => void }) {
  const [formData, setFormData] = useState<WalletRegistrationFormData>({ email: '', password: '', externalWallet: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<WalletRegistrationFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const validate = (): boolean => {
    const next: Partial<WalletRegistrationFormData> = {};
    if (!formData.email) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Enter a valid email';

    if (!formData.password) next.password = 'Password is required';
    else if (formData.password.length < 8) next.password = 'Password must be at least 8 characters';

    if (!formData.externalWallet) next.externalWallet = 'External wallet is required';
    else if (!/^G[A-Z0-9]{55}$/.test(formData.externalWallet)) next.externalWallet = 'Enter a valid Stellar address';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      console.log('Making request to:', `${apiUrl}/register-farmer`);
      
      const res = await fetch(`${apiUrl}/register-farmer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);
      
      // Check if response is HTML (error page) instead of JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        throw new Error(`Server returned HTML instead of JSON. Status: ${res.status}. Check if backend is running.`);
      }
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Registration failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Registration response:', data);
      
      if (data?.data?.userId) {
        localStorage.setItem('kale-pool-user-id', data.data.userId);
        localStorage.setItem('kale-pool-token', data.data.token);
        localStorage.setItem('kale-pool-user-email', formData.email);
        localStorage.setItem('kale-pool-user-role', 'farmer');
        localStorage.setItem('kale-pool-farmer-id', data.data.farmerId);
      }
      
      if (data) localStorage.setItem('kale-pool-user-response', JSON.stringify(data));
      setRegistrationSuccess(true);
      onComplete(data.data?.userId || data.userId, data);
    } catch (err: any) {
      console.error('Registration error:', err);
      setSubmitError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Farmer Wallet Registration
        </CardTitle>
        <CardDescription>Provision a custodial wallet and link your payout address</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className={errors.email ? 'border-destructive' : ''} placeholder="farmer@example.com" />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                value={formData.password} 
                onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} 
                className={cn("pr-10", errors.password ? 'border-destructive' : '')} 
                placeholder="Enter your password" 
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="externalWallet">External Stellar Wallet</Label>
            <Input id="externalWallet" value={formData.externalWallet} onChange={(e) => setFormData(p => ({ ...p, externalWallet: e.target.value }))} className={errors.externalWallet ? 'border-destructive' : ''} placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
            {errors.externalWallet && <p className="text-sm text-destructive">{errors.externalWallet}</p>}
            <p className="text-xs text-muted-foreground">Your personal Stellar address for payouts</p>
          </div>
          {submitError && (
            <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
          )}
          {registrationSuccess && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Registration successful! Redirecting to dashboard...
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={submitting || registrationSuccess}>
            {submitting ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Registering...</>
            ) : registrationSuccess ? (
              <><CheckCircle className="w-4 h-4 mr-2" />Registration Complete!</>
            ) : (
              'Register'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function WalletRegistrationStatus({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funded, setFunded] = useState(false);
  const [balance, setBalance] = useState(0);
  const [minimumRequired, setMinimumRequired] = useState(10);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Address copied to clipboard!' });
  };

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '/.netlify/functions/api';
      const res = await fetch(`${base}/check-funding?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error('Failed to load funding status');
      const data = await res.json();
      setFunded(Boolean(data.funded));
      setBalance(Number(data.balance || 0));
      setMinimumRequired(Number(data.minimumRequired || 10));
      const stored = localStorage.getItem('kale-pool-user-response');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPublicKey(parsed?.custodialWallet?.publicKey || parsed?.custodialWallet);
        } catch {}
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Wallet Status</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  }

  const progress = Math.min(100, Math.round((balance / minimumRequired) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Custodial Wallet</CardTitle>
        <CardDescription>{funded ? 'Wallet funded and ready' : 'Fund your custodial wallet to continue'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Placeholder */}
        {publicKey && (
          <div className="w-full max-w-xs mx-auto p-4 rounded-lg bg-muted flex flex-col items-center gap-2">
            <QrCode className="w-12 h-12 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">{publicKey.slice(0, 8)}...{publicKey.slice(-6)}</p>
          </div>
        )}

        {publicKey && (
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="flex gap-2">
              <Input value={publicKey} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(publicKey)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Funding Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{balance} XLM</span>
            <span>{minimumRequired} XLM required</span>
          </div>
        </div>

        {!funded ? (
          <Alert>
            <DollarSign className="w-4 h-4" />
            <AlertDescription>Send at least {Math.max(0, minimumRequired - balance)} XLM to your custodial wallet to complete registration.</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription className="text-success">Wallet funded! You can now join pools.</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={load}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


