"use client";

import { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { useThemeMode } from '@/components/layout/theme-provider';

interface WalletRegistrationShellProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function WalletRegistrationShell({ title, description, children }: WalletRegistrationShellProps) {
  const { isDark } = useThemeMode();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden w-full">
      {/* ambient glow accents using KALE accent color */}
      <div className="absolute right-0 top-0 h-1/2 w-1/2" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(149,198,151,0.12) 0%, rgba(0,0,0,0) 60%)' }} />
      <div className="absolute left-0 top-0 h-1/2 w-1/2 -scale-x-100" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(149,198,151,0.12) 0%, rgba(0,0,0,0) 60%)' }} />

      {/* Glass card container */}
      <div className="relative z-10 w-full max-w-md rounded-3xl backdrop-blur-sm border border-border shadow-2xl p-8 bg-gradient-to-r from-black/5 to-black/0 dark:from-white/10 dark:to-[#121212]">
        {/* Logo / mark */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-6 shadow-lg mx-auto">
          <Leaf className="w-6 h-6 text-primary" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-semibold mb-2 text-center">
          {title || 'Farmer Wallet Registration'}
        </h2>
        <p className="text-muted-foreground text-sm text-center mb-6">
          {description || 'Provision a custodial wallet and link your payout address'}
        </p>

        {/* Content slot */}
        {children}
      </div>

      {/* Footer note */}
      <div className="relative z-10 mt-8 text-center text-muted-foreground text-xs">
        <span>Secured by KALE coordination • Audit-grade transparency</span>
      </div>
    </div>
  );
}


