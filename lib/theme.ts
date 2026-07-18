export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "light" | "dark" | "system";
export type AppliedTheme = "light" | "dark";

function getThemeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThemeChoice(): ThemeChoice {
  const storage = getThemeStorage();
  if (!storage) return "system";
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function persistThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;
  const storage = getThemeStorage();
  if (!storage) throw new Error("Theme storage is unavailable.");
  let mutationFailure: unknown;
  try {
    if (choice === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
  } catch (cause) {
    mutationFailure = cause;
  }

  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    const applied =
      choice === "system" ? stored !== "light" && stored !== "dark" : stored === choice;
    if (applied) return;
  } catch (cause) {
    throw mutationFailure ?? cause;
  }
  throw mutationFailure ?? new Error("Theme choice was not persisted.");
}

export function resolveThemeChoice(choice: ThemeChoice, prefersDark?: boolean): AppliedTheme {
  if (choice !== "system") return choice;
  if (typeof prefersDark === "boolean") return prefersDark ? "dark" : "light";
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function notifyThemeChanged(): void {
  if (typeof window === "undefined") return;
  let event: Event;
  try {
    event = new StorageEvent("storage", { key: THEME_STORAGE_KEY });
  } catch {
    event = new Event("storage");
  }
  try {
    window.dispatchEvent(event);
  } catch {
    // The durable choice is already saved; notification is best-effort.
  }
}
