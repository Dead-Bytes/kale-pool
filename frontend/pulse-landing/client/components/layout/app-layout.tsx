/**
 * Main Application Layout for KALE Pool
 * Responsive layout with sidebar navigation and content area
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { SidebarNav } from './sidebar-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
    },
  },
});

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Convert backend role format to lowercase for UI consistency
  const currentRole = user?.role.toLowerCase() as 'farmer' | 'pooler' | 'admin' || 'farmer';

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
        setMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex bg-background">
        {/* Mobile Menu Button */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="bg-background shadow-md"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "flex-shrink-0 transition-all duration-300 ease-in-out z-40",
          // Desktop behavior
          "hidden lg:flex",
          sidebarCollapsed ? "lg:w-16" : "lg:w-72",
          // Mobile behavior
          mobileMenuOpen && "fixed left-0 top-0 h-full w-72 flex lg:relative"
        )}>
          <div className="w-full h-full">
            <SidebarNav 
              currentRole={currentRole} 
              collapsed={sidebarCollapsed && !mobileMenuOpen}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header - only visible on larger screens */}
          <header className="hidden lg:flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="lg:flex hidden"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  KALE Pool Coordination
                </h1>
                <p className="text-sm text-muted-foreground">
                  Plant → Work → Harvest coordination system
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium capitalize">{currentRole} Mode</p>
                <p className="text-xs text-muted-foreground">
                  {currentRole === 'farmer' && 'Participate in mining pools'}
                  {currentRole === 'pooler' && 'Operate mining coordination'}
                  {currentRole === 'admin' && 'System administration'}
                </p>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-background">
            <div className="h-full">
              {children || <Outlet />}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          className: 'bg-card border-border text-card-foreground',
        }}
      />

    </QueryClientProvider>
  );
}

