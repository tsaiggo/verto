import { unified } from "unified";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { createMdxProcessor } from "safe-mdx/parse";
import type { Root, RootContent, Text } from "hast";
import type { Handle } from "hast-util-to-mdast";
import type { Root as MarkdownRoot } from "mdast";
import { resolveEpubPath } from "@/lib/document-import/epub";
import type { BookAsset, ConversionIssue } from "./types";
import {
  walkElements,
  nodeText,
  property,
  type BookArchive,
  type ConversionChapter,
} from "./convert-archive";
import { resolveChapterLink } from "./convert-navigation";

export function safeSlug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "chapter"
  );
}
export function bookUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function assignAnchors(
  chapter: ConversionChapter,
  index: number,
  issues: ConversionIssue[]
) {
  const used = new Set<string>();
  walkElements(chapter.tree, (node) => {
    const original = property(node, "id") || (node.tagName === "a" ? property(node, "name") : "");
    if (!original) return;
    if (chapter.anchors.has(original)) {
      issues.push({
        code: "duplicate-anchor",
        message: `The repeated anchor “${original}” points to its first occurrence.`,
        chapter: chapter.title,
      });
      delete node.properties.id;
      return;
    }
    const base = `epub-${String(index + 1).padStart(3, "0")}-${safeSlug(original)}`;
    let anchor = base;
    let number = 2;
    while (used.has(anchor)) anchor = `${base}-${number++}`;
    used.add(anchor);
    chapter.anchors.set(original, anchor);
    node.properties.id = anchor;
  });
}
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};
function fingerprint(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `${bytes.byteLength}:${hash >>> 0}`;
}
function sameBytes(left: ArrayBuffer, right: Uint8Array): boolean {
  const a = new Uint8Array(left);
  return a.length === right.length && a.every((value, index) => value === right[index]);
}
function supportedImage(bytes: Uint8Array, mime: string): boolean {
  const head = Array.from(bytes.slice(0, 12))
    .map((value) => String.fromCharCode(value))
    .join("");
  if (mime === "image/png")
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    );
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif") return /^GIF8[79]a/.test(head);
  if (mime === "image/webp") return head.startsWith("RIFF") && head.slice(8) === "WEBP";
  return mime === "image/avif" && head.slice(4, 8) === "ftyp";
}
export async function collectBookAssets(
  archive: BookArchive,
  chapters: ConversionChapter[],
  bookId: string,
  issues: ConversionIssue[],
  maxBytes: number
): Promise<{ assets: BookAsset[]; paths: Map<string, BookAsset> }> {
  const references = new Set<string>();
  for (const chapter of chapters)
    walkElements(chapter.tree, (node) => {
      if (node.tagName !== "img") return;
      const src = property(node, "src");
      const path = resolveEpubPath(chapter.path, src);
      if (!src || !path) {
        issues.push({
          code: "remote-image",
          message: "A remote or embedded image was removed. Its description is preserved.",
          chapter: chapter.title,
        });
        return;
      }
      references.add(path);
    });
  const assets: BookAsset[] = [];
  const paths = new Map<string, BookAsset>();
  const hashes = new Map<string, BookAsset[]>();
  let total = 0;
  for (const path of references) {
    const item = archive.manifest.find((candidate) => candidate.path === path);
    const entry = archive.zip.file(path);
    if (!entry || !item || !IMAGE_MIMES.has(item.mime)) {
      issues.push({
        code: "image-unavailable",
        message: `Image ${path} is missing or uses an unsupported format.`,
      });
      continue;
    }
    const expandedSize =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (expandedSize > maxBytes)
      throw new Error("The book’s extracted images exceed the 100 MiB asset limit.");
    const raw = await entry.async("uint8array");
    if (!supportedImage(raw, item.mime)) {
      issues.push({
        code: "image-invalid",
        message: `Image ${path} does not match its declared image format.`,
      });
      continue;
    }
    const hash = fingerprint(raw);
    const duplicate = hashes
      .get(hash)
      ?.find((asset) => asset.mime === item.mime && sameBytes(asset.bytes, raw));
    if (duplicate) {
      paths.set(path, duplicate);
      continue;
    }
    total += raw.byteLength;
    if (total > maxBytes)
      throw new Error("The book’s extracted images exceed the 100 MiB asset limit.");
    const basename = safeSlug(
      path
        .split("/")
        .at(-1)!
        .replace(/\.[^.]+$/, "")
    );
    const asset: BookAsset = {
      id: bookUuid(),
      bookId,
      filename: `image-${String(assets.length + 1).padStart(3, "0")}-${basename}${EXTENSIONS[item.mime]}`,
      mime: item.mime,
      bytes: raw.slice().buffer,
    };
    assets.push(asset);
    paths.set(path, asset);
    hashes.set(hash, [...(hashes.get(hash) ?? []), asset]);
  }
  return { assets, paths };
}

