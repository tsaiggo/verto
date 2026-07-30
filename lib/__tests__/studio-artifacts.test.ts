import { describe, expect, it } from "vitest";

import {
  buildStudioArtifacts,
  filterStudioArtifacts,
  summaryPreview,
} from "@/components/studio/studio-artifacts";
import type { SavedSummary } from "@/lib/summaries";
import type { Annotation, Turn } from "@/lib/annotations";

function summary(overrides: Partial<SavedSummary>): SavedSummary {
  return {
    href: "/read/demo",
    slug: ["demo"],
    title: "Demo",
    body: "A summary body.",
    model: "test/model",
    createdAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

function humanTurn(body: string): Turn {
  return { id: "t1", author: "human", body, createdAt: "2026-06-05T00:00:00.000Z" };
}

function annotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: "a1",
    docSlug: "demo",
    quote: "the quoted passage",
    anchor: { quote: "the quoted passage", prefix: "", suffix: "", start: 0 },
    color: "yellow",
    turns: [],
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("summaryPreview", () => {
  it("strips Markdown and collapses whitespace", () => {
    expect(summaryPreview("# Title\n\n- **bold** and `code`\n\nmore")).toBe(
      "Title bold and code more"
    );
  });

  it("resolves links and truncates long bodies", () => {
    expect(summaryPreview("see [the docs](https://x.example/y) now")).toBe("see the docs now");
    expect(summaryPreview("x".repeat(300), 20)).toBe(`${"x".repeat(19)}…`);
  });
});

describe("buildStudioArtifacts", () => {
  it("maps summaries to the production artifact shape", () => {
    const artifacts = buildStudioArtifacts(
      [summary({ title: "Alpha", href: "/read/alpha", body: "## Key point\n\nUseful detail" })],
      []
    );

    expect(artifacts[0]).toMatchObject({
      kind: "summary",
      title: "Alpha",
      preview: "Key point Useful detail",
      sourceHref: "/read/alpha",
    });
  });

  it("maps noted annotations and excludes bare highlights", () => {
    const noted = annotation({ id: "n1", docSlug: "docs/x", turns: [humanTurn("my note")] });
    const artifacts = buildStudioArtifacts([], [noted, annotation({ id: "h1", turns: [] })]);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      kind: "note",
      title: "my note",
      sourceTitle: "X",
      sourceHref: "/read/docs/x",
    });
  });

  it("orders artifacts newest-first across both sources", () => {
    const artifacts = buildStudioArtifacts(
      [summary({ href: "/read/old", createdAt: "2026-06-01T00:00:00.000Z" })],
      [
        annotation({
          id: "new",
          turns: [humanTurn("newer note")],
          updatedAt: "2026-06-10T00:00:00.000Z",
        }),
      ]
    );

    expect(artifacts.map((artifact) => artifact.kind)).toEqual(["note", "summary"]);
  });

  it("filters the same production artifacts by view", () => {
    const artifacts = buildStudioArtifacts(
      [summary({})],
      [annotation({ turns: [humanTurn("note")] })]
    );

    expect(filterStudioArtifacts(artifacts, "summaries").map((artifact) => artifact.kind)).toEqual([
      "summary",
    ]);
    expect(filterStudioArtifacts(artifacts, "notes").map((artifact) => artifact.kind)).toEqual([
      "note",
    ]);
  });
});
