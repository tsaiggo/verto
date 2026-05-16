'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ThemeChoice = 'light' | 'dark' | 'system';
type AppliedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolveTheme(choice: ThemeChoice): AppliedTheme {
  if (choice !== 'system') return choice;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function ThemeToggle() {
  const mounted = useMounted();
  const [choice, setChoice] = useState<ThemeChoice>('system');

  // Initialize after mount to avoid hydration mismatch.
  useEffect(() => {
    setChoice(readStoredTheme());
  }, []);

  // Apply theme on choice change.
  useEffect(() => {
    if (!mounted) return;
    const applied = resolveTheme(choice);
    document.documentElement.classList.toggle('dark', applied === 'dark');
    if (choice === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, choice);
    }
  }, [choice, mounted]);

  // Track OS-level color-scheme changes when user is on `system`.
  useEffect(() => {
    if (!mounted || choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [choice, mounted]);

  const applied: AppliedTheme = mounted ? resolveTheme(choice) : 'light';
  const Icon = applied === 'dark' ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <Icon
            className="h-4 w-4"
            aria-hidden="true"
            style={{ visibility: mounted ? 'visible' : 'hidden' }}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(v) => setChoice(v as ThemeChoice)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="h-4 w-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="h-4 w-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="h-4 w-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
