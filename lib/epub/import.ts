// EPUB to MDX importer (core). An EPUB is a zip of XHTML documents plus an OPF
// manifest/spine describing reading order. This reads the spine in order,
// converts each chapter's XHTML to Markdown (see ./html-to-mdx), and returns a
// book as a set of MDX chapters plus the images they reference. Writing to disk
// is the caller's job (see scripts/import-epub.ts).

import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import { htmlToMarkdown } from "./html-to-mdx";

export interface ImportedImage {
  zipPath: string;
  outPath: string;
  data: Uint8Array;
}

export interface ImportedChapter {
  slug: string;
  title: string;
  order: number;
  mdx: string;
}

export interface ImportedBook {
  title: string;
  slug: string;
  author?: string;
  language?: string;
  chapters: ImportedChapter[];
  images: ImportedImage[];
}

export interface ImportEpubOptions {
  /**
   * URL path mounted before the book slug for image links (default ""). Images
   * end up at `<imageUrlPrefix>/<slug>/images/<name>`, which the caller serves
   * from `public/<slug>/images/<name>`.
   */
  imageUrlPrefix?: string;
}

const XHTML_MEDIA = new Set(["application/xhtml+xml", "text/html"]);

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function firstText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return firstText(value[0]);
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" ? text.trim() || undefined : undefined;
  }
  return undefined;
}

function buildParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    trimValues: true,
  });
}

async function readText(zip: JSZip, name: string): Promise<string | null> {
  const entry = zip.file(name);
  return entry ? entry.async("string") : null;
}

interface ManifestItem {
  href: string;
  mediaType: string;
}
type Manifest = Map<string, ManifestItem>;

function readManifest(items: Record<string, string>[]): Manifest {
  const manifest: Manifest = new Map();
  for (const item of items) {
    if (item["@_id"] && item["@_href"]) {
      manifest.set(item["@_id"], { href: item["@_href"], mediaType: item["@_media-type"] ?? "" });
    }
  }
  return manifest;
}

function chapterItem(ref: Record<string, string>, manifest: Manifest): ManifestItem | null {
  if (ref["@_linear"] === "no") return null;
  const item = ref["@_idref"] ? manifest.get(ref["@_idref"]) : undefined;
  return item && XHTML_MEDIA.has(item.mediaType) ? item : null;
}

async function buildChapters(
  zip: JSZip,
  ctx: {
    spineRefs: Record<string, string>[];
    manifest: Manifest;
    opfDir: string;
    imageBaseUrl: string;
    bookTitle: string;
  }
): Promise<{ chapters: ImportedChapter[]; imageRefs: Map<string, string> }> {
  const chapters: ImportedChapter[] = [];
  const usedSlugs = new Set<string>();
  const imageRefs = new Map<string, string>();
  let order = 0;

  for (const ref of ctx.spineRefs) {
    const item = chapterItem(ref, ctx.manifest);
    if (!item) continue;
    const zipPath = path.posix.normalize(path.posix.join(ctx.opfDir, item.href));
    const html = await readText(zip, zipPath);
    if (html === null) continue;

    const content = await htmlToMarkdown(html, {
      chapterDir: path.posix.dirname(zipPath),
      imageBaseUrl: ctx.imageBaseUrl,
    });
    if (!content.body.trim() && content.images.length === 0) continue;

    const title = content.title ?? `Chapter ${order + 1}`;
    for (const img of content.images) imageRefs.set(img.zipPath, img.outPath);
    chapters.push({
      slug: uniqueSlug(slugify(title), usedSlugs),
      title,
      order,
      mdx: frontmatter(title, order, ctx.bookTitle) + content.body + "\n",
    });
    order += 1;
  }
  return { chapters, imageRefs };
}

async function collectImages(zip: JSZip, imageRefs: Map<string, string>): Promise<ImportedImage[]> {
  const images: ImportedImage[] = [];
  for (const [zipPath, outPath] of imageRefs) {
    const entry = zip.file(zipPath);
    if (entry) images.push({ zipPath, outPath, data: await entry.async("uint8array") });
  }
  return images;
}

async function resolveOpfPath(zip: JSZip, parser: XMLParser): Promise<string> {
  const containerXml = await readText(zip, "META-INF/container.xml");
  if (!containerXml) throw new Error("Not a valid EPUB: missing META-INF/container.xml");
  const rootfile = asArray<Record<string, string>>(
    parser.parse(containerXml)?.container?.rootfiles?.rootfile
  )[0];
  const opfPath = rootfile?.["@_full-path"];
  if (!opfPath) throw new Error("Not a valid EPUB: no rootfile in container.xml");
  return opfPath;
}

function readMetadata(metadata: unknown): { title: string; author?: string; language?: string } {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  return {
    title: firstText(meta.title) ?? "Untitled",
    author: firstText(meta.creator),
    language: firstText(meta.language),
  };
}

export async function importEpub(
  bytes: Uint8Array,
  opts: ImportEpubOptions = {}
): Promise<ImportedBook> {
  const zip = await JSZip.loadAsync(bytes);
  const parser = buildParser();
  const opfPath = await resolveOpfPath(zip, parser);

  const opfXml = await readText(zip, opfPath);
  if (!opfXml) throw new Error(`Not a valid EPUB: missing OPF at ${opfPath}`);
  const opf = parser.parse(opfXml).package;

  const { title, author, language } = readMetadata(opf?.metadata);
  const slug = slugify(title);
  const imageBaseUrl = `${(opts.imageUrlPrefix ?? "").replace(/\/+$/, "")}/${slug}`;

  const { chapters, imageRefs } = await buildChapters(zip, {
    spineRefs: asArray<Record<string, string>>(opf?.spine?.itemref),
    manifest: readManifest(asArray<Record<string, string>>(opf?.manifest?.item)),
    opfDir: path.posix.dirname(opfPath),
    imageBaseUrl,
    bookTitle: title,
  });

  return {
    title,
    slug,
    author,
    language,
    chapters,
    images: await collectImages(zip, imageRefs),
  };
}

function uniqueSlug(slug: string, used: Set<string>): string {
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  for (let i = 2; ; i += 1) {
    const candidate = `${slug}-${i}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function frontmatter(title: string, order: number, book: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\norder: ${order}\nbook: ${JSON.stringify(book)}\n---\n\n`;
}
