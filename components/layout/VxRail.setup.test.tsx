// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentDirNode } from "@/lib/content-source";

const state = vi.hoisted(() => ({ snapshot: "" }));

vi.mock("next/navigation", () => ({ usePathname: () => "/library" }));
vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => ({ status: "idle", folder: null, index: null, error: null }),
}));
vi.mock("@/lib/bookmarks", () => ({
  loadBookmarks: () => [],
  subscribeBookmarks: () => () => {},
}));
vi.mock("@/lib/inbox", () => ({
  getInboxAttentionCount: () => 0,
  loadInbox: () => ({ items: [] }),
  subscribeInbox: () => () => {},
}));
vi.mock("@/lib/onboarding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding")>();
  return {
    ...actual,
    setupReadinessSnapshot: () => state.snapshot,
    subscribeSetupReadiness: () => () => {},
  };
});

import VxRail from "./VxRail";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const emptyRoot: ContentDirNode = {
  type: "dir",
  slug: [],
  href: "/read/",
  title: "Home",
  children: [],
};

function setupSnapshot(assistantStatus: "preview" | "ready"): string {
  return JSON.stringify({
    source: true,
    assistant: assistantStatus === "ready",
    assistantStatus,
    library: true,
    reading: true,
    onboarding: {},
  });
}

async function renderRail(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(VxRail, {
        root: emptyRoot,
        source: { kind: "local", name: "Local Library", label: "Local library" },
      })
    );
  });
  return { host, root };
}

describe("VxRail assistant setup truth", () => {
  beforeEach(() => {
    state.snapshot = setupSnapshot("preview");
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows the demo assistant without completing the live-provider task", async () => {
    const { host, root } = await renderRail();
    const card = host.querySelector<HTMLElement>(".codex-setup-card");
    const agentTask = card?.querySelector<HTMLAnchorElement>('a[href="/settings/agent"]');

    expect(card?.textContent).toContain("Demo assistant available");
    expect(card?.textContent).not.toContain("Assistant ready");
    expect(card?.textContent).toContain("3 of 4");
    expect(agentTask?.querySelector("svg")?.classList.contains("is-done")).toBe(false);

    act(() => root.unmount());
  });

  it("hides the setup card once every task is complete", async () => {
    state.snapshot = setupSnapshot("ready");
    const { host, root } = await renderRail();

    expect(host.querySelector(".codex-setup-card")).toBeNull();

    act(() => root.unmount());
  });
});
