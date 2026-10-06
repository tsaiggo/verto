import { describe, expect, it } from "vitest";
import type { BrowserArticle } from "./browser-articles";
import type { ImportedDocument } from "./imported-documents";
import type { ReadingEntry } from "./reading-state";
import {
  buildDocumentSwitcherEntries,
  documentSwitcherIdentity,
  normalizeDocumentVisits,
  selectDocumentSwitcherResults,
} from "./document-switcher";

function article(id: string, changes: Partial<BrowserArticle> = {}): BrowserArticle {
  return {
    id,
    filename: `${id}.mdx`,
    source: `# ${id}`,
    status: "saved",
    revision: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...changes,
  };
}

const pdf: ImportedDocument = {
  id: "paper",
  filename: "paper.pdf",
  title: "Research paper",
  format: "pdf",
  byteLength: 100,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  revision: 1,
};

describe("document switcher", () => {
  it("includes drafts and reading files while edit targets remain canonical editable articles", () => {
    const input = {
      articles: [article("note", { status: "draft" })],
      importedDocuments: [
        pdf,
        { ...pdf, id: "book", filename: "book.epub", format: "epub" as const },
      ],
      sourceDocuments: [{ title: "Source guide", href: "/read/guide" }],
    };
    const read = buildDocumentSwitcherEntries({ ...input, mode: "read" });
    expect(read.map((entry) => entry.kind)).toEqual(["article", "pdf", "epub", "source"]);
    expect(read[0].draft).toBe(true);
    const edit = buildDocumentSwitcherEntries({ ...input, mode: "edit" });
    expect(edit.map((entry) => entry.href)).toEqual(["/editor?document=note"]);
    expect(edit[0].draft).toBe(true);
  });

  it("keeps renamed parent paths searchable, tolerates broken ancestry and removes duplicate sources", () => {
    const entries = buildDocumentSwitcherEntries({
      mode: "read",
      articles: [
        article("root", { title: "Research notebook" }),
        article("child", { title: "Reading observations", parentId: "root", status: "draft" }),
        article("orphan", { parentId: "missing" }),
        article("cycle-a", { parentId: "cycle-b" }),
        article("cycle-b", { parentId: "cycle-a" }),
      ],
      sourceDocuments: [
        { title: "Hidden", href: "/read/hidden", hidden: true },
        { title: "Source", href: "/read/folder/source" },
        { title: "Duplicate", href: "/read/folder/source#heading" },
      ],
    });
    expect(entries.find((entry) => entry.id === "child")?.path).toBe(
      "Research notebook / child.mdx"
    );
    expect(entries.find((entry) => entry.id === "orphan")?.path).toBe("orphan.mdx");
    expect(entries.find((entry) => entry.id === "cycle-a")?.path).toBe("cycle-b / cycle-a.mdx");
    expect(entries.filter((entry) => entry.kind === "source")).toHaveLength(1);
    expect(
      selectDocumentSwitcherResults(entries, "research child.mdx", []).map(({ entry }) => entry.id)
    ).toEqual(["child"]);
    expect(selectDocumentSwitcherResults(entries, "folder/source", [])[0].entry.title).toBe(
      "Source"
    );
  });

  it("matches full width localized text and query words across title and filename without indexing body", () => {
    const entries = buildDocumentSwitcherEntries({
      mode: "read",
      articles: [article("notes", { title: "ＡＩ 阅读笔记", source: "An unrelated private body" })],
    });
    expect(selectDocumentSwitcherResults(entries, "ai 笔记 notes", [])).toHaveLength(1);
    expect(selectDocumentSwitcherResults(entries, "private body", [])).toEqual([]);
  });

  it("orders true read and edit visits before fallback documents and ignores deleted history", () => {
    const entries = buildDocumentSwitcherEntries({
      mode: "edit",
      articles: [
        article("newly-saved", { updatedAt: "2026-10-06T00:00:00.000Z" }),
        article("edited"),
        article("read"),
      ],
    });
    const results = selectDocumentSwitcherResults(
      entries,
      "",
      [
        { href: "/read/local?document=edited", visitedAt: Date.parse("2026-10-05") },
        { href: "/read/local?document=removed", visitedAt: Date.parse("2026-10-06") },
      ],
      [
        {
          href: "/read/local?document=read",
          lastReadAt: "2026-10-04T00:00:00.000Z",
        } as ReadingEntry,
      ]
    );
    expect(results.map(({ entry }) => entry.id)).toEqual(["edited", "read", "newly-saved"]);
    expect(results.map(({ recent }) => recent)).toEqual([true, true, false]);
    expect(results[0].entry.href).toBe("/editor?document=edited");
  });

  it("recognizes the current article independently of view, anchors and query ordering", () => {
    const entries = buildDocumentSwitcherEntries({
      mode: "edit",
      articles: [article("a b")],
      currentHref: "/editor?view=preview&document=a%20b#section",
    });
    expect(entries[0].current).toBe(true);
    expect(entries[0].href).toBe("/editor?document=a%20b");
    expect(documentSwitcherIdentity("/read/guide#intro")).toBe("/read/guide");
  });

  it("bounds visit metadata, keeps each document's latest visit and rejects malformed persisted records", () => {
    const visits = normalizeDocumentVisits([
      ...Array.from({ length: 105 }, (_, index) => ({
        href: `/read/document-${index}`,
        visitedAt: index + 1,
      })),
      { href: "/read/document-104#heading", visitedAt: 999 },
      { href: "https://example.com/read/private", visitedAt: 1000 },
      { href: "/read/invalid", visitedAt: Number.NaN },
      { href: "/read/invalid", visitedAt: -1 },
      null,
    ]);
    expect(visits).toHaveLength(100);
    expect(visits[0]).toEqual({ href: "/read/document-104", visitedAt: 999 });
    expect(visits.at(-1)?.href).toBe("/read/document-5");
    expect(normalizeDocumentVisits({ visits })).toEqual([]);
  });
});
