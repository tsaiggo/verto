"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/components/ui/use-has-mounted";
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
import styles from "./Settings.module.css";

interface Choice<T extends string> {
  value: T;
  label: string;
  description: string;
}

const WIDTH_OPTIONS: Choice<ReadingWidth>[] = [
  { value: "narrow", label: "Narrow", description: "Focused text column" },
  { value: "normal", label: "Normal", description: "Balanced reading width" },
  { value: "wide", label: "Wide", description: "Room for rich MDX" },
  { value: "full", label: "Full", description: "Use available space" },
];

const DENSITY_OPTIONS: Choice<Density>[] = [
  { value: "compact", label: "Compact", description: "Tighter vertical rhythm" },
  { value: "comfortable", label: "Comfortable", description: "Default spacing" },
  { value: "spacious", label: "Spacious", description: "More breathing room" },
];

const TEXT_SIZE_OPTIONS: Choice<ReadingTextSize>[] = [
  { value: "small", label: "Small", description: "More text on screen" },
  { value: "normal", label: "Normal", description: "Default text size" },
  { value: "large", label: "Large", description: "Larger document text" },
  { value: "xlarge", label: "Extra large", description: "Maximum readability" },
];

const FONT_OPTIONS: Choice<FontFamily>[] = [
  { value: "sans", label: "Sans", description: "Clean interface type" },
  { value: "serif", label: "Serif", description: "Book-like document type" },
  { value: "mono", label: "Mono", description: "Fixed-width document type" },
];

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

function notifyReadingSettingsChanged() {
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: STORAGE_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}

export default function ReadingPreferences() {
  const hasMounted = useHasMounted();
  useSyncExternalStore(subscribeStorage, getClientSnapshot, getServerSnapshot);
  const settings = hasMounted ? loadSettings() : DEFAULT_SETTINGS;

  const update = useCallback((patch: Partial<ReadingSettings>) => {
    const next = { ...loadSettings(), ...patch };
    applySettings(next, document.documentElement);
    saveSettings(next);
    notifyReadingSettingsChanged();
  }, []);

  const isDefault =
    settings.width === DEFAULT_SETTINGS.width &&
    settings.density === DEFAULT_SETTINGS.density &&
    settings.textSize === DEFAULT_SETTINGS.textSize &&
    settings.font === DEFAULT_SETTINGS.font;

  return (
    <div>
      <div className={styles.readingHeader}>
        <p>Changes apply immediately to Reader and Help documents on this device.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDefault}
          onClick={() => update(DEFAULT_SETTINGS)}
        >
          Reset defaults
        </Button>
      </div>

      <ChoiceGroup
        name="reading-width"
        label="Document width"
        value={settings.width}
        options={WIDTH_OPTIONS}
        onChange={(width) => update({ width })}
      />
      <ChoiceGroup
        name="reading-density"
        label="Density"
        value={settings.density}
        options={DENSITY_OPTIONS}
        onChange={(density) => update({ density })}
      />
      <ChoiceGroup
        name="reading-text-size"
        label="Text size"
        value={settings.textSize}
        options={TEXT_SIZE_OPTIONS}
        onChange={(textSize) => update({ textSize })}
      />
      <ChoiceGroup
        name="reading-font"
        label="Typeface"
        value={settings.font}
        options={FONT_OPTIONS}
        fontSamples
        onChange={(font) => update({ font })}
      />
    </div>
  );
}

function ChoiceGroup<T extends string>({
  name,
  label,
  value,
  options,
  fontSamples = false,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: readonly Choice<T>[];
  fontSamples?: boolean;
  onChange: (value: T) => void;
}) {
  const columns =
    options.length === 4 ? `${styles.choiceGrid} ${styles.choiceGridFour}` : styles.choiceGrid;

  return (
    <fieldset className={styles.readingGroup}>
      <legend>{label}</legend>
      <div className={columns}>
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <div key={option.value}>
              <input
                id={id}
                className={styles.choiceInput}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <label className={styles.choiceLabel} htmlFor={id}>
                {fontSamples ? (
                  <span className={styles.fontSample} data-font={option.value} aria-hidden>
                    Aa
                  </span>
                ) : null}
                <span className={styles.choiceTitle}>
                  {option.label}
                  <Check className={styles.choiceCheck} aria-hidden />
                </span>
                <span className={styles.choiceDescription}>{option.description}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
