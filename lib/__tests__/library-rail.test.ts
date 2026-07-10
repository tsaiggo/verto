import { describe, expect, it } from "vitest";

import { buildLibrarySourceViews, type LibrarySourceStatus } from "@/lib/library-rail";

const staticRoot = { label: "static" };
const localRoot = { label: "local" };

function idle<T>(): LibrarySourceStatus<T> {
  return { status: "idle", root: null, fileCount: 0, error: null };
}

function ready<T>(root: T, fileCount: number): LibrarySourceStatus<T> {
  return { status: "ready", root, fileCount, error: null };
}

describe("library rail source views", () => {
  it("shows the runtime Local Library tree when a folder is connected", () => {
    const views = buildLibrarySourceViews({
      staticKind: "github",
      staticRoot,
      staticFileCount: 1,
      runtimeLocal: ready(localRoot, 3),
    });

    expect(views.map((view) => view.kind)).toEqual(["local"]);
    expect(views[0]).toMatchObject({
      isConnected: true,
      root: localRoot,
      fileCount: 3,
      open: true,
    });
  });

  it("shows the static local source when no runtime folder is connected", () => {
    const views = buildLibrarySourceViews({
      staticKind: "local",
      staticRoot,
      staticFileCount: 4,
      runtimeLocal: idle(),
    });

    expect(views.map((view) => view.kind)).toEqual(["local"]);
    expect(views[0]).toMatchObject({
      isConnected: true,
      root: staticRoot,
      fileCount: 4,
      open: true,
    });
  });

  it("does not surface unsupported cloud providers as connectable rail sources", () => {
    const views = buildLibrarySourceViews({
      staticKind: "github",
      staticRoot,
      staticFileCount: 1,
      runtimeLocal: idle(),
    });

    expect(views).toEqual([
      {
        kind: "local",
        status: "idle",
        root: null,
        fileCount: 0,
        error: null,
        isConnected: false,
        open: false,
      },
    ]);
  });
});
