import { describe, expect, it } from "vitest";

import {
  buildStudioCards,
  filterStudioCards,
  studioCardCopyText,
  summaryPreview,
} from "@/lib/studio-cards";
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
  it("strips markdown and collapses whitespace", () => {
    expect(summaryPreview("# Title\n\n- **bold** and `code`\n\nmore")).toBe(
      "Title bold and code more"
    );
  });

  it("resolves links to their label text", () => {
    expect(summaryPreview("see [the docs](https://x.example/y) now")).toBe("see the docs now");
  });

  it("truncates long bodies with an ellipsis", () => {
    const preview = summaryPreview("x".repeat(300), 20);
    expect(preview).toHaveLength(20);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("buildStudioCards", () => {
  it("maps summaries to Summary cards linking back to the document", () => {
    const cards = buildStudioCards([summary({ title: "Alpha", href: "/read/alpha" })], []);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      kind: "Summary",
      title: "Alpha",
      href: "/read/alpha",
      artifactId: "/read/alpha",
      content: "A summary body.",
    });
  });

  it("maps noted annotations to Note cards and excludes bare highlights", () => {
    const noted = annotation({ id: "n1", docSlug: "docs/x", turns: [humanTurn("my note")] });
    const bareHighlight = annotation({ id: "h1", turns: [] });

    const cards = buildStudioCards([], [noted, bareHighlight]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      kind: "Note",
      title: "my note",
      href: "/read/docs/x",
      artifactId: "n1",
      content: "my note",
      quote: "the quoted passage",
    });
  });

  it("orders cards newest-first across both sources", () => {
    const olderSummary = summary({ href: "/read/old", createdAt: "2026-06-01T00:00:00.000Z" });
    const newerNote = annotation({
      id: "new",
      turns: [humanTurn("newer note")],
      updatedAt: "2026-06-10T00:00:00.000Z",
    });

    const cards = buildStudioCards([olderSummary], [newerNote]);

    expect(cards.map((c) => c.kind)).toEqual(["Note", "Summary"]);
  });

  it("returns an empty list when there are no summaries or notes", () => {
    expect(buildStudioCards([], [annotation({ turns: [] })])).toEqual([]);
  });

  it("searches full content and filters by artifact kind", () => {
    const cards = buildStudioCards(
      [summary({ title: "Architecture", body: "A durable event pipeline" })],
      [annotation({ id: "n2", turns: [humanTurn("Remember the retry budget")] })]
    );

    expect(filterStudioCards(cards, "event pipeline", "all").map((card) => card.kind)).toEqual([
      "Summary",
    ]);
    expect(filterStudioCards(cards, "", "note").map((card) => card.kind)).toEqual(["Note"]);
  });

  it("builds useful copy text for summaries and notes", () => {
    const [summaryCard] = buildStudioCards([summary({ title: "Alpha", body: "Summary text" })], []);
    const [noteCard] = buildStudioCards([], [annotation({ turns: [humanTurn("My note")] })]);

    expect(studioCardCopyText(summaryCard!)).toBe("Alpha\n\nSummary text");
    expect(studioCardCopyText(noteCard!)).toBe("My note\n\nQuoted passage:\nthe quoted passage");
  });
});
