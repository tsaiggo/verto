import type { BrowserArticle } from "@/lib/browser-articles";

export interface ArticlePageNode {
  article: BrowserArticle;
  children: ArticlePageNode[];
}

/** Corrupt or imported ancestry never hides a page or loops navigation. */
export function articleAncestors(articles: BrowserArticle[], id: string): BrowserArticle[] {
  const byId = new Map(articles.map((article) => [article.id, article]));
  const seen = new Set([id]);
  const ancestors: BrowserArticle[] = [];
  let parentId = byId.get(id)?.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }
  return ancestors;
}

export function articleDescendantIds(articles: BrowserArticle[], id: string): Set<string> {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const article of articles) {
      if (article.parentId && found.has(article.parentId) && !found.has(article.id)) {
        found.add(article.id);
        changed = true;
      }
    }
  }
  return found;
}

export function buildArticlePageTree(articles: BrowserArticle[]): ArticlePageNode[] {
  const saved = articles.filter((article) => article.status === "saved");
  const nodes = new Map(
    saved.map((article) => [article.id, { article, children: [] } as ArticlePageNode])
  );
  const roots: ArticlePageNode[] = [];
  for (const node of nodes.values()) {
    const ancestors = articleAncestors(saved, node.article.id);
    const parent = node.article.parentId ? nodes.get(node.article.parentId) : undefined;
    const parentIsDescendant = ancestors.some((ancestor) => ancestor.parentId === node.article.id);
    if (parent && parent !== node && !parentIsDescendant) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (siblings: ArticlePageNode[]) => {
    siblings.sort(
      (left, right) =>
        (left.article.order ?? 0) - (right.article.order ?? 0) ||
        left.article.createdAt.localeCompare(right.article.createdAt) ||
        left.article.id.localeCompare(right.article.id)
    );
    siblings.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}
