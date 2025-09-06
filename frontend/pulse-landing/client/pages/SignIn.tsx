import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import SignInPage from '@/components/ui/sign-in';

export default function SignIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      // Step 1: Login and get token
      const loginResponse = await apiClient.login(email, password);
      
      if (loginResponse.token) {
        // Step 2: Refresh user context (calls /auth/me internally)
        await refreshUser();
        
        // Step 3: Get user info from context after refresh
        const userResponse = await apiClient.getMe();
        
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${userResponse.user.email}!`,
          variant: 'default'
        });

        // Step 4: Navigate to appropriate page based on user role
        const userRole = userResponse.user.role;
        switch (userRole) {
          case 'FARMER':
            navigate('/dashboard');
            break;
          case 'POOLER':
            navigate('/pooler-console');
            break;
          case 'ADMIN':
            navigate('/admin');
            break;
          default:
            navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SignInPage
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={[
        { avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg', name: 'Sarah Chen', handle: '@sarahdigital', text: 'Seamless and reliable.' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg', name: 'Marcus Johnson', handle: '@marcustech', text: 'Clean design, powerful features.' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/32.jpg', name: 'David Martinez', handle: '@davidcreates', text: 'Intuitive and helpful.' },
      ]}
      onSignIn={handleSignIn}
      isLoading={isLoading}
      onResetPassword={() => {}}
      onCreateAccount={() => navigate('/farmer/wallet')}
    />
  );
}


