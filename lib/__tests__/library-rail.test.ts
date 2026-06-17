import { describe, expect, it } from "vitest";

import { buildLibrarySourceViews, type LibrarySourceStatus } from "@/lib/library-rail";

const staticRoot = { label: "static" };
const githubRoot = { label: "github" };
const localRoot = { label: "local" };

function idle<T>(): LibrarySourceStatus<T> {
  return { status: "idle", root: null, fileCount: 0, error: null };
}

function ready<T>(root: T, fileCount: number): LibrarySourceStatus<T> {
  return { status: "ready", root, fileCount, error: null };
}

describe("library rail source views", () => {
  it("keeps Local Files listed when a runtime local folder exists beside GitHub", () => {
    const views = buildLibrarySourceViews({
      staticKind: "github",
      staticRoot,
      staticFileCount: 1,
      runtimeGitHub: ready(githubRoot, 2),
      runtimeLocal: ready(localRoot, 3),
    });

    expect(views.map((view) => view.kind)).toEqual(["github", "local", "onedrive", "googledrive"]);
    expect(views.find((view) => view.kind === "local")).toMatchObject({
      isConnected: true,
      root: localRoot,
      fileCount: 3,
      open: true,
    });
  });

  it("lists the connected static cloud source alongside the idle cloud providers", () => {
    const views = buildLibrarySourceViews({
      staticKind: "onedrive",
      staticRoot,
      staticFileCount: 4,
      runtimeGitHub: idle(),
      runtimeLocal: idle(),
    });

    expect(views.map((view) => view.kind)).toEqual(["github", "onedrive", "googledrive"]);
    expect(views.find((view) => view.kind === "onedrive")).toMatchObject({
      isConnected: true,
      root: staticRoot,
      fileCount: 4,
      open: true,
    });
  });

  it("keeps the original cloud order when Local Files is not connected", () => {
    const views = buildLibrarySourceViews({
      staticKind: "github",
      staticRoot,
      staticFileCount: 1,
      runtimeGitHub: idle(),
      runtimeLocal: idle(),
    });

    expect(views.map((view) => view.kind)).toEqual(["github", "onedrive", "googledrive"]);
  });
});
