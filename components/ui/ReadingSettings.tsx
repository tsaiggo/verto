'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  STORAGE_KEY,
  type AccentHue,
  type Density,
  type FontFamily,
  type ReadingSettings,
  type ReadingWidth,
} from '@/lib/reading-settings';
import { cn } from '@/lib/utils';

const WIDTH_OPTIONS: { value: ReadingWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

const FONT_OPTIONS: { value: FontFamily; label: string; sample: string }[] = [
  { value: 'sans', label: 'Sans', sample: 'Aa' },
  { value: 'serif', label: 'Serif', sample: 'Aa' },
  { value: 'mono', label: 'Mono', sample: 'Aa' },
];

const ACCENT_OPTIONS: { value: AccentHue; label: string; swatch: string }[] = [
  { value: 'blue', label: 'Blue', swatch: '#2563eb' },
  { value: 'teal', label: 'Teal', swatch: '#0d9488' },
  { value: 'green', label: 'Green', swatch: '#16a34a' },
  { value: 'purple', label: 'Purple', swatch: '#7c3aed' },
  { value: 'orange', label: 'Orange', swatch: '#ea580c' },
  { value: 'rose', label: 'Rose', swatch: '#e11d48' },
];

// — External-store integration ————————————————————————
// Following the same pattern as ThemeToggle: we treat `localStorage` as the
// source of truth, listen for the synthetic 'storage' event to know when
// to re-read, and provide an SSR-safe server snapshot. This avoids the
// React 19 anti-pattern of calling setState in useEffect.

function getServerSnapshot(): string {
  return '';
}

function getClientSnapshot(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) ?? '';
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function notifyChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
}

/** Trigger button + popover that lets users tweak reading preferences. */
export default function ReadingSettings() {
  // Subscribe to the raw storage string. We parse on render — useSyncExternalStore
  // can rely on cheap string equality for change detection.
  // The subscription's return value is intentionally unused: it only exists
  // to trigger re-renders. We read the parsed settings via `loadSettings()`
  // below so that the live `localStorage` value is always authoritative.
  useSyncExternalStore(
    subscribeStorage,
    getClientSnapshot,
    getServerSnapshot,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const settings: ReadingSettings = mounted ? loadSettings() : DEFAULT_SETTINGS;

  const update = useCallback((patch: Partial<ReadingSettings>) => {
    const current = loadSettings();
    const next: ReadingSettings = { ...current, ...patch };
    if (typeof document !== 'undefined') {
      applySettings(next, document.documentElement);
    }
    saveSettings(next);
    notifyChange();
  }, []);

  const reset = useCallback(() => update(DEFAULT_SETTINGS), [update]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Reading settings"
          title="Reading settings"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Reading settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Reading settings
          </h2>
          <button
            type="button"
            onClick={reset}
            disabled={!mounted}
            className="text-xs text-text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        <Section label="Width">
          <SegmentedGroup
            ariaLabel="Reading width"
            value={settings.width}
            options={WIDTH_OPTIONS}
            onChange={(v) => update({ width: v })}
          />
        </Section>

        <Section label="Density">
          <SegmentedGroup
            ariaLabel="Reading density"
            value={settings.density}
            options={DENSITY_OPTIONS}
            onChange={(v) => update({ density: v })}
          />
        </Section>

        <Section label="Font">
          <div role="radiogroup" aria-label="Reading font" className="flex gap-1.5">
            {FONT_OPTIONS.map((opt) => {
              const active = settings.font === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ font: opt.value })}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-transparent px-2 py-2 text-text-muted transition-colors hover:bg-accent hover:text-foreground',
                    active &&
                      'border-foreground/40 bg-bg-muted text-foreground',
                  )}
                  style={{
                    fontFamily:
                      opt.value === 'serif'
                        ? 'var(--font-reading-serif)'
                        : opt.value === 'mono'
                          ? 'var(--font-reading-mono)'
                          : 'var(--font-reading-sans)',
                  }}
                >
                  <span className="text-base leading-none">{opt.sample}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Accent">
          <div role="radiogroup" aria-label="Accent hue" className="flex flex-wrap gap-2">
            {ACCENT_OPTIONS.map((opt) => {
              const active = settings.accent === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={opt.label}
                  title={opt.label}
                  onClick={() => update({ accent: opt.value })}
                  className={cn(
                    'h-7 w-7 rounded-full border border-border transition-transform hover:scale-110',
                    active && 'ring-2 ring-offset-2 ring-offset-popover',
                  )}
                  style={{
                    background: opt.swatch,
                    // Use the swatch as the ring color so the indicator
                    // matches the active hue (rather than the global --ring
                    // var, which itself is following the accent change).
                    ...(active
                      ? ({ '--tw-ring-color': opt.swatch } as React.CSSProperties)
                      : null),
                  }}
                />
              );
            })}
          </div>
        </Section>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function SegmentedGroup<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex rounded-md border border-border p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-bg-muted text-foreground'
                : 'text-text-muted hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
