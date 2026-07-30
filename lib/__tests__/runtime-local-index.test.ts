import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawFileEntry } from "@/lib/content-source";
import {
  applyRuntimeLocalIndexBatch,
  buildRuntimeLocalIndex,
  RUNTIME_INDEX_READ_CONCURRENCY,
  runtimeEntryToContentFileNode,
} from "@/lib/runtime-local-index";
import type { VaultWatchBatch, VaultWatchEntry } from "@/lib/tauri";

const listRuntimeLocalFolderMock = vi.hoisted(() => vi.fn());
const readRuntimeLocalFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runtime-local-folder", () => ({
  listRuntimeLocalFolder: listRuntimeLocalFolderMock,
  readRuntimeLocalFile: readRuntimeLocalFileMock,
}));

const entries: RawFileEntry[] = [
  {
    id: "browser-local:Vault/projects/guide.mdx",
    path: ["projects", "guide.mdx"],
    mtime: Date.parse("2026-07-08T10:00:00Z"),
    size: 120,
  },
  {
    id: "browser-local:Vault/drafts/draft.md",
    path: ["drafts", "draft.md"],
    mtime: Date.parse("2026-07-07T12:00:00Z"),
    size: 90,
  },
  {
    id: "browser-local:Vault/archive/hidden.md",
    path: ["archive", "hidden.md"],
    mtime: Date.parse("2026-07-07T10:00:00Z"),
    size: 80,
  },
];

const GUIDE_RAW = `---
title: Runtime Guide
tags: [runtime, local]
updated: "2026-07-08"
---
# Ignored H1

Intro paragraph about browser vaults.

## Searchable Heading

\`\`\`ts
const runtimeLocal = true;
\`\`\`
`;
const DRAFT_RAW = "---\ntitle: Runtime Draft\ndraft: true\ntags: [draft]\n---\n# Runtime Draft";
const HIDDEN_RAW = "---\nhidden: true\ntags: [secret]\n---\n# Hidden";

const rawById = new Map<string, string>([
  ["browser-local:Vault/projects/guide.mdx", GUIDE_RAW],
  ["browser-local:Vault/drafts/draft.md", DRAFT_RAW],
  ["browser-local:Vault/archive/hidden.md", HIDDEN_RAW],
]);

function watchBatch(
  changes: VaultWatchBatch["changes"],
  options: { sequence?: number; rescan?: boolean } = {}
): VaultWatchBatch {
  return {
    schemaVersion: 1,
    root: "Vault",
    generation: 1,
    sequence: options.sequence ?? 1,
    rescan: options.rescan ?? false,
    changes,
    portableStateRescan: false,
    portableStateNames: [],
  };
}

