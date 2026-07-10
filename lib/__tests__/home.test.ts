import { describe, it, expect } from "vitest";
import { buildLibraryOverview, buildStatusBoard, statusColumnId } from "@/lib/home";
import type { ContentFileNode } from "@/lib/content-source/types";
function file(overrides: Partial<ContentFileNode>): ContentFileNode {
  const slug = overrides.slug ?? [overrides.title?.toLowerCase() ?? "doc"];
  return {
    type: "file",
    slug,
    href: `/read/${slug.join("/")}`,
    title: overrides.title ?? "Doc",
    mtime: 0,
    id: slug.join("/") + ".mdx",
    ext: ".mdx",
    ...overrides,
  };
}

describe("buildLibraryOverview", () => {
  it("summarizes documents, tags, statuses, and top collections", () => {
    const overview = buildLibraryOverview([
      file({ title: "One", tags: ["writing", "ideas"], status: "draft" }),
      file({ title: "Two", tags: ["writing"], status: "published" }),
      file({ title: "Three", status: "draft" }),
    ]);

    expect(overview.totalDocuments).toBe(3);
    expect(overview.taggedDocuments).toBe(2);
    expect(overview.tagCount).toBe(2);
    expect(overview.statusCount).toBe(2);
    expect(overview.collections).toEqual([
      { kind: "tag", label: "writing", count: 2, href: "/read/tags/writing" },
      { kind: "tag", label: "ideas", count: 1, href: "/read/tags/ideas" },
      { kind: "status", label: "draft", count: 2, href: "/read/status/draft" },
      { kind: "status", label: "published", count: 1, href: "/read/status/published" },
    ]);
  });

  it("ignores blank labels and respects collection limits", () => {
    const overview = buildLibraryOverview(
      [
        file({ title: "One", tags: ["", " b "], status: " " }),
        file({ title: "Two", tags: ["a"], status: "todo" }),
      ],
      1
    );

    expect(overview.tagCount).toBe(2);
    expect(overview.statusCount).toBe(1);
    expect(overview.collections).toEqual([
      { kind: "tag", label: "a", count: 1, href: "/read/tags/a" },
    ]);
  });
});

describe("statusColumnId", () => {
  it("treats missing or blank status as unread", () => {
    expect(statusColumnId(undefined)).toBe("unread");
    expect(statusColumnId("")).toBe("unread");
    expect(statusColumnId("   ")).toBe("unread");
  });

  it("normalizes common synonyms case-insensitively", () => {
    expect(statusColumnId("TODO")).toBe("unread");
    expect(statusColumnId("Backlog")).toBe("unread");
    expect(statusColumnId("WIP")).toBe("reading");
    expect(statusColumnId("in progress")).toBe("reading");
    expect(statusColumnId("Done")).toBe("done");
    expect(statusColumnId("published")).toBe("done");
  });

  it("routes unrecognized statuses to other", () => {
    expect(statusColumnId("on-hold")).toBe("other");
    expect(statusColumnId("someday")).toBe("other");
  });
});

describe("buildStatusBoard", () => {
  it("groups documents into fixed columns by normalized status", () => {
    const board = buildStatusBoard([
      file({ title: "Inbox item", status: "todo" }),
      file({ title: "Mid read", status: "reading" }),
      file({ title: "Finished", status: "done" }),
      file({ title: "No status" }),
    ]);

    expect(board.total).toBe(4);
    expect(board.columns.map((c) => c.id)).toEqual(["unread", "reading", "done"]);

    const unread = board.columns.find((c) => c.id === "unread")!;
    expect(unread.label).toBe("Unread");
    // No-status docs and `todo` both land in Unread.
    expect(unread.cards.map((card) => card.title)).toEqual(["Inbox item", "No status"]);
  });

  it("always renders the three core columns even when empty", () => {
    const board = buildStatusBoard([file({ title: "Only one", status: "reading" })]);
    expect(board.columns.map((c) => c.id)).toEqual(["unread", "reading", "done"]);
    expect(board.columns.find((c) => c.id === "unread")!.cards).toEqual([]);
    expect(board.columns.find((c) => c.id === "done")!.cards).toEqual([]);
  });

  it("adds the other column only when an unrecognized status exists", () => {
    const without = buildStatusBoard([file({ title: "A", status: "done" })]);
    expect(without.columns.some((c) => c.id === "other")).toBe(false);

    const withOther = buildStatusBoard([file({ title: "B", status: "on-hold" })]);
    const other = withOther.columns.find((c) => c.id === "other");
    expect(other?.label).toBe("Other");
    expect(other?.cards.map((card) => card.title)).toEqual(["B"]);
  });

  it("preserves input order and carries card path + trimmed status", () => {
    const board = buildStatusBoard([
      file({ title: "Second", slug: ["guides", "b"], status: "  reading  " }),
      file({ title: "First", slug: ["guides", "a"], status: "reading" }),
    ]);

    const reading = board.columns.find((c) => c.id === "reading")!;
    expect(reading.cards).toEqual([
      { title: "Second", href: "/read/guides/b", path: "guides/b.mdx", status: "reading" },
      { title: "First", href: "/read/guides/a", path: "guides/a.mdx", status: "reading" },
    ]);
  });

  it("omits status on cards without frontmatter status", () => {
    const board = buildStatusBoard([file({ title: "Bare" })]);
    const card = board.columns.find((c) => c.id === "unread")!.cards[0];
    expect(card.status).toBeUndefined();
  });

  it("returns an empty board for no documents", () => {
    const board = buildStatusBoard([]);
    expect(board.total).toBe(0);
    expect(board.columns.map((c) => c.id)).toEqual(["unread", "reading", "done"]);
    expect(board.columns.every((c) => c.cards.length === 0)).toBe(true);
  });
});
