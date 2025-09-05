import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail, Shield, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRegisterUser } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface FarmerRegistrationPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onRegistrationComplete?: (userId: string, response?: any) => void;
  onSignIn?: () => void;
}

interface RegistrationFormData {
  email: string;
  password: string;
  externalWallet: string;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors focus-within:border-[#95c697]/70 focus-within:bg-[#95c697]/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => (
  <div className={`${delay} flex items-start gap-3 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium text-white">{testimonial.name}</p>
      <p className="text-white/60">{testimonial.handle}</p>
      <p className="mt-1 text-white/80">{testimonial.text}</p>
    </div>
  </div>
);

export const FarmerRegistrationPage: React.FC<FarmerRegistrationPageProps> = ({
  title = <span className="font-light tracking-tighter text-foreground">Join as Farmer</span>,
  description = "Register to start earning mining rewards with KALE Pool",
  heroImageSrc,
  testimonials = [],
  onRegistrationComplete,
  onSignIn,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormData>({
    email: '',
    password: '',
    externalWallet: ''
  });
  const [errors, setErrors] = useState<Partial<RegistrationFormData>>({});
  const { toast } = useToast();

  const registerUser = useRegisterUser({
    onSuccess: (data) => {
      onRegistrationComplete?.(data.userId, data);
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem('kale-theme');
    const dark = saved === 'dark';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kale-theme', next ? 'dark' : 'light');
  };

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validateForm()) {
      registerUser.mutate(formData);
    }
  };

  const handleInputChange = (field: keyof RegistrationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef2f7_100%)] dark:bg-[linear-gradient(135deg,_#121212_0%,_#171717_100%)]">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-50 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/60 px-3 py-2 text-xs text-black dark:text-white shadow-sm hover:bg-white dark:hover:bg-black"
        aria-label="Toggle theme"
      >
        {isDark ? 'Light mode' : 'Dark mode'}
      </button>

      {/* Left column: registration form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-foreground">{title}</h1>
            <p className="text-muted-foreground">{description}</p>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                    <input 
                      name="email" 
                      type="email" 
                      placeholder="farmer@example.com" 
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full bg-transparent text-sm pl-12 pr-4 py-4 rounded-2xl focus:outline-none text-foreground placeholder:text-foreground/40 ${errors.email ? 'border-red-500' : ''}`}
                    />
                  </div>
                </GlassInputWrapper>
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/60" />
                    <input 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Enter a strong password" 
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={`w-full bg-transparent text-sm pl-12 pr-12 py-4 rounded-2xl focus:outline-none text-foreground placeholder:text-foreground/40 ${errors.password ? 'border-red-500' : ''}`}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5 text-foreground/60 hover:text-foreground transition-colors" /> : <Eye className="w-5 h-5 text-foreground/60 hover:text-foreground transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              {/* External Wallet Field */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">External Wallet Address</label>
                <GlassInputWrapper>
                  <input 
                    name="externalWallet" 
                    type="text" 
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" 
                    value={formData.externalWallet}
                    onChange={(e) => handleInputChange('externalWallet', e.target.value)}
                    className={`w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-foreground placeholder:text-foreground/40 ${errors.externalWallet ? 'border-red-500' : ''}`}
                  />
                </GlassInputWrapper>
                {errors.externalWallet && (
                  <p className="text-sm text-red-500 mt-1">{errors.externalWallet}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Your personal Stellar wallet address for receiving payouts
                </p>
              </div>

              {/* Error Display */}
              {registerUser.error && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{registerUser.error.message || 'Registration failed. Please try again.'}</span>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={registerUser.isPending}
                className="w-full rounded-2xl bg-[#95c697] py-4 font-medium text-black hover:bg-[#7ba87d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {registerUser.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Register as Farmer
                  </>
                )}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-transparent absolute">Already have an account?</span>
            </div>

            <button 
              onClick={onSignIn} 
              className="w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors text-foreground"
            >
              Sign In Instead
            </button>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="" /></div>}
              {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default FarmerRegistrationPage;
