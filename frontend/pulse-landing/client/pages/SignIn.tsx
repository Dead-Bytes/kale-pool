import { useNavigate } from 'react-router-dom';
import SignInPage from '@/components/ui/sign-in';

export default function SignIn() {
  const navigate = useNavigate();

  const handleSignIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/dashboard');
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
      onResetPassword={() => {}}
      onCreateAccount={() => navigate('/auth/signup')}
    />
  );
}


