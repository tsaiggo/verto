import { describe, expect, it } from "vitest";
import { createContentTools, resolveContentAnswer } from "@/lib/ai/tools/content";
import { createContentService } from "@/lib/agent-content/service";
import { dispatch } from "@/lib/ai/tools/registry";
import type { DocumentRepository, StoredDocument } from "@/lib/agent-content/types";

const document: StoredDocument = {
  id: "managed:a",
  title: "Agent notes",
  href: "/read/local?id=a",
  version: "v1",
  format: "md",
  draft: false,
  tags: [],
  sourceLabel: "Local Library",
  annotationSlug: "local/a",
  source:
    "# Agents\n\nAn agent searches saved evidence before answering.\n\nThe next paragraph explains references.",
};

function repository(): DocumentRepository {
  return {
    listDocuments: async () => [document],
    readDocument: async (id) => (id === document.id ? document : null),
    listAnnotations: async () => [],
  };
}

describe("headless Agent retrieval tools", () => {
  it("only exposes citation links for evidence actually returned in this turn", async () => {
    const retrieval = createContentTools(createContentService(repository()));
    const search = await dispatch(
      retrieval.tools,
      "search_documents",
      JSON.stringify({ query: "agent" }),
      { doc: null }
    );
    expect(search.ok).toBe(true);
    expect(retrieval.evidence.size).toBe(0);
    const read = await dispatch(
      retrieval.tools,
      "read_document",
      JSON.stringify({ docId: "managed:a", offset: 1, limit: 1 }),
      { doc: null }
    );
    expect(read.ok).toBe(true);
    expect(retrieval.evidence.size).toBe(1);
    const result = resolveContentAnswer(
      "Read evidence. [[evidence:e1]] Invented. [[evidence:e99]]",
      retrieval.evidence
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].href).toContain("#verto-citation=");
    expect(result.text).not.toContain("e99");
    expect(result.text).toContain("[1](/read/local?id=a");
  });
  it("does not fabricate citations after an unavailable document read", async () => {
    const retrieval = createContentTools(createContentService(repository()));
    const result = await dispatch(
      retrieval.tools,
      "read_document",
      JSON.stringify({ docId: "managed:private" }),
      { doc: null }
    );
    expect(result.ok).toBe(false);
    expect(resolveContentAnswer("[[evidence:e1]]", retrieval.evidence).citations).toEqual([]);
  });
  it("fails unknown arguments and stale versions before retaining evidence", async () => {
    const retrieval = createContentTools(createContentService(repository()));
    expect(
      (
        await dispatch(
          retrieval.tools,
          "read_document",
          '{"docId":"managed:a","path":"C:/secret"}',
          { doc: null }
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await dispatch(retrieval.tools, "read_document", '{"docId":"managed:a","version":"old"}', {
          doc: null,
        })
      ).ok
    ).toBe(false);
    expect(retrieval.evidence.size).toBe(0);
  });
});
