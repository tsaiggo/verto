/**
 * Reading settings — exposes existing design tokens (width, density, font
 * family, accent hue) as user-controllable preferences.
 *
 * The defaults match the historical Verto visuals exactly: when every
 * setting is at its default the page renders identically to before this
 * module existed. Settings are persisted to `localStorage` and applied as
 * `data-*` attributes on `<html>` so plain CSS selectors can react.
 */

export const STORAGE_KEY = 'reading-settings';

export type ReadingWidth = 'narrow' | 'normal' | 'wide' | 'full';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type ReadingTextSize = 'small' | 'normal' | 'large' | 'xlarge';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type AccentHue =
  | 'blue'
  | 'teal'
  | 'green'
  | 'purple'
  | 'orange'
  | 'rose';

export interface ReadingSettings {
  width: ReadingWidth;
  density: Density;
  textSize: ReadingTextSize;
  font: FontFamily;
  accent: AccentHue;
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  width: 'normal',
  density: 'comfortable',
  textSize: 'normal',
  font: 'sans',
  accent: 'blue',
};

// Allow-lists used by both the parser and the applier so that any value
// outside the supported set is silently ignored (forward compatibility).
const WIDTHS: readonly ReadingWidth[] = [
  'narrow',
  'normal',
  'wide',
  'full',
] as const;
const DENSITIES: readonly Density[] = [
  'compact',
  'comfortable',
  'spacious',
] as const;
const TEXT_SIZES: readonly ReadingTextSize[] = [
  'small',
  'normal',
  'large',
  'xlarge',
] as const;
const FONTS: readonly FontFamily[] = ['sans', 'serif', 'mono'] as const;
const ACCENTS: readonly AccentHue[] = [
  'blue',
  'teal',
  'green',
  'purple',
  'orange',
  'rose',
] as const;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Coerce an arbitrary parsed value into a valid {@link ReadingSettings}. */
export function normalizeSettings(value: unknown): ReadingSettings {
  const raw = (value ?? {}) as Partial<Record<keyof ReadingSettings, unknown>>;
  return {
    width: isOneOf(raw.width, WIDTHS) ? raw.width : DEFAULT_SETTINGS.width,
    density: isOneOf(raw.density, DENSITIES)
      ? raw.density
      : DEFAULT_SETTINGS.density,
    textSize: isOneOf(raw.textSize, TEXT_SIZES)
      ? raw.textSize
      : DEFAULT_SETTINGS.textSize,
    font: isOneOf(raw.font, FONTS) ? raw.font : DEFAULT_SETTINGS.font,
    accent: isOneOf(raw.accent, ACCENTS) ? raw.accent : DEFAULT_SETTINGS.accent,
  };
}

/** Parse a JSON string into a valid {@link ReadingSettings}, never throws. */
export function parseSettings(json: string | null | undefined): ReadingSettings {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Apply a settings object to the document by toggling `data-*` attributes
 * on the `<html>` element. Attributes are removed when the value equals
 * the default so the cascade falls back to the original token values.
 */
export function applySettings(
  settings: ReadingSettings,
  root: HTMLElement,
): void {
  const set = (attr: string, value: string, fallback: string) => {
    if (value === fallback) root.removeAttribute(attr);
    else root.setAttribute(attr, value);
  };
  set('data-reading-width', settings.width, DEFAULT_SETTINGS.width);
  set('data-density', settings.density, DEFAULT_SETTINGS.density);
  set('data-text-size', settings.textSize, DEFAULT_SETTINGS.textSize);
  set('data-font', settings.font, DEFAULT_SETTINGS.font);
  set('data-accent', settings.accent, DEFAULT_SETTINGS.accent);
}

/** Read settings from `localStorage`. SSR-safe (returns defaults). */
export function loadSettings(): ReadingSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  return parseSettings(window.localStorage.getItem(STORAGE_KEY));
}

/** Persist settings to `localStorage` (no-op on the server). */
export function saveSettings(settings: ReadingSettings): void {
  if (typeof window === 'undefined') return;
  // Drop entries that match the default so a fresh install / reset removes
  // the key entirely (keeps the storage tidy and predictable).
  const isDefault =
    settings.width === DEFAULT_SETTINGS.width &&
    settings.density === DEFAULT_SETTINGS.density &&
    settings.textSize === DEFAULT_SETTINGS.textSize &&
    settings.font === DEFAULT_SETTINGS.font &&
    settings.accent === DEFAULT_SETTINGS.accent;
  if (isDefault) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

/**
 * Inline init script applied before first paint to prevent a flash of
 * default styles. Generated from {@link DEFAULT_SETTINGS} so the default
 * values live in exactly one place.
 */
export const READING_SETTINGS_INIT_SCRIPT = `
(function(){try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(!s)return;var v=JSON.parse(s);var d=document.documentElement;var set=function(a,x,f){if(!x||x===f){d.removeAttribute(a);}else{d.setAttribute(a,x);}};set('data-reading-width',v.width,${JSON.stringify(DEFAULT_SETTINGS.width)});set('data-density',v.density,${JSON.stringify(DEFAULT_SETTINGS.density)});set('data-text-size',v.textSize,${JSON.stringify(DEFAULT_SETTINGS.textSize)});set('data-font',v.font,${JSON.stringify(DEFAULT_SETTINGS.font)});set('data-accent',v.accent,${JSON.stringify(DEFAULT_SETTINGS.accent)});}catch(e){}})();
`.trim();
