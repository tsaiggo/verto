import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ANNOTATIONS_KEY } from "@/lib/annotations";
import { READING_STATE_KEY } from "@/lib/reading-state";
import {
  computeActivityStats,
  computeHeatmap,
  dateRangeWindow,
  formatMinutes,
} from "@/lib/activity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  } as Storage;
}

function makeWindow(storage: Storage) {
  return { localStorage: storage };
}

/** Reference "now" used across all timed tests: 2026-07-08 12:00 UTC */
const NOW = new Date("2026-07-08T12:00:00.000Z");

// "week" from 2026-07-08: 2026-07-02 00:00 UTC → 2026-07-08 23:59 UTC
// "month" from 2026-07-08: 2026-06-08 00:00 UTC → 2026-07-08 23:59 UTC

const ENTRIES = {
  // within BOTH week and month
  inWeek: {
    href: "/read/doc-a",
    slug: ["doc-a"],
    title: "Doc A",
    path: "doc-a.mdx",
    lastReadAt: "2026-07-07T10:00:00.000Z",
    progress: 50,
    scrollTop: 0,
  },
  // within week and month (different day, same week)
  inWeekAlso: {
    href: "/read/doc-b",
    slug: ["doc-b"],
    title: "Doc B",
    path: "doc-b.mdx",
    lastReadAt: "2026-07-03T10:00:00.000Z",
    progress: 100,
    scrollTop: 0,
  },
  // outside week, inside month
  inMonthOnly: {
    href: "/read/doc-c",
    slug: ["doc-c"],
    title: "Doc C",
    path: "doc-c.mdx",
    lastReadAt: "2026-06-10T10:00:00.000Z",
    progress: 10,
    scrollTop: 0,
  },
  // outside week and month, inside "all"
  inAllOnly: {
    href: "/read/doc-d",
    slug: ["doc-d"],
    title: "Doc D",
    path: "doc-d.mdx",
    lastReadAt: "2026-01-01T10:00:00.000Z",
    progress: 0,
    scrollTop: 0,
  },
} as const;

const VALID_ANCHOR = { quote: "some text", prefix: "before ", suffix: " after", start: 7 };

const ANNOTATIONS = {
  inWeek: {
    id: "ann-1",
    docSlug: "doc-a",
    quote: "some text",
    anchor: VALID_ANCHOR,
    color: "yellow",
    turns: [],
    createdAt: "2026-07-07T10:00:00.000Z",
    updatedAt: "2026-07-07T10:00:00.000Z",
  },
  inMonthOnly: {
    id: "ann-2",
    docSlug: "doc-c",
    quote: "other text",
    anchor: VALID_ANCHOR,
    color: "blue",
    turns: [],
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
  },
} as const;

// ---------------------------------------------------------------------------
// dateRangeWindow
// ---------------------------------------------------------------------------

describe("dateRangeWindow", () => {
  it("week range starts 6 days before now (UTC midnight) and ends at end of today", () => {
    const { from, to } = dateRangeWindow("week", NOW);
    expect(from.toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-08T23:59:59.999Z");
  });

  it("month range starts 29 days before now (UTC midnight) and ends at end of today", () => {
    // "month" = 30 days inclusive (today + 29 days back).
    // 2026-07-08 − 29 days = 2026-06-09.
    const { from, to } = dateRangeWindow("month", NOW);
    expect(from.toISOString()).toBe("2026-06-09T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-08T23:59:59.999Z");
  });

  it("all range starts from epoch and ends at end of today", () => {
    const { from, to } = dateRangeWindow("all", NOW);
    expect(from.getTime()).toBe(0);
    expect(to.toISOString()).toBe("2026-07-08T23:59:59.999Z");
  });
});

// ---------------------------------------------------------------------------
// formatMinutes
// ---------------------------------------------------------------------------

describe("formatMinutes", () => {
  it("formats zero minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
  });

  it("formats minutes under one hour", () => {
    expect(formatMinutes(30)).toBe("30m");
    expect(formatMinutes(59)).toBe("59m");
  });

  it("formats an exact hour", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(75)).toBe("1h 15m");
  });
});

// ---------------------------------------------------------------------------
// computeActivityStats
// ---------------------------------------------------------------------------

