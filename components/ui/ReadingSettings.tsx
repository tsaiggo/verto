"use client";

import { useCallback, useSyncExternalStore, type KeyboardEvent } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  STORAGE_KEY,
  type Density,
  type FontFamily,
  type ReadingSettings,
  type ReadingTextSize,
  type ReadingWidth,
} from "@/lib/reading-settings";
import { cn } from "@/lib/utils";
import { useHasMounted } from "@/components/ui/use-has-mounted";

const WIDTH_OPTIONS: { value: ReadingWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

const TEXT_SIZE_OPTIONS: { value: ReadingTextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "XL" },
];

const FONT_OPTIONS: { value: FontFamily; label: string; sample: string }[] = [
  { value: "sans", label: "Sans", sample: "Aa" },
  { value: "serif", label: "Serif", sample: "Aa" },
  { value: "mono", label: "Mono", sample: "Aa" },
];

function handleRadioGroupKeyDown<T extends string>(
  event: KeyboardEvent<HTMLDivElement>,
  options: readonly { value: T }[],
  onChange: (value: T) => void
) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const current = event.target;
  if (!(current instanceof HTMLButtonElement) || current.getAttribute("role") !== "radio") return;

  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  );
  const currentIndex = radios.indexOf(current);
  if (currentIndex < 0) return;

  let nextIndex: number;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (currentIndex - 1 + radios.length) % radios.length;
      break;
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = (currentIndex + 1) % radios.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = radios.length - 1;
      break;
    default:
      return;
  }

  const nextOption = options[nextIndex];
  if (!nextOption) return;

  event.preventDefault();
  onChange(nextOption.value);
  radios[nextIndex]?.focus();
}

// — External-store integration ————————————————————————
// Following the same pattern as ThemeToggle: we treat `localStorage` as the
// source of truth, listen for the synthetic 'storage' event to know when
// to re-read, and provide an SSR-safe server snapshot. This avoids the
// React 19 anti-pattern of calling setState in useEffect.

function getServerSnapshot(): string {
  return "";
}

function getClientSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

/** Trigger button + popover that lets users tweak reading preferences. */
export default function ReadingSettings() {
  const hasMounted = useHasMounted();
  // Subscribe to the raw storage string. We parse on render — useSyncExternalStore
  // can rely on cheap string equality for change detection.
  // The subscription's return value is intentionally unused: it only exists
  // to trigger re-renders. We read the parsed settings via `loadSettings()`
  // below so that the live `localStorage` value is always authoritative.
  useSyncExternalStore(subscribeStorage, getClientSnapshot, getServerSnapshot);
  const settings: ReadingSettings = hasMounted ? loadSettings() : DEFAULT_SETTINGS;

  const update = useCallback((patch: Partial<ReadingSettings>) => {
    const current = loadSettings();
    const next: ReadingSettings = { ...current, ...patch };
    if (typeof document !== "undefined") {
      applySettings(next, document.documentElement);
    }
    saveSettings(next);
    notifyChange();
  }, []);

  const reset = useCallback(() => update(DEFAULT_SETTINGS), [update]);

  if (!hasMounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        aria-label="Reading settings"
        title="Reading settings"
        disabled
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Reading settings</span>
      </Button>
    );
  }

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
      <PopoverContent
        align="end"
        className="reading-settings-popover w-[360px] max-w-[calc(100vw-24px)] rounded-xl px-4 py-[18px]"
        data-testid="reading-settings-popover"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <h2 className="reading-settings-title text-base font-semibold leading-none">
            Reading settings
          </h2>
          <button
            type="button"
            onClick={reset}
            className="reading-settings-reset rounded-md px-1 text-[13px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2"
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

        <Section label="Text size">
          <SegmentedGroup
            ariaLabel="Reading text size"
            value={settings.textSize}
            options={TEXT_SIZE_OPTIONS}
            onChange={(v) => update({ textSize: v })}
          />
        </Section>

        <Section label="Font">
          <div
            role="radiogroup"
            aria-label="Reading font"
            aria-orientation="horizontal"
            className="grid grid-cols-3 gap-2.5"
            onKeyDown={(event) =>
              handleRadioGroupKeyDown(event, FONT_OPTIONS, (font) => update({ font }))
            }
          >
            {FONT_OPTIONS.map((opt) => {
              const active = settings.font === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => update({ font: opt.value })}
                  className={cn(
                    "reading-settings-font-option flex h-16 flex-col items-center justify-center gap-1 rounded-[10px] border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2",
                    active && "is-active"
                  )}
                  style={{
                    fontFamily:
                      opt.value === "serif"
                        ? "var(--font-reading-serif)"
                        : opt.value === "mono"
                          ? "var(--font-reading-mono)"
                          : "var(--font-reading-sans)",
                  }}
                >
                  <span className="text-[22px] leading-none">{opt.sample}</span>
                  <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.05em]">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="reading-settings-label mb-2.5 text-[11px] font-semibold uppercase leading-none tracking-[0.08em]">
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
      aria-orientation="horizontal"
      className="reading-settings-segmented flex h-9 rounded-[10px] border p-0.5"
      onKeyDown={(event) => handleRadioGroupKeyDown(event, options, onChange)}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "reading-settings-option flex-1 rounded-[7px] px-2 text-[13px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2",
              active && "is-active"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
