import { useNavigate } from 'react-router-dom';
import FarmerRegistrationPage from '@/components/ui/farmer-registration';

export default function SignUp() {
  const navigate = useNavigate();

  const handleRegistrationComplete = (userId: string, response?: any) => {
    // Store all required user data in localStorage
    localStorage.setItem('kale-pool-user-id', userId);
    
    if (response) {
      // Store full response
      localStorage.setItem('kale-pool-user-response', JSON.stringify(response));
      
      // Store individual important fields for easy access
      if (response.farmerId) {
        localStorage.setItem('kale-pool-farmer-id', response.farmerId);
      }
      if (response.email) {
        localStorage.setItem('kale-pool-user-email', response.email);
      }
      if (response.custodialWallet) {
        localStorage.setItem('kale-pool-custodial-wallet', response.custodialWallet);
      }
      if (response.token) {
        localStorage.setItem('kale-pool-token', response.token);
      }
      if (response.role) {
        localStorage.setItem('kale-pool-user-role', response.role);
      }
      if (response.status) {
        localStorage.setItem('kale-pool-user-status', response.status);
      }
    }
    
    // Navigate to dashboard after successful registration
    navigate('/dashboard');
  };

  const handleSignIn = () => {
    navigate('/auth/signin');
  };

  return (
    <FarmerRegistrationPage
      title={<span className="font-light tracking-tighter text-foreground">Join as Farmer</span>}
      description="Register to start earning mining rewards with KALE Pool"
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={[
        { avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg', name: 'Sarah Chen', handle: '@sarahdigital', text: 'Earning 2,500 XLM weekly!' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg', name: 'Marcus Johnson', handle: '@marcustech', text: 'Best mining pool I\'ve joined.' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/32.jpg', name: 'David Martinez', handle: '@davidcreates', text: 'Reliable and profitable.' },
      ]}
      onRegistrationComplete={handleRegistrationComplete}
      onSignIn={handleSignIn}
    />
  );
}


