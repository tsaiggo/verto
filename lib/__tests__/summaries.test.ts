import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_SAVED_SUMMARIES,
  SUMMARIES_KEY,
  deleteSummary,
  findSummary,
  loadSummaries,
  removeSummary,
  saveSummaries,
  saveSummary,
  upsertSummary,
  type SavedSummary,
  type SummariesState,
} from "@/lib/summaries";

const baseSummary: SavedSummary = {
  href: "/read/docs/getting-started",
  slug: ["docs", "getting-started"],
  title: "Getting Started",
  body: "## TL;DR\n\nVerto turns a folder of MDX into a navigable site.",
  model: "openai/gpt-4o-mini",
  createdAt: "2026-06-05T00:00:00.000Z",
};

function summary(overrides: Partial<SavedSummary>): SavedSummary {
  return { ...baseSummary, ...overrides };
}

describe("upsertSummary", () => {
  it("adds a new summary to the front", () => {
    const previous = summary({ href: "/read/docs/intro", title: "Intro" });
    const next = upsertSummary([previous], baseSummary);

    expect(next).toEqual([baseSummary, previous]);
  });

  it("overwrites an existing summary for the same href and moves it to the front", () => {
    const old = summary({ body: "Old body", model: "old-model" });
    const other = summary({ href: "/read/docs/other", title: "Other" });
    const regenerated = summary({
      body: "Fresh body",
      model: "openai/gpt-4o",
      createdAt: "2026-06-06T00:00:00.000Z",
    });

    expect(upsertSummary([old, other], regenerated)).toEqual([regenerated, other]);
  });

  it("caps the list at the requested maximum", () => {
    const existing = Array.from({ length: 3 }, (_, index) =>
      summary({ href: `/read/docs/${index}`, title: `Doc ${index}` })
    );

    const next = upsertSummary(existing, baseSummary, 3);

    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(baseSummary);
  });

  it("rejects non-internal hrefs", () => {
    expect(upsertSummary([], summary({ href: "javascript:alert(1)" }))).toEqual([]);
    expect(upsertSummary([], summary({ href: "//evil.example" }))).toEqual([]);
  });

  it("rejects summaries with an empty body", () => {
    expect(upsertSummary([], summary({ body: "" }))).toEqual([]);
    expect(upsertSummary([], summary({ body: "   " }))).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const list = [summary({ href: "/read/docs/intro", title: "Intro" })];
    upsertSummary(list, baseSummary);

    expect(list).toEqual([summary({ href: "/read/docs/intro", title: "Intro" })]);
  });
});

describe("removeSummary", () => {
  it("removes summaries by href", () => {
    const target = summary({ href: "/read/docs/target", title: "Target" });
    const other = summary({ href: "/read/docs/other", title: "Other" });

    expect(removeSummary([target, other], target.href)).toEqual([other]);
  });

  it("does not mutate the input list", () => {
    const list = [summary({ href: "/read/docs/intro", title: "Intro" })];
    removeSummary(list, "/read/docs/intro");

    expect(list).toEqual([summary({ href: "/read/docs/intro", title: "Intro" })]);
  });
});

describe("findSummary", () => {
  it("returns the summary stored for an href", () => {
    const other = summary({ href: "/read/docs/other", title: "Other" });

    expect(findSummary([other, baseSummary], baseSummary.href)).toEqual(baseSummary);
  });

  it("returns null when no summary matches", () => {
    expect(findSummary([baseSummary], "/read/docs/missing")).toBeNull();
  });
});

describe("summaries persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips summaries through localStorage", async () => {
    const state: SummariesState = { summaries: [baseSummary] };

    await saveSummaries(state);

    expect(loadSummaries()).toEqual(state);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadSummaries()).toEqual({ summaries: [] });
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(SUMMARIES_KEY, "{not json");

    expect(loadSummaries()).toEqual({ summaries: [] });
  });

  it("drops invalid summaries and caps persisted entries", () => {
    const many = Array.from({ length: MAX_SAVED_SUMMARIES + 3 }, (_, index) =>
      summary({ href: `/read/docs/${index}`, title: `Doc ${index}` })
    );
    window.localStorage.setItem(
      SUMMARIES_KEY,
      JSON.stringify({
        summaries: [null, { title: "Missing href" }, { href: "/x" }, ...many],
      })
    );

    const loaded = loadSummaries();

    expect(loaded.summaries).toHaveLength(MAX_SAVED_SUMMARIES);
    expect(loaded.summaries[0].href).toBe("/read/docs/0");
  });

  it("saves one summary and notifies same-tab subscribers without StorageEvent", async () => {
    const events: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    window.addEventListener = (type: string) => void events.push(`listen:${type}`);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    await expect(saveSummary(baseSummary)).resolves.toEqual({ summaries: [baseSummary] });
    expect(loadSummaries()).toEqual({ summaries: [baseSummary] });
    expect(events).toContain("storage");
  });

  it("deletes one summary and notifies same-tab subscribers", async () => {
    const other = summary({ href: "/read/docs/other", title: "Other" });
    const events: string[] = [];
    await saveSummaries({ summaries: [baseSummary, other] });
    vi.stubGlobal("StorageEvent", undefined);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    await expect(deleteSummary(baseSummary.href)).resolves.toEqual({ summaries: [other] });
    expect(loadSummaries()).toEqual({ summaries: [other] });
    expect(events).toContain("storage");
  });
});

describe("summaries without a DOM", () => {
  it("loadSummaries returns an empty state when window is undefined", () => {
    expect(loadSummaries()).toEqual({ summaries: [] });
  });

  it("saveSummaries is a no-op when window is undefined", async () => {
    await expect(saveSummaries({ summaries: [baseSummary] })).resolves.toEqual({
      summaries: [baseSummary],
    });
  });
});
