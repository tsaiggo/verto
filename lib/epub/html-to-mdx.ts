// XHTML (one EPUB chapter) to Markdown, using the same unified/remark/rehype
// ecosystem Verto already renders MDX with. A small hast pass runs before the
// hast-to-mdast bridge to drop the document head, capture the first heading as
// the chapter title, and rewrite image sources to vault-served paths.

import path from "node:path";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";

export interface ImageRef {
  /** Path of the image inside the EPUB zip (posix). */
  zipPath: string;
  /** Path the rewritten Markdown references, relative to the chapter. */
  outPath: string;
}

export interface ChapterContent {
  title: string | null;
  body: string;
  images: ImageRef[];
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function findBody(node: HastNode): HastNode | null {
  if (node.tagName === "body") return node;
  for (const child of node.children ?? []) {
    const found = findBody(child);
    if (found) return found;
  }
  return null;
}

function walk(node: HastNode, visit: (n: HastNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

// EPUB chapters commonly wrap text in anchors used only as link targets
// (`<a id="...">`). Without an href those would become empty `[text]()` links,
// so unwrap them, keeping the text.
function unwrapEmptyAnchors(node: HastNode): void {
  if (!node.children) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "element" && child.tagName === "a") {
      const href = child.properties?.href;
      const hasHref = typeof href === "string" && href.trim() !== "";
      if (!hasHref) {
        unwrapEmptyAnchors(child);
        next.push(...(child.children ?? []));
        continue;
      }
    }
    unwrapEmptyAnchors(child);
    next.push(child);
  }
  node.children = next;
}

function uniqueOut(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const ext = path.posix.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function isExternal(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//");
}

export async function htmlToMarkdown(
  html: string,
  opts: { chapterDir: string; imageBaseUrl: string }
): Promise<ChapterContent> {
  const collector: { title: string | null; images: ImageRef[] } = { title: null, images: [] };
  const usedOut = new Set<string>();

  function extractPass() {
    return (tree: HastNode) => {
      const body = findBody(tree);
      if (body?.children) tree.children = body.children;
      unwrapEmptyAnchors(tree);

      walk(tree, (node) => {
        if (node.type !== "element") return;
        if (!collector.title && node.tagName && HEADINGS.has(node.tagName)) {
          const text = textOf(node).replace(/\s+/g, " ").trim();
          if (text) collector.title = text;
        }
        if (node.tagName === "img" && node.properties) {
          const src = typeof node.properties.src === "string" ? node.properties.src : "";
          if (!src || isExternal(src) || src.startsWith("data:")) return;
          const zipPath = path.posix.normalize(
            path.posix.join(opts.chapterDir, decodeURIComponent(src))
          );
          const out = uniqueOut(path.posix.basename(zipPath), usedOut);
          const outPath = `images/${out}`;
          collector.images.push({ zipPath, outPath });
          node.properties.src = opts.imageBaseUrl ? `${opts.imageBaseUrl}/${outPath}` : outPath;
        }
      });
    };
  }

  const file = await unified()
    .use(rehypeParse)
    .use(extractPass)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, { bullet: "-", emphasis: "_", rule: "-", fences: true })
    .process(html);

  return { title: collector.title, body: String(file).trim(), images: collector.images };
}
