import { useNavigate } from 'react-router-dom';
import SignInPage from '@/components/ui/sign-in';

export default function SignUp() {
  const navigate = useNavigate();

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/dashboard');
  };

  return (
    <SignInPage
      title={<span className="font-light tracking-tighter text-white">Create account</span>}
      description="Start your KALE Pool journey"
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={[
        { avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg', name: 'Sarah Chen', handle: '@sarahdigital', text: 'Seamless and reliable.' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg', name: 'Marcus Johnson', handle: '@marcustech', text: 'Clean design, powerful features.' },
        { avatarSrc: 'https://randomuser.me/api/portraits/men/32.jpg', name: 'David Martinez', handle: '@davidcreates', text: 'Intuitive and helpful.' },
      ]}
      onSignIn={handleCreate}
      onGoogleSignIn={() => navigate('/dashboard')}
      onResetPassword={() => {}}
      onCreateAccount={() => navigate('/auth/signin')}
    />
  );
}