describe("computeActivityStats", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal("window", makeWindow(storage));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns zero counts when storage is empty", () => {
    const stats = computeActivityStats("week", NOW);
    expect(stats.docsRead).toBe(0);
    expect(stats.estimatedMinutes).toBe(0);
    expect(stats.noteCount).toBe(0);
  });

  it("counts docs whose lastReadAt falls in the week window", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({
        recent: [ENTRIES.inWeek, ENTRIES.inWeekAlso, ENTRIES.inMonthOnly, ENTRIES.inAllOnly],
      })
    );

    const stats = computeActivityStats("week", NOW);

    expect(stats.docsRead).toBe(2);
    expect(stats.estimatedMinutes).toBe(10); // 2 × 5 min
  });

  it("counts docs in the month window (includes week + month-only entries)", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({
        recent: [ENTRIES.inWeek, ENTRIES.inWeekAlso, ENTRIES.inMonthOnly, ENTRIES.inAllOnly],
      })
    );

    const stats = computeActivityStats("month", NOW);

    expect(stats.docsRead).toBe(3);
  });

  it("counts all docs when range is 'all'", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({
        recent: [ENTRIES.inWeek, ENTRIES.inWeekAlso, ENTRIES.inMonthOnly, ENTRIES.inAllOnly],
      })
    );

    const stats = computeActivityStats("all", NOW);

    expect(stats.docsRead).toBe(4);
  });

  it("counts annotations whose createdAt falls in the selected window", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({ recent: [ENTRIES.inWeek, ENTRIES.inMonthOnly] })
    );
    storage.setItem(
      ANNOTATIONS_KEY,
      JSON.stringify({ annotations: [ANNOTATIONS.inWeek, ANNOTATIONS.inMonthOnly] })
    );

    expect(computeActivityStats("week", NOW).noteCount).toBe(1);
    expect(computeActivityStats("month", NOW).noteCount).toBe(2);
    expect(computeActivityStats("all", NOW).noteCount).toBe(2);
  });

  it("returns the correct dateRange boundaries", () => {
    const { dateRange } = computeActivityStats("week", NOW);
    expect(dateRange.from.toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(dateRange.to.toISOString()).toBe("2026-07-08T23:59:59.999Z");
  });

  it("returns zero docsRead when all entries are outside the window", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({ recent: [ENTRIES.inAllOnly] }) // Jan 2026, way outside "week"
    );

    expect(computeActivityStats("week", NOW).docsRead).toBe(0);
  });

  it("returns zero stats when window is undefined (no window global)", () => {
    vi.unstubAllGlobals();
    const stats = computeActivityStats("week", NOW);
    expect(stats.docsRead).toBe(0);
    expect(stats.noteCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHeatmap
// ---------------------------------------------------------------------------

describe("computeHeatmap", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal("window", makeWindow(storage));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array when storage is empty", () => {
    expect(computeHeatmap("week", NOW)).toEqual([]);
  });

  it("returns one entry per distinct day within the range", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({ recent: [ENTRIES.inWeek, ENTRIES.inWeekAlso] })
    );

    const heatmap = computeHeatmap("week", NOW);

    expect(heatmap).toHaveLength(2);
    // sorted ascending
    expect(heatmap[0].date).toBe("2026-07-03");
    expect(heatmap[1].date).toBe("2026-07-07");
  });

  it("aggregates multiple readings on the same day into one entry", () => {
    const second = {
      ...ENTRIES.inWeek,
      href: "/read/doc-e",
      title: "Doc E",
      // same day as inWeek (2026-07-07), different time
      lastReadAt: "2026-07-07T18:00:00.000Z",
    };
    storage.setItem(READING_STATE_KEY, JSON.stringify({ recent: [ENTRIES.inWeek, second] }));

    const heatmap = computeHeatmap("week", NOW);

    expect(heatmap).toHaveLength(1);
    expect(heatmap[0]).toEqual({ date: "2026-07-07", count: 2 });
  });

  it("excludes readings outside the selected range", () => {
    storage.setItem(
      READING_STATE_KEY,
      JSON.stringify({
        recent: [ENTRIES.inWeek, ENTRIES.inMonthOnly, ENTRIES.inAllOnly],
      })
    );

    const weekHeatmap = computeHeatmap("week", NOW);
    const monthHeatmap = computeHeatmap("month", NOW);
    const allHeatmap = computeHeatmap("all", NOW);

    expect(weekHeatmap).toHaveLength(1);
    expect(monthHeatmap).toHaveLength(2);
    expect(allHeatmap).toHaveLength(3);
  });

  it("returns an empty array when window is undefined (no window global)", () => {
    vi.unstubAllGlobals();
    expect(computeHeatmap("week", NOW)).toEqual([]);
  });
});