function removeUnsupported(tree: Root, chapter: ConversionChapter, issues: ConversionIssue[]) {
  const strip = <Child extends RootContent>(children: Child[]): Array<Child | Text> =>
    children.flatMap<Child | Text>((child) => {
      if (child.type !== "element") return [child];
      if (
        [
          "script",
          "style",
          "iframe",
          "object",
          "embed",
          "svg",
          "math",
          "audio",
          "video",
          "form",
          "input",
          "button",
        ].includes(child.tagName)
      ) {
        issues.push({
          code: "unsupported-element",
          message: `The ${child.tagName} element is not converted to editable Markdown.`,
          chapter: chapter.title,
        });
        const label = ["svg", "math", "audio", "video", "object"].includes(child.tagName)
          ? property(child, "aria-label") || nodeText(child).trim()
          : "";
        return label ? [{ type: "text" as const, value: label }] : [];
      }
      if (property(child, "style"))
        issues.push({
          code: "publisher-styles",
          message: "Publisher styling is replaced by the workspace reading theme.",
          chapter: chapter.title,
        });
      child.children = strip(child.children);
      return [child];
    });
  tree.children = strip(tree.children);
}
function rewriteChapter(
  tree: Root,
  chapter: ConversionChapter,
  chapters: ConversionChapter[],
  assets: Map<string, BookAsset>,
  issues: ConversionIssue[]
) {
  walkElements(tree, (node) => {
    if (node.properties.dataMdxBookAnchor) return;
    if (node.tagName === "img") {
      const path = resolveEpubPath(chapter.path, property(node, "src"));
      const asset = path ? assets.get(path) : undefined;
      if (asset) node.properties.src = `./assets/${asset.filename}`;
      else {
        node.tagName = "span";
        node.children = [
          {
            type: "text",
            value: property(node, "alt")
              ? `[Image: ${property(node, "alt")}]`
              : "[Image unavailable]",
          },
        ];
        node.properties = {};
      }
    }
    if (node.tagName === "a") {
      const href = property(node, "href");
      if (href && !/^(https?:|mailto:)/i.test(href)) {
        const target = resolveChapterLink(chapters, chapter.path, href);
        if (target)
          node.properties.href = `./${target.chapter.filename}${target.anchor ? `#${target.anchor}` : ""}`;
        else {
          delete node.properties.href;
          issues.push({
            code: "internal-link",
            message: `The local link “${nodeText(node)}” (${href}) has no readable target. Its text is preserved.`,
            chapter: chapter.title,
          });
        }
      }
    }
    const id = property(node, "id");
    if (id) {
      delete node.properties.id;
      node.children.unshift({
        type: "element",
        tagName: "span",
        properties: { id, dataMdxBookAnchor: true },
        children: [],
      });
    }
  });
}
const anchorSpan: Handle = (state, node) => {
  if (node.properties.dataMdxBookAnchor && typeof node.properties.id === "string")
    return { type: "html", value: `<span id="${node.properties.id}" />` };
  return state.all(node);
};
const unlinkedAnchor: Handle = (state, node) => {
  const children = state.all(node);
  return node.properties.href
    ? {
        type: "link",
        url: String(node.properties.href),
        title: typeof node.properties.title === "string" ? node.properties.title : null,
        children: children as import("mdast").PhrasingContent[],
      }
    : children;
};
export async function chapterToMdx(
  chapter: ConversionChapter,
  chapters: ConversionChapter[],
  assets: Map<string, BookAsset>,
  issues: ConversionIssue[]
): Promise<string> {
  const tree = structuredClone(chapter.tree);
  removeUnsupported(tree, chapter, issues);
  rewriteChapter(tree, chapter, chapters, assets, issues);
  const schema = {
    ...defaultSchema,
    clobberPrefix: "",
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "id", "dataMdxBookAnchor"],
      a: ["href", "title"],
    },
  };
  const processor = unified()
    .use(rehypeSanitize, schema)
    .use(rehypeRemark, { handlers: { span: anchorSpan, a: unlinkedAnchor } })
    .use(remarkGfm);
  const serializer = createMdxProcessor({ remarkPlugins: [] }).use(remarkStringify, {
    bullet: "-",
    emphasis: "_",
    fences: true,
    unsafe: [
      { character: "{", inConstruct: ["phrasing"] },
      { character: "}", inConstruct: ["phrasing"] },
      { character: "i", after: "mport(?:[\\t ]|$)", inConstruct: ["phrasing"] },
      { character: "e", after: "xport(?:[\\t ]|$)", inConstruct: ["phrasing"] },
    ],
  });
  const mdast = (await processor.run(tree)) as unknown as MarkdownRoot;
  return serializer.stringify(mdast).trim();
}
export function validateBookMdx(source: string, chapter: string) {
  const processor = createMdxProcessor({ remarkPlugins: [] });
  let tree: unknown;
  try {
    tree = processor.runSync(processor.parse(source));
  } catch {
    throw new Error(
      `The chapter “${chapter}” could not be converted to valid MDX. No book has been saved.`
    );
  }
  const inspect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const value = node as {
      type?: string;
      name?: string;
      children?: unknown[];
      attributes?: { type?: string; name?: string; value?: unknown }[];
    };
    if (["mdxTextExpression", "mdxFlowExpression", "mdxjsEsm"].includes(value.type ?? ""))
      throw new Error(
        `The chapter “${chapter}” contains text that could not be converted safely to MDX.`
      );
    if (
      (value.type === "mdxJsxTextElement" || value.type === "mdxJsxFlowElement") &&
      (value.name !== "span" ||
        value.attributes?.some(
          (attribute) => attribute.name !== "id" || typeof attribute.value !== "string"
        ))
    )
      throw new Error(`The chapter “${chapter}” contains unsupported MDX markup.`);
    value.children?.forEach(inspect);
  };
  inspect(tree);
}
