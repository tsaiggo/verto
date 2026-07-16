import { describe, expect, it } from "vitest";
import {
  agentHrefForQuery,
  deriveActiveSearchSource,
  searchHrefWithQuery,
} from "@/components/search/search-state";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import type { SearchRecord } from "@/lib/search";

describe("search route URL state", () => {
  it("updates q while preserving unrelated params and hashes", () => {
    expect(searchHrefWithQuery("/search?source=local&q=old#results", "new query")).toBe(
      "/search?source=local&q=new+query#results"
    );
  });

  it("removes q when the input is cleared", () => {
    expect(searchHrefWithQuery("/search?source=local&q=old", "  ")).toBe("/search?source=local");
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
