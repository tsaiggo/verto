import { readdir, lstat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { contentVersion, vaultDocumentId } from "./identity";
import { contentAnnotations } from "./annotation-data";
import { sourceMetadata } from "./source-metadata";
import {
  grantAllows,
  plainRoot,
  readAgentGrant,
  readPlainFileWithin,
  ensureGrantUnchanged,
  type AgentGrant,
  type NodeRepositoryOptions,
} from "./node-access";
import {
  ContentAccessError,
  documentMetadata,
  type DocumentRepository,
  type StoredDocument,
} from "./types";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

function nativeMetadata(source: string, filename: string) {
  const fallback = sourceMetadata(source, filename);
  const yaml = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
  if (!yaml) return fallback;
  const data = matter(`---\n${yaml}\n---\n`).data;
  return {
    title: typeof data.title === "string" ? data.title.slice(0, 300) : fallback.title,
    tags: Array.isArray(data.tags)
      ? data.tags
          .filter((tag: unknown): tag is string => typeof tag === "string")
          .slice(0, 20)
          .map((tag: string) => tag.slice(0, 80))
      : fallback.tags,
    draft: data.draft === true,
    hidden: data.hidden === true,
  };
}

interface ManagedArticleData {
  id: string;
  filename: string;
  source: string;
  title?: string;
  revision: number;
  status: "saved" | "draft";
}

function managedArticle(value: unknown): value is ManagedArticleData {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ManagedArticleData>;
  return (
    typeof item.id === "string" &&
    typeof item.filename === "string" &&
    /\.mdx?$/i.test(item.filename) &&
    typeof item.source === "string" &&
    item.source.length <= MAX_SOURCE_BYTES &&
    Number.isSafeInteger(item.revision) &&
    (item.revision ?? -1) >= 0 &&
    (item.status === "saved" || item.status === "draft") &&
    (item.title === undefined || typeof item.title === "string")
  );
}

async function managedDocuments(grant: AgentGrant, onlyId?: string): Promise<StoredDocument[]> {
  const root = await plainRoot(grant.managedRoot);
  const raw = await readPlainFileWithin(root, "library.json", 64 * 1024 * 1024);
  if (!raw) return [];
  const manifest = JSON.parse(raw);
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.articles) ||
    !manifest.articles.every(managedArticle)
  )
    throw new Error("The managed library manifest is invalid.");
  const articles = (manifest.articles as ManagedArticleData[]).filter(
    (item) =>
      grantAllows(grant, `managed:${item.id}`, item.status === "draft") &&
      (!onlyId || onlyId === `managed:${item.id}`)
  );
  return Promise.all(
    articles.map(async (article) => {
      const metadata = nativeMetadata(article.source, article.filename);
      return {
        id: `managed:${article.id}`,
        title: article.title || metadata.title,
        href: `/read/local?document=${encodeURIComponent(article.id)}`,
        version: await contentVersion(article.source, article.revision),
        format: article.filename.toLowerCase().endsWith(".mdx")
          ? ("mdx" as const)
          : ("md" as const),
        draft: article.status === "draft",
        tags: metadata.tags,
        sourceLabel: "Local Library",
        source: article.source,
        annotationSlug: `browser/${article.id}`,
      };
    })
  );
}

async function vaultFiles(root: string, relative = "", depth = 0): Promise<string[]> {
  if (depth > 32) throw new Error("The authorized library exceeds the folder depth limit.");
  const directory = path.join(root, relative);
  await plainRoot(directory);
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await vaultFiles(root, next, depth + 1)));
    else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(next);
    if (files.length > 10_000)
      throw new Error("The authorized library exceeds the document limit.");
  }
  return files;
}

async function vaultDocuments(grant: AgentGrant, onlyId?: string): Promise<StoredDocument[]> {
  if (!grant.vaultRoot) return [];
  const root = await plainRoot(grant.vaultRoot);
  const documents: StoredDocument[] = [];
  let totalChars = 0;
  for (const relative of await vaultFiles(root)) {
    const id = await vaultDocumentId(grant.vaultRoot, relative);
    if (!grantAllows(grant, id, false) || (onlyId && onlyId !== id)) continue;
    const nativeFile = path.join(grant.vaultRoot, relative);
    const source = await readPlainFileWithin(root, relative, MAX_SOURCE_BYTES);
    if (source === null) continue;
    totalChars += source.length;
    if (totalChars > 64 * 1024 * 1024)
      throw new Error("The authorized library exceeds the text limit.");
    const metadata = nativeMetadata(source, path.basename(relative));
    if (metadata.hidden || !grantAllows(grant, id, metadata.draft)) continue;
    const ext = path.extname(relative).toLowerCase();
    const href = `/runtime/local?${new URLSearchParams({ file: nativeFile, title: metadata.title, ext })}`;
    documents.push({
      id,
      title: metadata.title,
      href,
      version: await contentVersion(source),
      format: ext === ".mdx" ? "mdx" : "md",
      draft: metadata.draft,
      tags: metadata.tags,
      sourceLabel: "Local folder",
      source,
      annotationSlug: `runtime-local/${nativeFile}`,
    });
  }
  return documents;
}

async function annotationFile(root: string, vault: boolean): Promise<unknown> {
  const directory = vault ? path.join(root, ".verto") : root;
  try {
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("Invalid annotation directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const raw = await readPlainFileWithin(
    root,
    vault ? ".verto/annotations.json" : "annotations.json",
    16 * 1024 * 1024
  );
  return raw ? JSON.parse(raw) : null;
}

/** All paths derive from the app's grant and its enumerated entries, never tool ids. */
export function createNodeRepository(options: NodeRepositoryOptions): DocumentRepository {
  async function documents(grant: AgentGrant, onlyId?: string) {
    return [...(await managedDocuments(grant, onlyId)), ...(await vaultDocuments(grant, onlyId))];
  }
  async function find(id: string, grant: AgentGrant) {
    if (!grantAllows(grant, id, false)) return null;
    return (await documents(grant, id)).find((item) => item.id === id) ?? null;
  }
  return {
    async listDocuments() {
      const grant = await readAgentGrant(options);
      const all = await documents(grant);
      await ensureGrantUnchanged(options, grant);
      return all.map(documentMetadata);
    },
    async readDocument(id) {
      const grant = await readAgentGrant(options);
      const document = await find(id, grant);
      await ensureGrantUnchanged(options, grant);
      return document;
    },
    async readDocuments(ids) {
      const grant = await readAgentGrant(options);
      const all = (await documents(grant)).filter((item) => ids.includes(item.id));
      await ensureGrantUnchanged(options, grant);
      return all;
    },
    async listAnnotations(id) {
      const grant = await readAgentGrant(options, "annotations:read");
      const document = await find(id, grant);
      if (!document) throw new ContentAccessError("not_found", "Document is unavailable.");
      const root = grant.annotationRoot ?? grant.managedRoot;
      const state = await annotationFile(await plainRoot(root), grant.annotationRoot !== undefined);
      const values = contentAnnotations(state, document.annotationSlug);
      await ensureGrantUnchanged(options, grant, "annotations:read");
      return values;
    },
  };
}
