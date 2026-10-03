import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, Root, RootContent } from "hast";
import { resolveEpubPath, parseBrowserEpub } from "@/lib/document-import/epub";
import type { ConversionIssue } from "./types";

export interface ArchiveItem {
  id: string;
  path: string;
  mime: string;
  properties: string;
}
export interface ConversionChapter {
  path: string;
  title: string;
  tree: Root;
  articleId: string;
  filename: string;
  anchors: Map<string, string>;
}
export interface BookArchive {
  zip: JSZip;
  opfPath: string;
  pkg: Record<string, unknown>;
  manifest: ArchiveItem[];
  chapters: Omit<ConversionChapter, "articleId" | "filename" | "anchors">[];
  title: string;
  author?: string;
  language?: string;
}
export function list<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
export function xmlText(value: unknown): string | undefined {
  if (Array.isArray(value)) return xmlText(value[0]);
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object")
    return xmlText((value as Record<string, unknown>)["#text"]);
  return undefined;
}
export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});
export function parseHtml(html: string): Root {
  return unified().use(rehypeParse).parse(html) as Root;
}
export function walkElements(node: Root | RootContent, visit: (element: Element) => void) {
  if (node.type === "element") visit(node);
  if ("children" in node) for (const child of node.children) walkElements(child, visit);
}
export function nodeText(node: Root | RootContent): string {
  return node.type === "text"
    ? node.value
    : "children" in node
      ? node.children.map(nodeText).join("")
      : "";
}
export function property(node: Element, name: string): string {
  const match = Object.entries(node.properties).find(
    ([key]) =>
      key.replace(/[^a-z]/gi, "").toLowerCase() === name.replace(/[^a-z]/gi, "").toLowerCase()
  );
  return match ? (Array.isArray(match[1]) ? match[1].join(" ") : String(match[1] ?? "")) : "";
}
export function bodyTree(tree: Root): Root {
  let body: Element | undefined;
  walkElements(tree, (node) => {
    if (node.tagName === "body") body = node;
  });
  return body ? { type: "root", children: body.children } : tree;
}
export async function readArchiveText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`The EPUB is missing ${path}. No book has been saved.`);
  const size =
    (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  if (size > 8 * 1024 * 1024) throw new Error("An EPUB chapter exceeds the 8 MiB reading limit.");
  const value = await entry.async("string");
  if (new TextEncoder().encode(value).byteLength > 8 * 1024 * 1024)
    throw new Error("An EPUB chapter exceeds the 8 MiB reading limit.");
  return value;
}

/** Strict conversion enumeration keeps supplemental footnotes and refuses missing spine content. */
export async function openConversionArchive(
  bytes: ArrayBuffer,
  issues: ConversionIssue[]
): Promise<BookArchive> {
  if (bytes.byteLength > 50 * 1024 * 1024)
    throw new Error("This EPUB exceeds the 50 MiB import limit.");
  const zip = await JSZip.loadAsync(bytes);
  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    expanded +=
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (expanded > 200 * 1024 * 1024)
      throw new Error("This EPUB expands beyond the 200 MiB reading limit.");
  }
  const container = xmlParser.parse(await readArchiveText(zip, "META-INF/container.xml"));
  const opfPath = list<Record<string, string>>(container?.container?.rootfiles?.rootfile)[0]?.[
    "@_full-path"
  ];
  if (!opfPath || resolveEpubPath("_", opfPath) !== opfPath)
    throw new Error("This EPUB has no valid package manifest.");
  const pkg = xmlParser.parse(await readArchiveText(zip, opfPath)).package;
  const manifest: ArchiveItem[] = [];
  for (const item of list<Record<string, string>>(pkg?.manifest?.item)) {
    const path = resolveEpubPath(opfPath, item["@_href"] ?? "");
    if (path && item["@_id"])
      manifest.push({
        id: item["@_id"],
        path,
        mime: item["@_media-type"] ?? "",
        properties: item["@_properties"] ?? "",
      });
  }
  const order: ArchiveItem[] = [];
  const paths = new Set<string>();
  for (const ref of list<Record<string, string>>(pkg?.spine?.itemref)) {
    const item = manifest.find((candidate) => candidate.id === ref["@_idref"]);
    if (!item)
      throw new Error(
        `The EPUB spine refers to a missing chapter (${ref["@_idref"] ?? "unknown"}).`
      );
    if (!["application/xhtml+xml", "text/html"].includes(item.mime))
      throw new Error(`The chapter ${item.path} uses an unsupported format (${item.mime}).`);
    if (paths.has(item.path)) {
      issues.push({
        code: "duplicate-spine",
        message: `The repeated chapter ${item.path} is included once.`,
      });
      continue;
    }
    paths.add(item.path);
    order.push(item);
  }
  // Include local XHTML outside the linear spine: these frequently hold the full footnotes.
  for (const item of manifest) {
    if (
      !["application/xhtml+xml", "text/html"].includes(item.mime) ||
      /(?:^|\s)nav(?:\s|$)/.test(item.properties) ||
      paths.has(item.path)
    )
      continue;
    paths.add(item.path);
    order.push(item);
    issues.push({
      code: "supplemental-chapter",
      message: `Supplemental content ${item.path} is preserved as a separate chapter.`,
      chapter: item.path,
    });
  }
  if (!order.length || order.length > 2000)
    throw new Error("This EPUB must contain between 1 and 2,000 readable chapters.");
  // Reuse the reader's tested DRM/fixed-layout/resource limits without changing its behavior.
  const validated = await parseBrowserEpub(new Uint8Array(bytes));
  const chapters: BookArchive["chapters"] = [];
  for (const [index, item] of order.entries()) {
    const tree = bodyTree(parseHtml(await readArchiveText(zip, item.path)));
    let title = "";
    walkElements(tree, (node) => {
      if (!title && /^h[1-6]$/.test(node.tagName)) title = nodeText(node).trim();
    });
    chapters.push({ path: item.path, title: title || `Chapter ${index + 1}`, tree });
  }
  return {
    zip,
    opfPath,
    pkg,
    manifest,
    chapters,
    title: validated.title,
    author: validated.author,
    language: validated.language,
  };
}
