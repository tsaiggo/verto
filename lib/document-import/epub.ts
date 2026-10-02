import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Element, Root, RootContent } from "hast";

export interface EpubChapter {
  id: string;
  path: string;
  title: string;
  html: string;
  text: string;
}
export interface EpubAsset {
  path: string;
  mime: string;
  bytes: Uint8Array;
}
export interface ParsedEpub {
  title: string;
  author?: string;
  language?: string;
  chapters: EpubChapter[];
  assets: EpubAsset[];
}

const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
const MAX_CHAPTER_BYTES = 8 * 1024 * 1024;
const MAX_CHAPTERS = 2000;
const SAFE_IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const XHTML = new Set(["application/xhtml+xml", "text/html"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

function array<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
function text(value: unknown): string | undefined {
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") return text((value as Record<string, unknown>)["#text"]);
  return undefined;
}
function textOf(node: Root | RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join(" ") : "";
}
/** Resolve an EPUB archive path without browser URL normalization or Node APIs. */
export function resolveEpubPath(base: string, reference: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith("//")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(reference.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return null;
  const parts = base.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

function visit(node: Root | RootContent, fn: (node: Element) => void) {
  if (node.type === "element") fn(node);
  if ("children" in node) for (const child of node.children) visit(child, fn);
}

/** Portable reflowable EPUB: reading order and semantics, never executable publisher HTML. */
export async function parseBrowserEpub(bytes: Uint8Array): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(bytes);
  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    expanded += size;
    if (expanded > MAX_EXPANDED_BYTES)
      throw new Error("This EPUB expands beyond the 200 MiB reading limit.");
  }
  const read = async (path: string) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`The EPUB is missing ${path}.`);
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (size > MAX_CHAPTER_BYTES)
      throw new Error("An EPUB chapter exceeds the 8 MiB reading limit.");
    const value = await entry.async("string");
    if (value.length > MAX_CHAPTER_BYTES)
      throw new Error("An EPUB chapter is too large to read safely.");
    return value;
  };
  const container = parser.parse(await read("META-INF/container.xml"));
  const root = array<Record<string, string>>(container?.container?.rootfiles?.rootfile)[0];
  const opfPath = root?.["@_full-path"];
  if (!opfPath || resolveEpubPath("_", opfPath) !== opfPath)
    throw new Error("This EPUB has no valid package manifest.");
  const pkg = parser.parse(await read(opfPath)).package;
  if (!pkg) throw new Error("This EPUB has an unreadable package manifest.");
  const properties = array<Record<string, unknown>>(pkg.metadata?.meta);
  if (
    properties.some(
      (property) =>
        property["@_property"] === "rendition:layout" && text(property) === "pre-paginated"
    )
  ) {
    throw new Error(
      "This EPUB uses a fixed layout. Import a reflowable EPUB or its PDF edition to read it here."
    );
  }
  if (zip.file("META-INF/encryption.xml")) {
    const encryption = await read("META-INF/encryption.xml");
    // Font obfuscation is safe to ignore; encrypted chapters are not readable here.
    const entries = array<Record<string, { "@_Algorithm"?: string }>>(
      parser.parse(encryption)?.encryption?.EncryptedData
    );
    const fontAlgorithms = new Set([
      "http://www.idpf.org/2008/embedding",
      "http://ns.adobe.com/pdf/enc#RC",
    ]);
    if (
      entries.some((entry) => !fontAlgorithms.has(entry.EncryptionMethod?.["@_Algorithm"] ?? ""))
    ) {
      throw new Error("This EPUB is encrypted. Import a DRM-free copy to read it.");
    }
  }
  const manifest = new Map<string, { path: string; mime: string }>();
  for (const item of array<Record<string, string>>(pkg.manifest?.item)) {
    const path = resolveEpubPath(opfPath, item["@_href"] ?? "");
    if (item["@_id"] && path)
      manifest.set(item["@_id"], { path, mime: item["@_media-type"] ?? "" });
  }
  const readingOrder = array<Record<string, string>>(pkg.spine?.itemref)
    .filter((ref) => ref["@_linear"] !== "no")
    .map((ref) => manifest.get(ref["@_idref"]))
    .filter((item): item is { path: string; mime: string } => !!item && XHTML.has(item.mime));
  if (!readingOrder.length) throw new Error("This EPUB has no readable chapters.");
  if (readingOrder.length > MAX_CHAPTERS)
    throw new Error("This EPUB contains more than 2,000 chapters.");
  const chapterIds = new Map(
    readingOrder.map((item, index) => [item.path, `epub-chapter-${index + 1}`])
  );
  const imagePaths = new Map(
    [...manifest.values()]
      .filter((item) => SAFE_IMAGES.has(item.mime))
      .map((item) => [item.path, item.mime])
  );
  const referencedImages = new Set<string>();
  const chapters: EpubChapter[] = [];
  const schema = {
    ...defaultSchema,
    tagNames: defaultSchema.tagNames?.filter(
      (name) => !["input", "button", "select", "textarea"].includes(name)
    ),
    clobberPrefix: "",
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
      a: ["href", "title", "target", "rel"],
    },
    protocols: { ...defaultSchema.protocols, src: ["verto-asset"] },
  };
  for (const [index, item] of readingOrder.entries()) {
    const id = chapterIds.get(item.path)!;
    let heading = "";
    function rewrite() {
      return (tree: Root) => {
        const html = tree.children.find(
          (node): node is Element => node.type === "element" && node.tagName === "html"
        );
        const body = html?.children.find(
          (node): node is Element => node.type === "element" && node.tagName === "body"
        );
        if (body) tree.children = body.children;
        visit(tree, (node) => {
          if (!heading && /^h[1-6]$/.test(node.tagName))
            heading = textOf(node).replace(/\s+/g, " ").trim();
          if (typeof node.properties.id === "string")
            node.properties.id = `${id}--${node.properties.id}`;
          if (node.tagName === "img") {
            const src = typeof node.properties.src === "string" ? node.properties.src : "";
            const path = resolveEpubPath(item.path, src);
            if (path && imagePaths.has(path)) {
              node.properties.src = `verto-asset:${encodeURIComponent(path)}`;
              referencedImages.add(path);
            } else {
              delete node.properties.src;
            }
          }
          if (node.tagName === "a" && typeof node.properties.href === "string") {
            const href = node.properties.href;
            if (/^https?:/i.test(href)) {
              node.properties.target = "_blank";
              node.properties.rel = ["noopener", "noreferrer"];
            } else if (!/^mailto:/i.test(href)) {
              const target = href.startsWith("#") ? item.path : resolveEpubPath(item.path, href);
              const targetId = target ? chapterIds.get(target) : undefined;
              if (targetId)
                node.properties.href = `#${targetId}${href.includes("#") ? `--${href.split("#")[1]}` : ""}`;
              else delete node.properties.href;
            }
          }
        });
      };
    }
    const processor = unified()
      .use(rehypeParse)
      .use(rewrite)
      .use(rehypeSanitize, schema)
      .use(rehypeStringify);
    const output = await processor.process(await read(item.path));
    const safeTree = processor.parse(String(output)) as Root;
    chapters.push({
      id,
      path: item.path,
      title: heading || `Chapter ${index + 1}`,
      html: String(output),
      text: textOf(safeTree).replace(/\s+/g, " ").trim(),
    });
  }
  if (!chapters.some((chapter) => chapter.text || /<img[^>]+src=/.test(chapter.html)))
    throw new Error("This EPUB contains no readable text or supported images.");
  const assets: EpubAsset[] = [];
  for (const path of referencedImages) {
    const entry = zip.file(path);
    if (entry)
      assets.push({ path, mime: imagePaths.get(path)!, bytes: await entry.async("uint8array") });
  }
  return {
    title: text(pkg.metadata?.title) ?? "Untitled book",
    author: text(pkg.metadata?.creator),
    language: text(pkg.metadata?.language),
    chapters,
    assets,
  };
}
