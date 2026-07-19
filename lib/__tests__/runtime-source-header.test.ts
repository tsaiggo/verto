import { describe, expect, it } from "vitest";
import { resolveRuntimeSourceHeader, runtimeFolderName } from "@/lib/runtime-source-header";

const BUNDLED = {
  source: { kind: "local", name: "Included demo", label: "Included demo", origin: "bundled" },
  documents: 12,
  sections: 4,
} as const;

describe("runtime source header metadata", () => {
  it("uses the honest bundled-demo fallback when no runtime folder is active", () => {
    expect(resolveRuntimeSourceHeader({ status: "idle" }, BUNDLED)).toMatchObject({
      mode: "bundled",
      sourceLabel: "Included demo",
      documentCount: 12,
      sectionCount: 4,
      documentLabel: "12 documents",
      sectionLabel: "4 sections",
    });
  });

  it("keeps an explicitly configured build source distinct from the demo", () => {
    const summary = resolveRuntimeSourceHeader(
      { status: "idle" },
      {
        source: {
          kind: "local",
          name: "Local Library",
          label: "Folder · vault",
          origin: "configured",
        },
        documents: 3,
        sections: 1,
      }
    );

    expect(summary).toMatchObject({
      mode: "build",
      sourceLabel: "Folder · vault",
      documentCount: 3,
    });
  });

  it("does not show bundled counts while the selected folder is loading", () => {
    expect(
      resolveRuntimeSourceHeader({ status: "loading", folder: "/Users/me/Notes" }, BUNDLED)
    ).toMatchObject({
      mode: "local-loading",
      sourceLabel: "Folder · Notes",
      sourceTitle: "/Users/me/Notes",
      documentCount: null,
      sectionCount: null,
      documentLabel: "Counting documents…",
      sectionLabel: "Discovering sections…",
    });
  });

  it("uses local document and unique section counts once the index is ready", () => {
    expect(
      resolveRuntimeSourceHeader(
        {
          status: "ready",
          folder: "C:\\Users\\me\\Vault\\",
          index: {
            documents: [{}, {}, {}],
            libraryDocs: [{ section: "Projects" }, { section: "Projects" }, { section: "Notes" }],
          },
        },
        BUNDLED
      )
    ).toMatchObject({
      mode: "local-ready",
      sourceLabel: "Folder · Vault",
      documentCount: 3,
      sectionCount: 2,
      documentLabel: "3 documents",
      sectionLabel: "2 sections",
    });
  });

  it("keeps an empty connected folder distinct from the populated demo", () => {
    expect(
      resolveRuntimeSourceHeader(
        {
          status: "ready",
          folder: "/Users/me/Empty",
          index: { documents: [], libraryDocs: [] },
        },
        BUNDLED
      )
    ).toMatchObject({
      mode: "local-ready",
      documentCount: 0,
      sectionCount: 0,
      documentLabel: "0 documents",
      sectionLabel: "0 sections",
    });
  });

  it("does not claim counts when the selected folder fails to load", () => {
    expect(
      resolveRuntimeSourceHeader({ status: "error", folder: "/Users/me/Broken" }, BUNDLED)
    ).toMatchObject({
      mode: "local-error",
      sourceLabel: "Folder · Broken",
      documentCount: null,
      sectionCount: null,
      documentLabel: "Document count unavailable",
      sectionLabel: "Section count unavailable",
    });
  });

  it("derives compact folder names from Unix, Windows, and root paths", () => {
    expect(runtimeFolderName("/Users/me/Notes/")).toBe("Notes");
    expect(runtimeFolderName("C:\\Users\\me\\Notes\\")).toBe("Notes");
    expect(runtimeFolderName("/")).toBe("/");
  });
});
