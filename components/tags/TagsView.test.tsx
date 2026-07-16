// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  current: { status: "idle", folder: null, index: null, error: null } as unknown,
}));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => runtime.current,
}));

import TagsView from "./TagsView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderTags(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(TagsView, { initialTags: [{ name: "demo", count: 2 }] }));
  });
  return { host, root };
}

describe("TagsView runtime source states", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses configured tags while no runtime folder is active", async () => {
    runtime.current = { status: "idle", folder: null, index: null, error: null };
    const { host, root } = await renderTags();

    expect(host.textContent).toContain("#demo");
    act(() => root.unmount());
  });

  it("does not fall back to configured tags while a runtime folder is loading", async () => {
    runtime.current = { status: "loading", folder: "C:/notes", index: null, error: null };
    const { host, root } = await renderTags();

    expect(host.textContent).toContain("Loading local tags");
    expect(host.textContent).not.toContain("#demo");
    act(() => root.unmount());
  });

  it("shows an actionable error instead of demo tags after a runtime failure", async () => {
    runtime.current = {
      status: "error",
      folder: "C:/notes",
      index: null,
      error: "unreadable",
    };
    const { host, root } = await renderTags();

    expect(host.textContent).toContain("Could not read tags from this library");
    expect(host.textContent).not.toContain("#demo");
    expect(host.querySelector('a[href="/integrations"]')?.textContent).toContain("Manage sources");
    act(() => root.unmount());
  });
});
