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
import { Mail, Shield, QrCode, Copy, RefreshCw, DollarSign, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletRegistrationFormData {
  email: string;
  externalWallet: string;
}

export function WalletRegistrationForm({ onComplete }: { onComplete: (userId: string, response?: any) => void }) {
  const [formData, setFormData] = useState<WalletRegistrationFormData>({ email: '', externalWallet: '' });
  const [errors, setErrors] = useState<Partial<WalletRegistrationFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: Partial<WalletRegistrationFormData> = {};
    if (!formData.email) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Enter a valid email';

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
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/.netlify/functions/api'}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Registration failed');
      }
      const data = await res.json();
      if (data?.userId) {
        localStorage.setItem('kale-pool-user-id', data.userId);
      }
      if (data) localStorage.setItem('kale-pool-user-response', JSON.stringify(data));
      onComplete(data.userId, data);
    } catch (err: any) {
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
            <Label htmlFor="externalWallet">External Stellar Wallet</Label>
            <Input id="externalWallet" value={formData.externalWallet} onChange={(e) => setFormData(p => ({ ...p, externalWallet: e.target.value }))} className={errors.externalWallet ? 'border-destructive' : ''} placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
            {errors.externalWallet && <p className="text-sm text-destructive">{errors.externalWallet}</p>}
            <p className="text-xs text-muted-foreground">Your personal Stellar address for payouts</p>
          </div>
          {submitError && (
            <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Registering...</> : 'Register'}
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


