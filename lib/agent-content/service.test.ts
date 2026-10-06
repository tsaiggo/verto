import { describe, expect, it, vi } from "vitest";
import { createContentService } from "./service";
import { contentVersion } from "./identity";
import { documentMetadata, type DocumentRepository, type StoredDocument } from "./types";
import { documentBlocks, parseCitationHash } from "./blocks";

async function stored(id: string, source: string, draft = false): Promise<StoredDocument> {
  return {
    id,
    title: id,
    href: `/read/${id}`,
    version: await contentVersion(source),
    format: "md",
    draft,
    tags: [],
    sourceLabel: "Fixture",
    source,
    annotationSlug: id,
  };
}

function memory(documents: StoredDocument[]): DocumentRepository {
  return {
    listDocuments: async () => documents.map(documentMetadata),
    readDocument: async (id) => documents.find((document) => document.id === id) ?? null,
    listAnnotations: async () => [],
  };
}

describe("shared content service", () => {
  it("searches and cites phrases across Markdown hard line breaks", async () => {
    const document = await stored("hard-break", "A cobalt  \nowl lives nearby.");
    const service = createContentService(memory([document]));
    const { matches } = await service.searchDocuments({ query: "cobalt owl" });
    expect(matches).toHaveLength(1);
    expect(matches[0].citation?.excerpt).toBe("A cobalt owl lives nearby.");
    const read = await service.readDocument({ docId: document.id });
    expect(read.blocks[0].text).toBe("A cobalt owl lives nearby.");
  });

  it("paginates more than 48 documents and keeps drafts opt-in", async () => {
    const documents = await Promise.all(
      Array.from({ length: 70 }, (_, at) => stored(`doc-${at}`, `Paragraph ${at}.`, at === 69))
    );
    const service = createContentService(memory(documents));
    const first = await service.listDocuments({ limit: 40 });
    const second = await service.listDocuments({ cursor: first.nextCursor, limit: 40 });
    expect(first.total).toBe(69);
    expect([...first.documents, ...second.documents]).toHaveLength(69);
    expect(new Set([...first.documents, ...second.documents].map((item) => item.id)).size).toBe(69);
    expect(second.nextCursor).toBeUndefined();
    expect((await service.listDocuments({ includeDrafts: true })).total).toBe(70);
    await expect(service.readDocument({ docId: "doc-69" })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("finds and reads citable passages beyond 16000 characters", async () => {
    const raw = `${"An ordinary paragraph about background.\n\n".repeat(600)}Late passage: the cobalt owl lives by the river.`;
    const document = await stored("long", raw);
    const service = createContentService(memory([document]));
    const { matches } = await service.searchDocuments({ query: "cobalt owl" });
    const match = matches[0];
    expect(match.blockIndex).toBeGreaterThan(500);
    expect(match.citation?.excerpt).toContain("cobalt owl");
    const read = await service.readDocument({
      docId: document.id,
      offset: match.blockIndex,
      version: match.citation?.version,
    });
    expect(read.blocks[0].text).toContain("cobalt owl");
    expect((await service.resolveCitation(match.citation!)).status).toBe("resolved");
    expect(parseCitationHash(new URL(match.citation!.href, "http://fixture").hash)).toMatchObject({
      blockId: read.blocks[0].id,
    });
  });

  it("bounds blocks and paginates without gaps, rejecting stale versions and cursors", async () => {
    const document = await stored("long-block", "Dense words ".repeat(4000));
    const service = createContentService(memory([document]));
    const first = await service.readDocument({ docId: document.id, limit: 40 });
    const second = await service.readDocument({ docId: document.id, cursor: first.nextCursor });
    expect(first.blocks).toHaveLength(6);
    expect(first.blocks.every((block) => block.text.length <= 4000)).toBe(true);
    expect(first.blocks.reduce((sum, block) => sum + block.text.length, 0)).toBeLessThanOrEqual(
      24000
    );
    expect(second.blocks[0].index).toBe(6);
    const citation = first.blocks[0].citation;
    document.source += " changed";
    document.version = await contentVersion(document.source);
    await expect(
      service.readDocument({ docId: document.id, version: citation.version })
    ).rejects.toMatchObject({ code: "stale_version" });
    await expect(
      service.readDocument({ docId: document.id, cursor: first.nextCursor })
    ).rejects.toMatchObject({ code: "invalid_cursor" });
    expect((await service.resolveCitation(citation)).status).toBe("stale");
  });

  it("does not read denied ids and rechecks draft/version after a metadata race", async () => {
    const document = await stored("allowed", "Safe source.");
    const readDocument = vi.fn(async () => ({ ...document, draft: true, version: "changed" }));
    const service = createContentService({ ...memory([document]), readDocument });
    await expect(service.readDocument({ docId: "denied" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(readDocument).not.toHaveBeenCalled();
    await expect(service.readDocument({ docId: document.id })).rejects.toMatchObject({
      code: "not_found",
    });
    const result = await service.searchDocuments({ query: "Safe", includeDrafts: true });
    expect(result.matches[0].citation?.version).toBe("changed");
  });

  it("does not execute MDX or claim an ambiguous note quote has a unique location", async () => {
    const document = await stored(
      "notes",
      "---\ntitle: Private YAML\n---\n# Section\n\nA **clear** paragraph.\n\nRepeated quote.\n\nRepeated quote.\n\n<script>globalThis.leaked = true</script>"
    );
    const blocks = documentBlocks(document, document.source);
    expect(blocks.map((block) => block.text)).toContain("A clear paragraph.");
    expect(blocks.some((block) => block.text.includes("globalThis"))).toBe(false);
    const service = createContentService({
      ...memory([document]),
      listAnnotations: async () => [
        {
          id: "note",
          quote: "Repeated quote.",
          note: "My reflection",
          turns: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(
      (await service.listAnnotations({ docId: document.id })).annotations[0].citation
    ).toBeUndefined();
    expect(
      (
        await service.resolveCitation({
          docId: document.id,
          version: document.version,
          blockId: blocks[0].id,
          excerpt: "Invented quote",
        })
      ).status
    ).toBe("missing");
  });

  it("bounds giant heading metadata and explicitly discloses omitted executable/media content", async () => {
    const document = await stored(
      "huge-heading",
      `# ${"Heading ".repeat(15000)}\n\nA safe passage.`
    );
    document.title = "Title ".repeat(10000);
    const result = await createContentService(memory([document])).readDocument({
      docId: document.id,
    });
    expect(result.document.title.length).toBeLessThanOrEqual(300);
    expect(
      result.blocks.every(
        (block) => block.label.length <= 300 && block.citation.label.length <= 300
      )
    ).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThan(45000);
    expect(result.coverage).toEqual({
      textOnly: true,
      omittedKinds: ["raw_html", "evaluated_mdx", "media"],
    });
  });

  it("keeps MDX expression syntax as non-executed source and discloses missing evaluated output", async () => {
    const dangerous = vi.fn();
    vi.stubGlobal("dangerous", dangerous);
    try {
      const document = await stored(
        "mdx-source",
        "{dangerous()}\n\nInline source {process.env.EXAMPLE}."
      );
      document.format = "mdx";
      const result = await createContentService(memory([document])).readDocument({
        docId: document.id,
      });
      expect(result.blocks.map((block) => block.text)).toEqual([
        "{dangerous()}",
        "Inline source {process.env.EXAMPLE}.",
      ]);
      expect(result.coverage.omittedKinds).toContain("evaluated_mdx");
      expect(dangerous).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
