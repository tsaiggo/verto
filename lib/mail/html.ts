import rehypeParse from "rehype-parse";
import { unified } from "unified";

interface HtmlNode {
  type: string;
  value?: string;
  tagName?: string;
  children?: HtmlNode[];
}

const parser = unified().use(rehypeParse, { fragment: true });
const skipped = new Set(["head", "script", "style", "template", "noscript", "svg"]);
const blocks = new Set([
  "article",
  "blockquote",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
]);

function nodeText(node: HtmlNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.tagName && skipped.has(node.tagName)) return "";
  if (node.tagName === "br") return "\n";
  const content = (node.children ?? []).map(nodeText).join("");
  if (node.tagName === "td" || node.tagName === "th") return `${content}\t`;
  return node.tagName && blocks.has(node.tagName) ? `\n${content}\n` : content;
}

/** Convert untrusted email HTML to inert plain text without creating browser DOM. */
export function mailHtmlToText(html: string): string {
  if (!html) return "";
  return nodeText(parser.parse(html) as HtmlNode)
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
