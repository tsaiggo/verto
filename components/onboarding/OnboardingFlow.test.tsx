// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  snapshot: "",
  push: vi.fn(),
  updateOnboardingState: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
}));

vi.mock("@/lib/onboarding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding")>();
  return {
    ...actual,
    setupReadinessSnapshot: () => state.snapshot,
    subscribeSetupReadiness: () => () => {},
    updateOnboardingState: state.updateOnboardingState,
  };
});

import OnboardingFlow from "./OnboardingFlow";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function readinessSnapshot(assistantStatus: "none" | "preview" | "ready"): string {
  return JSON.stringify({
    source: true,
    assistant: assistantStatus === "ready",
    assistantStatus,
    library: false,
    reading: false,
    onboarding: {
      skippedSource: false,
      skippedAssistant: false,
      libraryOpened: false,
      completed: false,
    },
  });
}

async function renderReadyStep(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(OnboardingFlow, { step: "ready" }));
    await Promise.resolve();
  });
  return { host, root };
}

describe("OnboardingFlow assistant readiness", () => {
  beforeEach(() => {
    state.push.mockReset();
    state.updateOnboardingState.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("presents the mock provider as a deterministic demo instead of a ready assistant", async () => {
    state.snapshot = readinessSnapshot("preview");
    const { host, root } = await renderReadyStep();

    expect(host.textContent).toContain("Demo assistant");
    expect(host.textContent).toContain("deterministic preview");
    expect(host.textContent).toContain("does not call a live AI provider");
    expect(host.textContent).not.toContain("Assistant ready");
    expect(host.querySelector('a[href="/settings/agent?from=onboarding"]')?.textContent).toContain(
      "Review settings"
    );
    expect(host.querySelector('a[href="/read/demo"]')).toBeNull();
    expect(host.textContent).toContain("Open library");

    act(() => root.unmount());
  });

  it("reserves Assistant ready for a live GitHub provider with a saved key", async () => {
    state.snapshot = readinessSnapshot("ready");
    const { host, root } = await renderReadyStep();

    expect(host.textContent).toContain("Assistant ready");
    expect(host.textContent).toContain("configured GitHub provider");
    expect(host.textContent).not.toContain("Demo assistant");
    expect(host.querySelector('a[href="/settings/agent?from=onboarding"]')).toBeNull();
    expect(host.querySelector('a[href="/read/demo"]')).toBeNull();

    act(() => root.unmount());
  });
});
