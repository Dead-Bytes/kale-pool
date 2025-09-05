import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { WalletRegistrationForm, WalletRegistrationStatus } from '@/components/ui/wallet-registration';
import { WalletRegistrationShell } from '@/components/ui/wallet-registration-shell';

export default function WalletRegistration() {
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('kale-pool-user-id');
    if (saved) setUserId(saved);
    setInitialized(true);
  }, []);

  const handleComplete = (id: string) => {
    setUserId(id);
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


