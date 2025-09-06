import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { WalletRegistrationForm, WalletRegistrationStatus } from '@/components/ui/wallet-registration';
import { WalletRegistrationShell } from '@/components/ui/wallet-registration-shell';

export default function WalletRegistration() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Clear localStorage when user is directed to register page
    localStorage.removeItem('kale-pool-user-id');
    localStorage.removeItem('kale-pool-user-response');
    localStorage.removeItem('kale-pool-token');
    localStorage.removeItem('kale-pool-user-email');
    localStorage.removeItem('kale-pool-user-role');
    localStorage.removeItem('kale-pool-farmer-id');
    localStorage.removeItem('kale-pool-wallet-info');
    
    setInitialized(true);
  }, []);

  const handleComplete = (id: string) => {
    setUserId(id);
    // Redirect to dashboard after successful registration
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000); // Small delay to show success state
  };

  if (!initialized) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">Loading...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <WalletRegistrationShell>
      {!userId ? (
        <WalletRegistrationForm onComplete={handleComplete} />
      ) : (
        <Tabs defaultValue="funding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>
          <TabsContent value="funding">
            <WalletRegistrationStatus userId={userId} />
          </TabsContent>
          <TabsContent value="status">
            <WalletRegistrationStatus userId={userId} />
          </TabsContent>
        </Tabs>
      )}
    </WalletRegistrationShell>
  );
}


