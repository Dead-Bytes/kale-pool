"use client";

import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '@/components/layout/theme-provider';

export function ThemeToggleFloating() {
  const { isDark, toggle } = useThemeMode();
  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed z-50 bottom-4 right-4 inline-flex items-center justify-center rounded-full border border-border bg-card text-foreground/80 hover:text-foreground shadow px-3 py-2"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="ml-2 hidden sm:inline">{isDark ? 'Light' : 'Dark'} Mode</span>
    </button>
  );
}


