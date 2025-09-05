/**
 * Sidebar Navigation Component for KALE Pool
 * Modern sidebar with role-based navigation and theme switching
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLogout } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Activity,
  BarChart3,
  Construction,
  Database,
  HardHat,
  Home,
  Leaf,
  LogOut,
  Network,
  Pickaxe,
  Settings,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  roles?: ('farmer' | 'pooler' | 'admin')[];
}

const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        description: 'System health and overview',
      },
      {
        title: 'Network Status',
        href: '/network',
        icon: Network,
        description: 'Blockchain network information',
      },
    ],
  },
  {
    title: 'Farmer Portal',
    roles: ['farmer', 'admin'],
    items: [
      {
        title: 'Pool Discovery',
        href: '/farmer/pools',
        icon: Database,
        description: 'Browse and join pools',
      },
      {
        title: 'My Pool',
        href: '/farmer/my-pool',
        icon: Leaf,
        description: 'Current pool status',
      },
      {
        title: 'Work History',
        href: '/farmer/work-history',
        icon: HardHat,
        description: 'Your work submissions and rewards',
      },
    ],
  },
  {
    title: 'Pooler Console',
    roles: ['pooler', 'admin'],
    items: [
      {
        title: 'Pool Operator Portal',
        href: '/pool-operator',
        icon: Construction,
        description: 'Advanced pool management tools',
      },
      {
        title: 'Block Notifications',
        href: '/pooler/blocks',
        icon: Zap,
        description: 'Monitor block discoveries',
      },
      {
        title: 'Pooler Status',
        href: '/pooler/status',
        icon: Activity,
        description: 'Connection and performance',
      },
      {
        title: 'Manage Farmers',
        href: '/pooler/farmers',
        icon: Users,
        description: 'View connected farmers',
      },
    ],
  },
  {
    title: 'Block Operations',
    roles: ['pooler', 'admin'],
    items: [
      {
        title: 'Plant',
        href: '/operations/plant',
        icon: Leaf,
        description: 'Initialize farmer contracts',
      },
      {
        title: 'Work',
        href: '/operations/work',
        icon: Pickaxe,
        description: 'Process nonce submissions',
      },
      {
        title: 'Harvest',
        href: '/operations/harvest',
        icon: Truck,
        description: 'Collect rewards',
      },
    ],
  },
  {
    title: 'Analytics',
    roles: ['pooler', 'admin'],
    items: [
      {
        title: 'Performance',
        href: '/analytics/performance',
        icon: BarChart3,
        description: 'Pool performance metrics',
      },
      {
        title: 'Work History',
        href: '/analytics/work',
        icon: HardHat,
        description: 'Historical work data',
      },
    ],
  },
];

interface SidebarNavProps {
  currentRole: 'farmer' | 'pooler' | 'admin';
  collapsed?: boolean;
}

export function SidebarNav({ currentRole, collapsed = false }: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout({
    onSuccess: () => {
      navigate('/');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      navigate('/');
    }
  });


  const filteredNavigation = navigation.filter(section => 
    !section.roles || section.roles.includes(currentRole)
  );

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">KALE Pool</h1>
              <p className="text-xs text-sidebar-foreground/60">Coordination System</p>
            </div>
          )}
        </div>
      </div>


      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredNavigation.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <h2 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-3">
                {section.title}
              </h2>
            )}
            <nav className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                        : "text-sidebar-foreground/70",
                      item.disabled && "opacity-50 pointer-events-none",
                      collapsed && "justify-center"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {/* User Profile */}
        {!collapsed && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {currentRole[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {currentRole === 'farmer' && 'Farmer User'}
                  {currentRole === 'pooler' && 'Pool Operator'}
                  {currentRole === 'admin' && 'Administrator'}
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  {currentRole === 'farmer' && 'Stake & Harvest'}
                  {currentRole === 'pooler' && 'Coordinate Pools'}
                  {currentRole === 'admin' && 'System Admin'}
                </p>
              </div>

            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logout.isPending ? 'Signing out...' : 'Sign Out'}
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="w-full justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>

        )}
      </div>
    </div>
  );
}