describe("runtime local index", () => {
  beforeEach(() => {
    listRuntimeLocalFolderMock.mockReset();
    readRuntimeLocalFileMock.mockReset();
    rawById.set("browser-local:Vault/projects/guide.mdx", GUIDE_RAW);
    rawById.set("browser-local:Vault/drafts/draft.md", DRAFT_RAW);
    rawById.set("browser-local:Vault/archive/hidden.md", HIDDEN_RAW);
    listRuntimeLocalFolderMock.mockResolvedValue(entries);
    readRuntimeLocalFileMock.mockImplementation(async (id: string) => rawById.get(id) ?? "");
  });

  it("parses runtime local frontmatter into library docs, search records, and tags", async () => {
    const index = await buildRuntimeLocalIndex("Vault");

    expect(index.libraryDocs).toHaveLength(2);
    expect(
      index.libraryDocs.some((doc) => doc.title === "Runtime Draft" && doc.kind === "draft")
    ).toBe(true);
    const guide = index.libraryDocs.find((doc) => doc.title === "Runtime Guide");
    expect(guide).toMatchObject({
      title: "Runtime Guide",
      section: "Projects",
      tags: ["runtime", "local"],
      kind: "doc",
    });
    expect(guide?.href).toContain("/runtime/local?");
    expect(guide?.href).toContain("file=browser-local%3AVault%2Fprojects%2Fguide.mdx");

    expect(index.tagCounts).toEqual([
      { name: "local", count: 1 },
      { name: "runtime", count: 1 },
    ]);
    expect(index.counts.page).toBe(1);
    expect(index.counts.heading).toBe(1);
    expect(index.counts.code).toBe(1);
    expect(index.counts.folder).toBe(1);
    const searchTitles = index.searchRecords.map((record) => record.title);
    expect(searchTitles).not.toContain("Runtime Draft");
    expect(searchTitles).toEqual(
      expect.arrayContaining([
        "Runtime Guide",
        "Searchable Heading",
        "const runtimeLocal = true;",
        "Projects",
      ])
    );
  });

  it("falls back from frontmatter title to the first H1", () => {
    const node = runtimeEntryToContentFileNode(
      { id: "browser-local:Vault/notes/plain.md", path: ["notes", "plain.md"] },
      "# Plain Note\n\nBody text."
    );

    expect(node.title).toBe("Plain Note");
    expect(node.description).toBe("Body text.");
    expect(node.href).toContain("title=Plain+Note");
  });

  it("reuses unchanged parsed bodies during a metadata rescan", async () => {
    const initial = await buildRuntimeLocalIndex("Vault");
    readRuntimeLocalFileMock.mockClear();
    const changed = entries.map((entry) =>
      entry.id.endsWith("guide.mdx")
        ? { ...entry, size: (entry.size ?? 0) + 1, mtime: (entry.mtime ?? 0) + 1 }
        : entry
    );
    rawById.set(
      "browser-local:Vault/projects/guide.mdx",
      GUIDE_RAW.replace("Runtime Guide", "Updated Guide")
    );
    listRuntimeLocalFolderMock.mockResolvedValue(changed);

    const next = await applyRuntimeLocalIndexBatch(initial, watchBatch([], { rescan: true }));

    expect(readRuntimeLocalFileMock).toHaveBeenCalledOnce();
    expect(readRuntimeLocalFileMock).toHaveBeenCalledWith("browser-local:Vault/projects/guide.mdx");
    expect(next.libraryDocs.some((document) => document.title === "Updated Guide")).toBe(true);
  });

  it("uses listing SHA to detect a same-size same-mtime rewrite", async () => {
    const original: RawFileEntry = {
      ...entries[0]!,
      sha: "revision-one",
    };
    listRuntimeLocalFolderMock.mockResolvedValue([original]);
    const initial = await buildRuntimeLocalIndex("Vault");
    readRuntimeLocalFileMock.mockClear();
    const rewritten: RawFileEntry = {
      ...original,
      sha: "revision-two",
    };
    listRuntimeLocalFolderMock.mockResolvedValue([rewritten]);
    readRuntimeLocalFileMock.mockResolvedValue(
      GUIDE_RAW.replace("Runtime Guide", "Same Metadata Rewrite")
    );

    const next = await applyRuntimeLocalIndexBatch(initial, watchBatch([], { rescan: true }));

    expect(readRuntimeLocalFileMock).toHaveBeenCalledOnce();
    expect(next.libraryDocs.some((document) => document.title === "Same Metadata Rewrite")).toBe(
      true
    );
  });

  it("reads only an affected body and deduplicates a repeated SHA echo", async () => {
    const initial = await buildRuntimeLocalIndex("Vault");
    readRuntimeLocalFileMock.mockClear();
    const entry: VaultWatchEntry = {
      ...entries[0]!,
      sha: "revision-2",
      size: 140,
      mtime: (entries[0]!.mtime ?? 0) + 10,
    };
    rawById.set(entry.id, GUIDE_RAW.replace("Runtime Guide", "Changed Once"));

    const changed = await applyRuntimeLocalIndexBatch(
      initial,
      watchBatch([{ kind: "upsert", entry }])
    );

    expect(readRuntimeLocalFileMock).toHaveBeenCalledTimes(1);
    expect(changed.libraryDocs.some((document) => document.title === "Changed Once")).toBe(true);

    readRuntimeLocalFileMock.mockClear();
    const repeated = await applyRuntimeLocalIndexBatch(
      changed,
      watchBatch([{ kind: "upsert", entry }], { sequence: 2 })
    );
    expect(readRuntimeLocalFileMock).not.toHaveBeenCalled();
    expect(repeated.documents.find((document) => document.entry.id === entry.id)?.raw).toContain(
      "Changed Once"
    );
  });

  it("reuses raw content when a rename carries the same SHA", async () => {
    const initial = await buildRuntimeLocalIndex("Vault");
    const original: VaultWatchEntry = {
      ...entries[0]!,
      sha: "stable-revision",
      size: entries[0]!.size ?? 0,
      mtime: entries[0]!.mtime ?? 0,
    };
    const withRevision = await applyRuntimeLocalIndexBatch(
      initial,
      watchBatch([{ kind: "upsert", entry: original }])
    );
    readRuntimeLocalFileMock.mockClear();
    const renamed: VaultWatchEntry = {
      ...original,
      id: "browser-local:Vault/projects/renamed.mdx",
      path: ["projects", "renamed.mdx"],
    };

    const next = await applyRuntimeLocalIndexBatch(
      withRevision,
      watchBatch(
        [
          {
            kind: "rename",
            fromId: original.id,
            fromPath: original.path,
            entry: renamed,
          },
        ],
        { sequence: 2 }
      )
    );

    expect(readRuntimeLocalFileMock).not.toHaveBeenCalled();
    expect(next.documents.some((document) => document.entry.id === original.id)).toBe(false);
    expect(next.documents.find((document) => document.entry.id === renamed.id)?.raw).toBe(
      GUIDE_RAW
    );
  });

  it("keeps both files when a rename and source-path recreation share one batch", async () => {
    const initial = await buildRuntimeLocalIndex("Vault");
    const original: VaultWatchEntry = {
      ...entries[0]!,
      sha: "old-revision",
      size: entries[0]!.size ?? 0,
      mtime: entries[0]!.mtime ?? 0,
    };
    const withRevision = await applyRuntimeLocalIndexBatch(
      initial,
      watchBatch([{ kind: "upsert", entry: original }])
    );
    const renamed: VaultWatchEntry = {
      ...original,
      id: "browser-local:Vault/projects/z-guide.mdx",
      path: ["projects", "z-guide.mdx"],
    };
    const recreated: VaultWatchEntry = {
      ...original,
      sha: "new-revision",
      size: 150,
      mtime: (original.mtime ?? 0) + 1,
    };
    rawById.set(recreated.id, GUIDE_RAW.replace("Runtime Guide", "Recreated Guide"));
    readRuntimeLocalFileMock.mockClear();

    const next = await applyRuntimeLocalIndexBatch(
      withRevision,
      watchBatch(
        [
          // Deliberately place the upsert first. Consumers must apply identity
          // transitions before content changes instead of trusting backend
          // map or filesystem ordering.
          { kind: "upsert", entry: recreated },
          {
            kind: "rename",
            fromId: original.id,
            fromPath: original.path,
            entry: renamed,
          },
        ],
        { sequence: 2 }
      )
    );

    expect(readRuntimeLocalFileMock).toHaveBeenCalledOnce();
    expect(next.documents.find((document) => document.entry.id === renamed.id)?.raw).toBe(
      GUIDE_RAW
    );
    expect(next.documents.find((document) => document.entry.id === recreated.id)?.raw).toContain(
      "Recreated Guide"
    );
  });

  it("falls back to a full listing after a batch read fails without losing confirmed changes", async () => {
    const initial = await buildRuntimeLocalIndex("Vault");
    const changedGuide: VaultWatchEntry = {
      ...entries[0]!,
      sha: "guide-revision-2",
      size: 141,
      mtime: (entries[0]!.mtime ?? 0) + 20,
    };
    const changedHidden: VaultWatchEntry = {
      ...entries[2]!,
      sha: "hidden-revision-2",
      size: 101,
      mtime: (entries[2]!.mtime ?? 0) + 20,
    };
    const nextGuideRaw = GUIDE_RAW.replace("Runtime Guide", "Recovered Guide");
    const nextHiddenRaw = HIDDEN_RAW.replace("# Hidden", "# Recovered Hidden");
    listRuntimeLocalFolderMock.mockResolvedValue([changedGuide, changedHidden]);
    readRuntimeLocalFileMock.mockClear();
    let hiddenAttempts = 0;
    readRuntimeLocalFileMock.mockImplementation(async (id: string) => {
      if (id === changedGuide.id) return nextGuideRaw;
      if (id === changedHidden.id) {
        hiddenAttempts += 1;
        if (hiddenAttempts === 1) throw new Error("transient sharing violation");
        return nextHiddenRaw;
      }
      return rawById.get(id) ?? "";
    });

    const next = await applyRuntimeLocalIndexBatch(
      initial,
      watchBatch([
        { kind: "remove", id: entries[1]!.id, path: entries[1]!.path },
        { kind: "upsert", entry: changedGuide },
        { kind: "upsert", entry: changedHidden },
      ])
    );

    const guideReads = readRuntimeLocalFileMock.mock.calls.filter(([id]) => id === changedGuide.id);
    expect(guideReads).toHaveLength(1);
    expect(hiddenAttempts).toBe(2);
    expect(next.cacheDocuments?.some((document) => document.entry.id === entries[1]!.id)).toBe(
      false
    );
    expect(next.documents.some((document) => document.node.title === "Recovered Guide")).toBe(true);
    expect(
      next.cacheDocuments?.find((document) => document.entry.id === changedHidden.id)?.raw
    ).toBe(nextHiddenRaw);
  });

  it("bounds body reads for a large Vault", async () => {
    const manyEntries: RawFileEntry[] = Array.from({ length: 24 }, (_, index) => ({
      id: `note-${index}.md`,
      path: [`note-${index}.md`],
      size: index + 1,
      mtime: index + 1,
    }));
    listRuntimeLocalFolderMock.mockResolvedValue(manyEntries);
    let active = 0;
    let maximum = 0;
    readRuntimeLocalFileMock.mockImplementation(async (id: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return `# ${id}`;
    });

    await buildRuntimeLocalIndex("Vault");

    expect(maximum).toBeGreaterThan(1);
    expect(maximum).toBeLessThanOrEqual(RUNTIME_INDEX_READ_CONCURRENCY);
  });
});
