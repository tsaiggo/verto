import { beforeEach, describe, expect, it, vi } from "vitest";

const readinessMocks = vi.hoisted(() => ({
  getAssistantConfig: vi.fn(() => ({ kind: "mock" })),
  loadWebKey: vi.fn(() => null),
  loadActiveRuntimeLocalFolder: vi.fn(() => null as string | null),
  loadSubscriptions: vi.fn(() => ({ subscriptions: [] })),
}));

vi.mock("@/lib/ai", () => ({ getAssistantConfig: readinessMocks.getAssistantConfig }));
vi.mock("@/lib/ai/key-store", () => ({ loadWebKey: readinessMocks.loadWebKey }));
vi.mock("@/lib/runtime-local-folder", () => ({
  loadActiveRuntimeLocalFolder: readinessMocks.loadActiveRuntimeLocalFolder,
}));
vi.mock("@/lib/subscriptions", () => ({ loadSubscriptions: readinessMocks.loadSubscriptions }));

import {
  EMPTY_ONBOARDING_STATE,
  getSetupReadiness,
  normalizeOnboardingState,
  parseOnboardingState,
  parseSetupReadiness,
} from "@/lib/onboarding";

describe("onboarding state", () => {
  beforeEach(() => {
    readinessMocks.getAssistantConfig.mockReturnValue({ kind: "mock" });
    readinessMocks.loadWebKey.mockReturnValue(null);
    readinessMocks.loadActiveRuntimeLocalFolder.mockReturnValue(null);
    readinessMocks.loadSubscriptions.mockReturnValue({ subscriptions: [] });
  });

  it("normalizes persisted booleans without trusting unrelated values", () => {
    expect(
      normalizeOnboardingState({
        skippedSource: true,
        skippedAssistant: "yes",
        libraryOpened: 1,
        completed: true,
      })
    ).toEqual({
      skippedSource: true,
      skippedAssistant: false,
      libraryOpened: false,
      completed: true,
    });
  });

  it("recovers from malformed state", () => {
    expect(parseOnboardingState("not json")).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseSetupReadiness("not json")).toEqual({
      source: false,
      assistant: false,
      library: false,
      reading: false,
      onboarding: EMPTY_ONBOARDING_STATE,
    });
  });

  it("only marks a local source ready when the runtime can still read it", () => {
    expect(getSetupReadiness().source).toBe(false);

    readinessMocks.loadActiveRuntimeLocalFolder.mockReturnValue("C:/Notes");
    expect(getSetupReadiness().source).toBe(true);
  });
});
