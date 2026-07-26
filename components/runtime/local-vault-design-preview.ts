import type { RawFileEntry } from "@/lib/content-source";
import { buildFileRecords, summarizeCounts } from "@/lib/search";
import {
  runtimeEntryToContentFileNode,
  runtimeEntryToLibraryDoc,
  type RuntimeLocalIndex,
  type RuntimeLocalIndexedDocument,
} from "@/lib/runtime-local-index";

/**
 * A development-only populated vault state used to visually verify the actual
 * workspace components without relying on the desktop file-system bridge.
 */
const PREVIEW_FOLDER = "C:\\Users\\you\\OneDrive\\Verto Library";
const PREVIEW_MTIME = Date.UTC(2026, 6, 24, 9, 30);

const DOCUMENTS = [
  createPreviewDocument({
    id: "00 Overview/Project Compass.mdx",
    path: ["00 Overview", "Project Compass.mdx"],
    raw: `---
title: Project Compass
verto_id: preview-project-compass
verto_format: blocks-v1
created: 2026-07-24T09:30:00.000Z
updated: 2026-07-24
tags: [workspace, planning]
---

# Project Compass

An intentional workspace for the ideas, decisions, and work that matter next.

> **Constraint:** Keep the system calm enough that the important work stays visible.

## Current focus

- [x] Define the core principles
- [x] Set up the local MDX library
- [ ] Shape the first project brief
- [ ] Share a small weekly update

## Working agreement

Use folders for durable context and links for everything that crosses projects. The files stay readable without Verto, so OneDrive can sync them without a separate account.

## Notes

The interface should disappear into the writing: quiet surfaces, predictable structure, and a clear source of truth on disk.
`,
  }),
  createPreviewDocument({
    id: "00 Overview/Quick Start.mdx",
    path: ["00 Overview", "Quick Start.mdx"],
    raw: `---
title: Quick Start
verto_id: preview-quick-start
verto_format: blocks-v1
created: 2026-07-23T09:30:00.000Z
updated: 2026-07-23
---

# Quick Start

Open this folder in Verto, then keep working in the same files from any synced device.
`,
  }),
  createPreviewDocument({
    id: "01 Planning/Product Roadmap.mdx",
    path: ["01 Planning", "Product Roadmap.mdx"],
    raw: `---
title: Product Roadmap
verto_id: preview-roadmap
verto_format: blocks-v1
created: 2026-07-22T09:30:00.000Z
updated: 2026-07-22
tags: [planning]
---

# Product Roadmap

## Now

Clarify the writing flow and validate local-first sync.

## Next

Refine project templates with real work.
`,
  }),
  createPreviewDocument({
    id: "01 Planning/Weekly Review.mdx",
    path: ["01 Planning", "Weekly Review.mdx"],
    raw: `---
title: Weekly Review
verto_id: preview-weekly
verto_format: blocks-v1
created: 2026-07-21T09:30:00.000Z
updated: 2026-07-21
---

# Weekly Review

## Wins

## Questions
`,
  }),
  createPreviewDocument({
    id: "02 Notes/Meeting Notes.mdx",
    path: ["02 Notes", "Meeting Notes.mdx"],
    raw: `---
title: Meeting Notes
verto_id: preview-meeting
verto_format: blocks-v1
created: 2026-07-20T09:30:00.000Z
updated: 2026-07-20
---

# Meeting Notes

Capture the decision, owner, and next step while the conversation is fresh.
`,
  }),
] as const;

const PREVIEW_INDEX: RuntimeLocalIndex = {
  folder: PREVIEW_FOLDER,
  documents: [...DOCUMENTS],
  libraryDocs: DOCUMENTS.map((document) => document.libraryDoc),
  searchRecords: DOCUMENTS.flatMap((document) =>
    buildFileRecords(document.node, document.raw, { kind: "local", name: "Local Library" })
  ),
  counts: { all: 0, page: 0, heading: 0, code: 0, folder: 0 },
  tags: ["planning", "workspace"],
  tagCounts: [
    { name: "planning", count: 2 },
    { name: "workspace", count: 1 },
  ],
};
PREVIEW_INDEX.counts = summarizeCounts(PREVIEW_INDEX.searchRecords);

export const LOCAL_VAULT_DESIGN_PREVIEW = {
  activeFileId: DOCUMENTS[0].entry.id,
  document: DOCUMENTS[0],
  index: PREVIEW_INDEX,
  pinnedFileIds: [DOCUMENTS[0].entry.id, DOCUMENTS[2].entry.id],
} as const;

function createPreviewDocument({
  id,
  path,
  raw,
}: {
  id: string;
  path: string[];
  raw: string;
}): RuntimeLocalIndexedDocument {
  const entry: RawFileEntry = { id, path, mtime: PREVIEW_MTIME, size: raw.length };
  return {
    entry,
    node: runtimeEntryToContentFileNode(entry, raw),
    raw,
    libraryDoc: runtimeEntryToLibraryDoc(entry, raw),
  };
}
