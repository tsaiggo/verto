import { describe, expect, it } from "vitest";
import {
  agentHrefForQuery,
  deriveActiveSearchSource,
  parseSearchRouteState,
  searchHrefWithState,
  type SearchRouteState,
} from "@/components/search/search-state";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import type { SearchRecord } from "@/lib/search";

describe("search route URL state", () => {
  const fullState = {
    query: "runtime notes",
    scope: "code",
    sourceEnabled: false,
    selectedTags: ["architecture", "local files"],
    lastUpdated: "week",
    sortBy: "recent",
  } satisfies SearchRouteState;

  it("parses every persisted search control", () => {
    expect(
      parseSearchRouteState(
        "/search?q=runtime+notes&type=code&source=none&tag=local+files&tag=architecture&tag=architecture&time=week&sort=recent"
      )
    ).toEqual({
      ...fullState,
      selectedTags: ["local files", "architecture"],
    });
  });

  it("serializes non-default state while preserving unrelated params and hashes", () => {
    expect(
      searchHrefWithState(
        "/search?view=compact&q=old&type=all&source=local&tag=old&time=any&sort=relevance#results",
        fullState
      )
    ).toBe(
      "/search?view=compact&q=runtime+notes&type=code&source=none&tag=architecture&tag=local+files&time=week&sort=recent#results"
    );
  });

  it("removes defaults and gives invalid values quiet fallbacks", () => {
    const defaults = {
      query: " ",
      scope: "all",
      sourceEnabled: true,
      selectedTags: [],
      lastUpdated: "any",
      sortBy: "relevance",
    } satisfies SearchRouteState;

    expect(
      searchHrefWithState(
        "/search?q=old&type=page&source=none&tag=old&time=week&sort=recent&view=compact#results",
        defaults
      )
    ).toBe("/search?view=compact#results");

    expect(
      parseSearchRouteState(
        "/search?q=%20%20&type=unknown&source=local&tag=%20&time=year&sort=title",
        "fallback query"
      )
    ).toEqual({
      query: "fallback query",
      scope: "all",
      sourceEnabled: true,
      selectedTags: [],
      lastUpdated: "any",
      sortBy: "relevance",
    });
  });

  it("round-trips the complete route state", () => {
    expect(parseSearchRouteState(searchHrefWithState("/search", fullState))).toEqual(fullState);
  });

  it("hands the active query to Agent instead of dropping context", () => {
    const href = agentHrefForQuery("runtime notes");
    const url = new URL(href, "https://verto.local");

    expect(url.pathname).toBe("/agent");
    expect(url.searchParams.get("prompt")).toBe("Search my library for: runtime notes");
    expect(agentHrefForQuery(" ")).toBe("/agent");
  });
});

describe("active search source", () => {
  const buildRecord: SearchRecord = {
    id: "build",
    kind: "page",
    title: "Build source",
    href: "/read/build",
    path: "build.mdx",
    updated: 1,
    sourceKind: "onedrive",
    sourceName: "OneDrive",
  };
  const build = {
    records: [buildRecord],
    counts: { all: 1, page: 1, heading: 0, code: 0, folder: 0 },
    tags: ["build"],
    kind: "onedrive" as const,
    name: "OneDrive",
    label: "OneDrive / Docs",
  };

  it("switches filters and records to a ready runtime local library", () => {
    const runtimeRecord = { ...buildRecord, id: "runtime", sourceKind: "local" as const };
    const runtime = {
      status: "ready",
      folder: "C:/Notes",
      error: null,
      index: {
        folder: "C:/Notes",
        documents: [],
        libraryDocs: [],
        searchRecords: [runtimeRecord],
        counts: { all: 1, page: 1, heading: 0, code: 0, folder: 0 },
        tags: ["runtime"],
        tagCounts: [{ name: "runtime", count: 1 }],
      },
    } satisfies RuntimeLocalIndexState;

    const active = deriveActiveSearchSource(runtime, build);

    expect(active.kind).toBe("local");
    expect(active.records).toEqual([runtimeRecord]);
    expect(active.tags).toEqual(["runtime"]);
    expect(active.label).toBe("C:/Notes");
  });

  it("reports runtime loading and errors instead of falling back to build records", () => {
    const loading = deriveActiveSearchSource(
      { status: "loading", folder: "C:/Notes", index: null, error: null },
      build
    );
    const failed = deriveActiveSearchSource(
      { status: "error", folder: "C:/Notes", index: null, error: "Folder unavailable" },
      build
    );

    expect(loading).toMatchObject({ status: "loading", records: [], label: "C:/Notes" });
    expect(failed).toMatchObject({
      status: "error",
      records: [],
      error: "Folder unavailable",
    });
  });
});
