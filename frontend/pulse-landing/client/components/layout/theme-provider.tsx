"use client";

import { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem('kale-theme') as ThemeMode) || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setModeState(saved);
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('kale-theme', next);
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, isDark: mode === 'dark', toggle, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}


