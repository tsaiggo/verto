// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMock = vi.hoisted(() => ({
  state: { status: "idle", folder: null, index: null, error: null } as unknown,
}));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => runtimeMock.state,
}));
vi.mock("@/components/search/useSearchRouteEffects", () => ({
  useSearchRouteEffects: () => 0,
}));
vi.mock("@/components/search/SearchBox", () => ({ SearchBox: () => null }));
vi.mock("@/components/search/SearchFilters", () => ({ SearchFilters: () => null }));
vi.mock("@/components/search/MobileSearchFilters", () => ({ MobileSearchFilters: () => null }));

import SearchView from "@/components/search/SearchView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const EMPTY_COUNTS = { all: 0, page: 0, heading: 0, code: 0, folder: 0 };

async function renderSearch(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(SearchView, {
        records: [],
        counts: EMPTY_COUNTS,
        tags: [],
        sourceKind: "local",
        sourceName: "Local Library",
        sourceLabel: "Local library",
      })
    );
  });
  return { host, root };
}

function expectPanelRelationship(host: HTMLElement, selectedLabel: string) {
  const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const selected = tabs.find((tab) => tab.textContent?.startsWith(selectedLabel));
  const panel = host.querySelector<HTMLElement>('[role="tabpanel"]');
  expect(selected).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(panel?.getAttribute("aria-labelledby")).toBe(selected?.id);
  expect(tabs.every((tab) => tab.getAttribute("aria-controls") === panel?.id)).toBe(true);
  return { panel, selected };
}

describe("SearchView tab accessibility", () => {
  beforeEach(() => {
    runtimeMock.state = { status: "idle", folder: null, index: null, error: null };
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("keeps the empty-results state inside the selected tabpanel", async () => {
    const { host, root } = await renderSearch();
    const { panel } = expectPanelRelationship(host, "All");
    expect(panel?.textContent).toContain("Search your library");

    const pagesTab = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.startsWith("Pages")
    );
    await act(async () => pagesTab?.click());
    expect(panel?.getAttribute("aria-labelledby")).toBe(pagesTab?.id);
    act(() => root.unmount());
  });

  it("keeps loading and error states inside the labelled tabpanel", async () => {
    runtimeMock.state = {
      status: "loading",
      folder: "C:/notes",
      index: null,
      error: null,
    };
    let rendered = await renderSearch();
    let { panel } = expectPanelRelationship(rendered.host, "All");
    expect(panel?.getAttribute("aria-busy")).toBe("true");
    expect(panel?.textContent).toContain("Indexing Local Library");
    act(() => rendered.root.unmount());

    runtimeMock.state = {
      status: "error",
      folder: "C:/notes",
      index: null,
      error: "Folder unavailable",
    };
    rendered = await renderSearch();
    ({ panel } = expectPanelRelationship(rendered.host, "All"));
    expect(panel?.querySelector('[role="alert"]')?.textContent).toContain("Folder unavailable");
    act(() => rendered.root.unmount());
  });
});
