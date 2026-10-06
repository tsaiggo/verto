import { describe, expect, it } from "vitest";
import { createBrowserRepository } from "./browser";
import { createContentService } from "./service";
import { vaultDocumentId } from "./identity";
import type { StateStore } from "../state-store/types";
import type { BrowserArticle } from "../browser-articles";

const article: BrowserArticle = {
  id: "local-note",
  filename: "note.md",
  source: "# Note\n\nA grounded observation.",
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
  revision: 2,
  status: "saved",
};

describe("browser content repository", () => {
  it("includes live managed articles and source data without reading DOM or writing state", async () => {
    let revision = 2;
    let writes = 0;
    const state: StateStore = {
      read: <T>() =>
        ({
          annotations: [
            {
              id: "annotation",
              docSlug: "browser/local-note",
              quote: "grounded observation",
              turns: [{ author: "human", body: "Remember this" }],
              createdAt: "now",
              updatedAt: "now",
            },
          ],
        }) as T,
      update: async <T>(_name: string, fallback: T) => {
        writes++;
        return fallback;
      },
      write: () => {
        writes++;
      },
      subscribe: () => () => {},
    };
    const service = createContentService(
      createBrowserRepository(
        [{ title: "Source", href: "/read/source", body: "A supplied readable source." }],
        { articles: async () => [{ ...article, revision }], stateStore: state }
      )
    );
    const list = await service.listDocuments();
    expect(list.documents.map((item) => item.id)).toEqual([
      "managed:local-note",
      "source:/read/source",
    ]);
    const previous = (await service.readDocument({ docId: "managed:local-note" })).blocks[1]
      .citation;
    expect(
      (await service.listAnnotations({ docId: "managed:local-note" })).annotations[0]
    ).toMatchObject({ note: "Remember this", citation: { docId: "managed:local-note" } });
    revision++;
    expect((await service.resolveCitation(previous)).status).toBe("stale");
    expect(writes).toBe(0);
  });

  it("restricts the document conversation and shares canonical vault ids with Node", async () => {
    const root = "/fixture/library";
    const href = `/runtime/local?${new URLSearchParams({ file: `${root}/research/note.md`, title: "Vault note", ext: ".md" })}`;
    const repository = createBrowserRepository(
      [
        { title: "Vault note", href, body: "A vault passage." },
        { title: "Unrelated", href: "/read/other", body: "Private unrelated passage." },
      ],
      { vaultRoot: root, currentHref: href, articles: async () => [article] }
    );
    const documents = await repository.listDocuments();
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe(await vaultDocumentId(root, "research/note.md"));
    expect(await repository.readDocument("managed:local-note")).toBeNull();
  });
});
