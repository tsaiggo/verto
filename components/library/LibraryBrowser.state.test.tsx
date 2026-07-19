// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";

const state = vi.hoisted(() => ({
  runtime: null as RuntimeLocalIndexState | null,
  updateOnboarding: vi.fn(),
}));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => state.runtime,
}));

vi.mock("@/components/library/LibraryPageHeader", () => ({
  default: () => null,
}));

vi.mock("@/lib/reading-state", () => ({
  loadReadingState: () => ({ recent: [] }),
  readingStatusLabel: () => "",
}));

vi.mock("@/lib/bookmarks", () => ({
  loadBookmarks: () => [],
  subscribeBookmarks: () => () => {},
  toggleBookmark: vi.fn(),
}));

vi.mock("@/lib/onboarding", () => ({
  loadOnboardingState: () => ({ libraryOpened: true }),
  updateOnboardingState: state.updateOnboarding,
}));

import LibraryBrowser, { type LibraryDoc } from "./LibraryBrowser";
import { libraryTabId } from "./LibraryTabs";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const docs: LibraryDoc[] = [
  {
    title: "Alpha note",
    ext: ".md",
    href: "/read/alpha",
    section: "Workspace",
    tags: ["demo"],
    updatedLabel: "Today",
    updatedISO: "2026-07-17T00:00:00.000Z",
    kind: "note",
  },
  {
    title: "Beta draft",
    ext: ".mdx",
    href: "/read/beta",
    section: "Guides",
    tags: ["guide"],
    updatedLabel: "Yesterday",
    updatedISO: "2026-07-16T00:00:00.000Z",
    kind: "draft",
  },
];

async function renderLibrary(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(LibraryBrowser, {
        docs,
        buildSource: {
          kind: "local",
          name: "Included demo",
          label: "Included demo",
          origin: "bundled",
        },
        bundledSectionCount: 2,
      })
    );
  });
  return { host, root };
}

function control<T extends HTMLInputElement | HTMLSelectElement>(
  host: HTMLElement,
  label: string
): T {
  const match = host.querySelector<T>(`[aria-label="${label}"]`);
  if (!match) throw new Error(`Control not found: ${label}`);
  return match;
}

async function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  await act(async () => {
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })
    );
  });
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent?.trim() === label
  );
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

describe("LibraryBrowser state contracts", () => {
  beforeEach(() => {
    state.runtime = { status: "idle", folder: null, index: null, error: null };
    state.updateOnboarding.mockReset();
    window.history.replaceState(null, "", "/library");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("renders runtime loading as status instead of an empty result", async () => {
    state.runtime = {
      status: "loading",
      folder: "C:/Notes",
      index: null,
      error: null,
    };
    const { host, root } = await renderLibrary();

    const status = host.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Loading local library");
    expect(status?.textContent).toContain("C:/Notes");
    expect(host.textContent).not.toContain("No documents to show");
    expect(host.querySelector('[role="list"][aria-label="Documents"]')).toBeNull();
    act(() => root.unmount());
  });

  it("renders runtime failure as an actionable error instead of an empty result", async () => {
    state.runtime = {
      status: "error",
      folder: "C:/Broken",
      index: null,
      error: "Access denied",
    };
    const { host, root } = await renderLibrary();

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Could not load the local library");
    expect(alert?.textContent).toContain("C:/Broken");
    expect(alert?.querySelector('a[href="/integrations#local-files"]')?.textContent).toContain(
      "Manage sources"
    );
    expect(host.textContent).not.toContain("No documents to show");
    act(() => root.unmount());
  });

  it("writes shareable filters to the URL and clears only known filter keys", async () => {
    window.history.replaceState(null, "", "/library?tag=demo&foo=keep#anchor");
    const { host, root } = await renderLibrary();
    const folder = control<HTMLSelectElement>(host, "Filter by folder");
    const tag = control<HTMLSelectElement>(host, "Filter by tag");
    const query = control<HTMLInputElement>(host, "Search documents");

    expect(tag.value).toBe("demo");
    await changeValue(folder, "Workspace");
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`#${libraryTabId("notes")}`)?.click()
    );
    await changeValue(query, "missing");

    const filtered = new URL(window.location.href);
    expect(filtered.searchParams.get("source")).toBe("Workspace");
    expect(filtered.searchParams.get("tag")).toBe("demo");
    expect(filtered.searchParams.get("tab")).toBe("notes");
    expect(filtered.searchParams.get("q")).toBe("missing");
    expect(filtered.searchParams.get("foo")).toBe("keep");
    expect(filtered.hash).toBe("#anchor");

    await act(async () => button(host, "Clear filters").click());

    const cleared = new URL(window.location.href);
    expect(cleared.searchParams.has("source")).toBe(false);
    expect(cleared.searchParams.has("tag")).toBe(false);
    expect(cleared.searchParams.has("tab")).toBe(false);
    expect(cleared.searchParams.has("q")).toBe(false);
    expect(cleared.searchParams.get("foo")).toBe("keep");
    expect(cleared.hash).toBe("#anchor");
    expect(folder.value).toBe("all");
    expect(tag.value).toBe("all");
    expect(query.value).toBe("");
    expect(host.querySelector<HTMLButtonElement>(`#${libraryTabId("all")}`)?.ariaSelected).toBe(
      "true"
    );
    expect(host.querySelector('[role="list"][aria-label="Documents"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("treats popstate back/forward URLs as canonical after local filter changes", async () => {
    window.history.replaceState(null, "", "/library?source=Workspace&foo=keep#anchor");
    const { host, root } = await renderLibrary();
    const folder = control<HTMLSelectElement>(host, "Filter by folder");
    const tag = control<HTMLSelectElement>(host, "Filter by tag");

    expect(folder.value).toBe("Workspace");
    await changeValue(folder, "Guides");
    expect(folder.value).toBe("Guides");

    await act(async () => {
      window.history.replaceState(null, "", "/library?source=Workspace&tag=demo&foo=keep#anchor");
      window.dispatchEvent(new Event("popstate"));
    });

    expect(folder.value).toBe("Workspace");
    expect(tag.value).toBe("demo");
    expect(host.textContent).toContain("Alpha note");
    expect(host.textContent).not.toContain("Beta draft");
    expect(window.location.search).toContain("foo=keep");
    expect(window.location.hash).toBe("#anchor");
    act(() => root.unmount());
  });
});
