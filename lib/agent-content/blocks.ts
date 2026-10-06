import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { ContentBlock, ContentCitation, ContentDocument } from "./types";

interface TextNode {
  type: string;
  value?: string;
  children?: TextNode[];
}

const MAX_BLOCK_CHARS = 4000;
const MAX_EXCERPT_CHARS = 480;

export function normalizeContentText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function textFromNode(node: TextNode): string {
  if (node.type === "html" || node.type.startsWith("mdx")) return "";
  if (node.type === "break") return " ";
  if (node.value !== undefined) return node.value;
  const inline = ["paragraph", "heading", "link", "strong", "emphasis", "delete"].includes(
    node.type
  );
  return (node.children ?? []).map(textFromNode).join(inline ? "" : " ");
}

function blockHash(value: string): string {
  let hash = 2166136261;
  for (let at = 0; at < value.length; at++) {
    hash ^= value.charCodeAt(at);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function citationHref(
  href: string,
  citation: Pick<ContentCitation, "version" | "blockId" | "excerpt">
): string {
  const payload = {
    version: citation.version,
    blockId: citation.blockId,
    excerpt: citation.excerpt.slice(0, MAX_EXCERPT_CHARS),
  };
  return `${href.split("#")[0]}#verto-citation=${encodeURIComponent(JSON.stringify(payload))}`;
}

export function parseCitationHash(
  hash: string
): Pick<ContentCitation, "version" | "blockId" | "excerpt"> | null {
  if (!hash.startsWith("#verto-citation=") || hash.length > 5000) return null;
  try {
    const value = JSON.parse(decodeURIComponent(hash.slice("#verto-citation=".length)));
    if (
      typeof value.version !== "string" ||
      typeof value.blockId !== "string" ||
      typeof value.excerpt !== "string" ||
      !value.excerpt.trim() ||
      value.excerpt.length > MAX_EXCERPT_CHARS
    )
      return null;
    return { version: value.version, blockId: value.blockId, excerpt: value.excerpt };
  } catch {
    return null;
  }
}

export function makeCitation(
  document: ContentDocument,
  blockId: string,
  text: string,
  label: string
): ContentCitation {
  const citation = {
    docId: document.id,
    version: document.version,
    blockId,
    excerpt: text.slice(0, MAX_EXCERPT_CHARS),
    label: label.slice(0, 300),
    href: document.href,
  };
  return { ...citation, href: citationHref(document.href, citation) };
}

/** Parse data only. MDX expressions, HTML and imports are never evaluated. */
export function documentBlocks(document: ContentDocument, raw: string): ContentBlock[] {
  const source = raw.replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  const blocks: ContentBlock[] = [];
  const occurrences = new Map<string, number>();
  let section = document.title.slice(0, 260);
  for (const node of tree.children as TextNode[]) {
    if (node.type === "definition" || node.type === "thematicBreak") continue;
    const text = normalizeContentText(textFromNode(node));
    if (!text || /^\s*(?:import|export)\s/.test(text)) continue;
    const kind = node.type === "heading" ? "heading" : node.type === "code" ? "code" : "paragraph";
    if (kind === "heading") section = text.slice(0, 260);
    for (let at = 0; at < text.length; at += MAX_BLOCK_CHARS) {
      const part = text.slice(at, at + MAX_BLOCK_CHARS);
      const base = `block-${blockHash(`${kind}\n${part}`)}`;
      const count = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      const label = kind === "heading" ? section : `${section} · passage ${blocks.length + 1}`;
      blocks.push({
        id,
        index: blocks.length,
        kind,
        label,
        text: part,
        citation: makeCitation(document, id, part, label),
      });
    }
  }
  return blocks;
}
