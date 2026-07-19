// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: runtimeMock,
}));

import HomeDashboard from "@/components/home/HomeDashboard";
import type { HomeWorkspaceData } from "@/components/home/home-data";
import type { SourceInfo } from "@/lib/source-info";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const staticData: HomeWorkspaceData = {
  groups: [
    {
      title: "Demo",
      href: "/read/demo",
      total: 1,
      items: [],
    },
  ],
  recentDocs: [
    {
      href: "/read/demo",
      title: "Demo document",
      section: "Demo",
      iso: "2026-07-18T00:00:00.000Z",
      relative: "Today",
    },
  ],
  starters: [{ href: "/read/demo", title: "Demo document", section: "Demo" }],
  readableHrefs: ["/read/demo"],
};

const BUNDLED_SOURCE: SourceInfo = {
  kind: "local",
  name: "Included demo",
  label: "Included demo",
  origin: "bundled",
};

async function renderDashboard(
  source: SourceInfo = BUNDLED_SOURCE
): Promise<{ host: HTMLElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(HomeDashboard, { staticData, source }));
  });
  return { host, root };
}

describe("HomeDashboard product truth", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() {
          return values.size;
        },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
    window.localStorage.clear();
    runtimeMock.mockReset();
    runtimeMock.mockReturnValue({
      status: "idle",
      folder: null,
      index: null,
      error: null,
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("shows real persisted reading, bookmark, and inbox state without a staged transcript", async () => {
    window.localStorage.setItem(
      "verto:reading-state",
      JSON.stringify({
        recent: [
          {
            href: "/read/demo",
            slug: ["demo"],
            title: "Read me again",
            path: "demo.mdx",
            lastReadAt: "2026-07-18T00:00:00.000Z",
            progress: 42,
            scrollTop: 320,
          },
        ],
      })
    );
    window.localStorage.setItem(
      "verto:bookmarks",
      JSON.stringify([
        {
          href: "/read/demo",
          title: "Important document",
          kind: "document",
          addedAt: "2026-07-18T00:00:00.000Z",
        },
      ])
    );
    window.localStorage.setItem(
      "verto:inbox",
      JSON.stringify({
        items: [
          {
            id: "article-1",
            feedUrl: "https://example.com/feed.xml",
            sourceName: "Example",
            title: "Unread article",
            url: "https://example.com/article",
            status: "unread",
            createdAt: "2026-07-18T00:00:00.000Z",
          },
        ],
      })
    );

    const { host, root } = await renderDashboard();

    expect(host.querySelector("h1")?.textContent).toBe("Explore the included demo");
    expect(host.textContent).toContain("Reading progress, bookmarks, and inbox activity");
    expect(host.textContent).toContain("Read me again");
    expect(host.textContent).toContain("42% read");
    expect(host.textContent).toContain("Important document");
    expect(host.textContent).toContain("1 saved item");
    expect(host.textContent).toContain("1 unread article");
    expect(host.textContent).not.toContain("Review this library");
    expect(host.textContent).not.toContain("Indexed the available library structure");
    expect(host.querySelector('[aria-label="Saved workspace activity"]')).not.toBeNull();

    act(() => root.unmount());
  });

  it("does not call an explicitly configured build source a demo", async () => {
    const { host, root } = await renderDashboard({
      kind: "local",
      name: "Local Library",
      label: "Folder · vault",
      origin: "configured",
    });

    expect(host.querySelector("h1")?.textContent).toBe("Your library is ready");
    expect(host.textContent).toContain("Folder · vault");
    expect(host.textContent).not.toContain("Explore the included demo");
    act(() => root.unmount());
  });

  it("does not leak bundled documents while a selected folder has failed", async () => {
    runtimeMock.mockReturnValue({
      status: "error",
      folder: "C:\\Missing vault",
      index: null,
      error: "Folder unavailable",
    });

    const { host, root } = await renderDashboard();

    expect(host.querySelector("h1")?.textContent).toBe("Your local library needs attention");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Folder · Missing vault");
    expect(host.querySelector<HTMLAnchorElement>('[role="alert"] a')?.getAttribute("href")).toBe(
      "/integrations"
    );
    expect(host.textContent).not.toContain("Demo document");
    expect(host.textContent).toContain("Open any document and it will appear here.");

    act(() => root.unmount());
  });
});
