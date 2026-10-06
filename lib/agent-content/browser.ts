import { listBrowserArticles, type BrowserArticle } from "../browser-articles";
import { getStateStore, type StateStore } from "../state-store";
import { loadActiveRuntimeLocalFolder } from "../runtime-local-folder";
import { contentVersion, vaultDocumentId } from "./identity";
import { sourceMetadata } from "./source-metadata";
import { contentAnnotations } from "./annotation-data";
import { documentMetadata, type DocumentRepository, type StoredDocument } from "./types";

export interface BrowserContentSource {
  title: string;
  href: string;
  body: string;
  tags?: string[];
  id?: string;
  version?: string;
  draft?: boolean;
  hidden?: boolean;
  slug?: string[];
  sourceLabel?: string;
}

export interface BrowserRepositoryOptions {
  currentHref?: string;
  vaultRoot?: string;
  articles?: () => Promise<BrowserArticle[]>;
  stateStore?: StateStore;
}

function canonicalHref(href: string): string {
  return href.split("#")[0];
}

function relativeFile(file: string | null, root?: string) {
  const stripNamespace = (value: string) =>
    value
      .replace(/^\\\\\?\\UNC\\/i, "\\\\")
      .replace(/^\\\\\?\\/, "")
      .replace(/\\/g, "/");
  const normalizedRoot = root ? stripNamespace(root).replace(/\/$/, "") : undefined;
  const normalizedFile = file ? stripNamespace(file) : undefined;
  return normalizedRoot && normalizedFile?.startsWith(`${normalizedRoot}/`)
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : undefined;
}

async function sourceDocument(
  source: BrowserContentSource,
  root?: string
): Promise<StoredDocument> {
  const url = new URL(source.href, "http://verto.invalid");
  const file = url.searchParams.get("file");
  const relative = relativeFile(file, root);
  const metadata = sourceMetadata(source.body, source.title);
  return {
    id:
      source.id ??
      (root && relative
        ? await vaultDocumentId(root, relative)
        : `source:${canonicalHref(source.href)}`),
    title: source.title,
    href: canonicalHref(source.href),
    version: source.version ?? (await contentVersion(source.body)),
    format: url.searchParams.get("ext") === ".md" ? "md" : "mdx",
    draft: source.draft ?? metadata.draft,
    tags: source.tags ?? metadata.tags,
    sourceLabel: source.sourceLabel ?? "Connected library",
    source: source.body,
    annotationSlug: file
      ? `runtime-local/${file}`
      : (source.slug?.join("/") ?? url.pathname.replace(/^\/(?:read|help)\//, "")),
  };
}

async function articleDocument(article: BrowserArticle): Promise<StoredDocument> {
  const metadata = sourceMetadata(article.source, article.filename);
  return {
    id: `managed:${article.id}`,
    title: article.title || metadata.title,
    href: `/read/local?document=${encodeURIComponent(article.id)}`,
    version: await contentVersion(article.source, article.revision),
    format: article.filename.toLowerCase().endsWith(".mdx") ? "mdx" : "md",
    draft: article.status === "draft",
    tags: metadata.tags,
    sourceLabel: "Local Library",
    source: article.source,
    annotationSlug: `browser/${article.id}`,
  };
}

/** Browser and desktop UI share this repository; no rendered DOM is read. */
export function createBrowserRepository(
  sources: BrowserContentSource[],
  options: BrowserRepositoryOptions = {}
): DocumentRepository {
  async function documents() {
    const root = options.vaultRoot ?? loadActiveRuntimeLocalFolder() ?? undefined;
    const supplied = await Promise.all(
      sources
        .filter((source) => !source.hidden && source.href.startsWith("/"))
        .map((source) => sourceDocument(source, root))
    );
    const managed = await Promise.all(
      (await (options.articles ?? listBrowserArticles)()).map(articleDocument)
    );
    const all = [...managed, ...supplied];
    const seen = new Set<string>();
    return all.filter((item) => {
      if (options.currentHref && canonicalHref(options.currentHref) !== item.href) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  return {
    async listDocuments() {
      return (await documents()).map(documentMetadata);
    },
    async readDocument(id) {
      return (await documents()).find((item) => item.id === id) ?? null;
    },
    async readDocuments(ids) {
      return (await documents()).filter((item) => ids.includes(item.id));
    },
    async listAnnotations(id) {
      const document = (await documents()).find((item) => item.id === id);
      if (!document) return [];
      const state = options.stateStore ?? getStateStore();
      await state.hydrate?.("annotations");
      return contentAnnotations(state.read("annotations", null), document.annotationSlug);
    },
  };
}
