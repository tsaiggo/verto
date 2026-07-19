import { getAssistantConfig } from "@/lib/ai";
import { loadWebKey } from "@/lib/ai/key-store";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { STORAGE_KEY as READING_SETTINGS_KEY } from "@/lib/reading-settings";
import { loadActiveRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import { loadSubscriptions } from "@/lib/subscriptions";

export const ONBOARDING_KEY = "verto:onboarding:v1";

export interface OnboardingState {
  skippedSource: boolean;
  skippedAssistant: boolean;
  libraryOpened: boolean;
  completed: boolean;
}

export type AssistantSetupStatus = "none" | "preview" | "ready";

export interface SetupReadiness {
  source: boolean;
  /** True only when a live provider is configured and has a usable credential. */
  assistant: boolean;
  /** Distinguishes the deterministic mock preview from a configured live provider. */
  assistantStatus: AssistantSetupStatus;
  library: boolean;
  reading: boolean;
  onboarding: OnboardingState;
}

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  skippedSource: false,
  skippedAssistant: false,
  libraryOpened: false,
  completed: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeOnboardingState(value: unknown): OnboardingState {
  if (!isRecord(value)) return { ...EMPTY_ONBOARDING_STATE };
  return {
    skippedSource: value.skippedSource === true,
    skippedAssistant: value.skippedAssistant === true,
    libraryOpened: value.libraryOpened === true,
    completed: value.completed === true,
  };
}

export function parseOnboardingState(raw: string | null | undefined): OnboardingState {
  if (!raw) return { ...EMPTY_ONBOARDING_STATE };
  try {
    return normalizeOnboardingState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_ONBOARDING_STATE };
  }
}

export function loadOnboardingState(): OnboardingState {
  if (typeof window === "undefined") return { ...EMPTY_ONBOARDING_STATE };
  try {
    return parseOnboardingState(window.localStorage.getItem(ONBOARDING_KEY));
  } catch {
    return { ...EMPTY_ONBOARDING_STATE };
  }
}

export function saveOnboardingState(next: OnboardingState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
    notifyOnboardingChanged();
    return true;
  } catch {
    return false;
  }
}

export function updateOnboardingState(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...loadOnboardingState(), ...patch };
  saveOnboardingState(next);
  return next;
}

export function subscribeSetupReadiness(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", listener);
  window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, listener);
  };
}

export function getSetupReadiness(buildSourceReady = false): SetupReadiness {
  const assistant = getAssistantConfig();
  const assistantStatus: AssistantSetupStatus =
    assistant.kind === "mock"
      ? "preview"
      : assistant.kind === "github" && loadWebKey() !== null
        ? "ready"
        : "none";
  return {
    source:
      buildSourceReady ||
      loadActiveRuntimeLocalFolder() !== null ||
      loadSubscriptions().subscriptions.length > 0,
    assistant: assistantStatus === "ready",
    assistantStatus,
    library: loadOnboardingState().libraryOpened,
    reading:
      typeof window !== "undefined" &&
      (() => {
        try {
          return window.localStorage.getItem(READING_SETTINGS_KEY) !== null;
        } catch {
          return false;
        }
      })(),
    onboarding: loadOnboardingState(),
  };
}

export function setupReadinessSnapshot(buildSourceReady = false): string {
  return JSON.stringify(getSetupReadiness(buildSourceReady));
}

export function parseSetupReadiness(raw: string): SetupReadiness {
  try {
    const value = JSON.parse(raw) as Partial<SetupReadiness>;
    const legacyAssistant = value.assistant === true;
    const assistantStatus: AssistantSetupStatus =
      value.assistantStatus === "none" ||
      value.assistantStatus === "preview" ||
      value.assistantStatus === "ready"
        ? value.assistantStatus
        : legacyAssistant
          ? "ready"
          : "none";
    return {
      source: value.source === true,
      assistant: assistantStatus === "ready",
      assistantStatus,
      library: value.library === true,
      reading: value.reading === true,
      onboarding: normalizeOnboardingState(value.onboarding),
    };
  } catch {
    return {
      source: false,
      assistant: false,
      assistantStatus: "none",
      library: false,
      reading: false,
      onboarding: { ...EMPTY_ONBOARDING_STATE },
    };
  }
}

function notifyOnboardingChanged() {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: ONBOARDING_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
