import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/annotations";
import type { SavedSummary } from "@/lib/summaries";
import {
  buildStudioArtifacts,
  filterStudioArtifacts,
  formatStudioDate,
} from "@/components/studio/studio-artifacts";

const summary: SavedSummary = {
  href: "/read/guides/start",
  slug: ["guides", "start"],
  title: "Reader foundations",
  body: "## Main idea\n\nLocal files remain the source of truth.",
  model: "mock-grounded",
  contextNote: "Full document, 1,240 characters",
  createdAt: "2026-07-20T10:00:00.000Z",
};

const note: Annotation = {
  id: "note-1",
  docSlug: "research/local-first.mdx",
  quote: "The filesystem is the durable source of truth.",
  anchor: {
    quote: "The filesystem is the durable source of truth.",
    prefix: "",
    suffix: "",
    start: 0,
  },
  color: "yellow",
  turns: [
    {
      id: "turn-1",
      author: "human",
      body: "Use this as the storage principle.",
      createdAt: "2026-07-21T10:00:00.000Z",
    },
  ],
  createdAt: "2026-07-21T10:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

describe("buildStudioArtifacts", () => {
  it("builds source-linked summary and exact-passage note artifacts", () => {
    const artifacts = buildStudioArtifacts([summary], [note]);

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]).toMatchObject({
      key: "note:note-1",
      kind: "note",
      sourceTitle: "Local First",
      sourceHref: "/read/research/local-first.mdx",
      citation: note.quote,
    });
    expect(artifacts[1]).toMatchObject({
      key: "summary:/read/guides/start",
      kind: "summary",
      sourceHref: summary.href,
      sourceScope: summary.contextNote,
      citation: null,
      model: summary.model,
    });
  });

  it("excludes bare highlights because they are not reusable insights", () => {
    expect(buildStudioArtifacts([], [{ ...note, turns: [] }])).toEqual([]);
  });

  it("filters without mutating the source order", () => {
    const artifacts = buildStudioArtifacts([summary], [note]);
    expect(filterStudioArtifacts(artifacts, "notes").map((artifact) => artifact.kind)).toEqual([
      "note",
    ]);
    expect(filterStudioArtifacts(artifacts, "summaries").map((artifact) => artifact.kind)).toEqual([
      "summary",
    ]);
    expect(filterStudioArtifacts(artifacts, "all")).not.toBe(artifacts);
  });
});

describe("formatStudioDate", () => {
  it("uses a stable UTC date and an honest malformed fallback", () => {
    expect(formatStudioDate("2026-07-21T23:59:00.000Z")).toBe("21 Jul 2026");
    expect(formatStudioDate("invalid")).toBe("Date unavailable");
  });
});
