// @vitest-environment jsdom

import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchRouteState } from "@/components/search/search-state";
import { useSearchRouteEffects } from "@/components/search/useSearchRouteEffects";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const DEFAULT_STATE: SearchRouteState = {
  query: "",
  scope: "all",
  sourceEnabled: true,
  selectedTags: [],
  lastUpdated: "any",
  sortBy: "relevance",
};

const NON_DEFAULT_STATE: SearchRouteState = {
  query: "runtime notes",
  scope: "code",
  sourceEnabled: false,
  selectedTags: ["architecture", "local files"],
  lastUpdated: "week",
  sortBy: "recent",
};

function RouteHarness({ initialQuery = "" }: { initialQuery?: string }) {
  const [state, setState] = useState<SearchRouteState>(() => ({
    ...DEFAULT_STATE,
    query: initialQuery,
    selectedTags: [],
  }));
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchRouteEffects({
    state,
    onStateChange: setState,
    initialQuery,
    inputRef,
  });

  return (
    <div>
      <output data-testid="search-route-state">{JSON.stringify(state)}</output>
      <button
        type="button"
        data-testid="set-non-defaults"
        onClick={() =>
          setState({
            ...NON_DEFAULT_STATE,
            selectedTags: [...NON_DEFAULT_STATE.selectedTags],
          })
        }
      >
        Set non-defaults
      </button>
      <button
        type="button"
        data-testid="reset-defaults"
        onClick={() =>
          setState({
            ...DEFAULT_STATE,
            selectedTags: [],
          })
        }
      >
        Reset defaults
      </button>
    </div>
  );
}

let roots: Root[] = [];

async function renderHarness(initialQuery = "") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(<RouteHarness initialQuery={initialQuery} />));
  return host;
}

function readRouteState(host: HTMLElement): SearchRouteState {
  return JSON.parse(
    host.querySelector('[data-testid="search-route-state"]')?.textContent || "{}"
  ) as SearchRouteState;
}

describe("useSearchRouteEffects", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/search");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    for (const root of roots) act(() => root.unmount());
    roots = [];
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/search");
    vi.unstubAllGlobals();
  });

  it("restores every control from the URL on hydration and canonicalizes it", async () => {
    window.history.replaceState(
      { navigation: "refresh" },
      "",
      "/search?view=compact&q=runtime+notes&type=code&source=none&tag=beta&tag=alpha&time=week&sort=recent#results"
    );

    const host = await renderHarness("fallback");

    expect(readRouteState(host)).toEqual({
      query: "runtime notes",
      scope: "code",
      sourceEnabled: false,
      selectedTags: ["beta", "alpha"],
      lastUpdated: "week",
      sortBy: "recent",
    });
    expect(window.location.search).toBe(
      "?view=compact&q=runtime+notes&type=code&source=none&tag=alpha&tag=beta&time=week&sort=recent"
    );
    expect(window.location.hash).toBe("#results");
  });

  it("writes state changes and removes defaults without losing unrelated params", async () => {
    window.history.replaceState({}, "", "/search?view=compact");
    const host = await renderHarness();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="set-non-defaults"]')?.click();
    });
    expect(window.location.search).toBe(
      "?view=compact&q=runtime+notes&type=code&source=none&tag=architecture&tag=local+files&time=week&sort=recent"
    );

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="reset-defaults"]')?.click();
    });
    expect(window.location.search).toBe("?view=compact");
  });

  it("uses initialQuery only for hydration, never for popstate", async () => {
    window.history.replaceState({}, "", "/search?type=page");
    const host = await renderHarness("initial query");
    expect(readRouteState(host).query).toBe("initial query");

    await act(async () => {
      window.history.pushState(
        { navigation: "back" },
        "",
        "/search?view=compact&type=folder&source=none&tag=docs&time=month&sort=recent#results"
      );
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });

    expect(readRouteState(host)).toEqual({
      query: "",
      scope: "folder",
      sourceEnabled: false,
      selectedTags: ["docs"],
      lastUpdated: "month",
      sortBy: "recent",
    });
    expect(window.location.search).toBe(
      "?view=compact&type=folder&source=none&tag=docs&time=month&sort=recent"
    );
    expect(window.location.hash).toBe("#results");
  });
});
