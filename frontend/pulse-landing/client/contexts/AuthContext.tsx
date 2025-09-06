import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  role: 'FARMER' | 'POOLER' | 'ADMIN';
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = apiClient.getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.getMe();
      setUser(response.user);
      
      // Update localStorage with latest user data
      if (response.user) {
        const user = response.user;
        localStorage.setItem('kale-pool-user-id', user.id);
        localStorage.setItem('kale-pool-user-email', user.email);
        localStorage.setItem('kale-pool-user-role', user.role.toLowerCase());
        
        // Store farmer-specific ID if user is a farmer and farmer data exists
        if (user.role.toLowerCase() === 'farmer' && user.farmer?.id) {
          localStorage.setItem('kale-pool-farmer-id', user.farmer.id);
        }
        
        // Store user status if available
        if (user.status) {
          localStorage.setItem('kale-pool-user-status', user.status);
        }
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
      // Clear invalid token
      apiClient.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}