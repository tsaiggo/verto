import { describe, expect, it } from "vitest";
import type { BrowserArticle } from "@/lib/browser-articles";
import { articleAncestors, articleDescendantIds, buildArticlePageTree } from "./page-hierarchy";

const page = (id: string, parentId?: string | null, order = 0): BrowserArticle => ({
  id,
  parentId,
  order,
  title: id,
  filename: `${id}.md`,
  source: `# ${id}`,
  status: "saved",
  revision: 1,
  createdAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

describe("page navigation projections", () => {
  it("keeps ordered parents and descendants connected without drafts", () => {
    const articles = [
      page("child", "root"),
      page("other", null, 2),
      page("root"),
      { ...page("draft"), status: "draft" as const },
      page("grandchild", "child"),
    ];
    const roots = buildArticlePageTree(articles);
    expect(roots.map((node) => node.article.id)).toEqual(["root", "other"]);
    expect(roots[0].children[0].article.id).toBe("child");
    expect(roots[0].children[0].children[0].article.id).toBe("grandchild");
    expect(articleAncestors(articles, "grandchild").map((article) => article.id)).toEqual([
      "root",
      "child",
    ]);
    expect([...articleDescendantIds(articles, "root")]).toEqual(["root", "child", "grandchild"]);
  });

  it("shows every saved page when externally imported ancestry contains cycles or missing parents", () => {
    const articles = [
      page("a", "b"),
      page("b", "c"),
      page("c", "a"),
      page("orphan", "missing"),
      page("child", "a"),
      page("self", "self"),
    ];
    const roots = buildArticlePageTree(articles);
    expect(roots.map((node) => node.article.id)).toEqual(["a", "b", "c", "orphan", "self"]);
    expect(roots[0].children.map((node) => node.article.id)).toEqual(["child"]);
    expect(articleAncestors(articles, "a").map((article) => article.id)).toEqual(["c", "b"]);
  });
});
