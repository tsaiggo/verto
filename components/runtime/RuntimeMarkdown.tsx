import type { ReactNode } from "react";

interface RuntimeMarkdownProps {
  source: string;
}

type Block =
  | { type: "heading"; depth: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "code"; lang: string; value: string };

export function RuntimeMarkdown({ source }: RuntimeMarkdownProps) {
  const blocks = parseBlocks(source);
  return <>{blocks.map(renderBlock)}</>;
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let unordered: string[] = [];
  let ordered: string[] = [];
  let code: { lang: string; lines: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushLists() {
    if (unordered.length > 0) {
      blocks.push({ type: "unordered", items: unordered });
      unordered = [];
    }
    if (ordered.length > 0) {
      blocks.push({ type: "ordered", items: ordered });
      ordered = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (code) {
      if (trimmed.startsWith("```")) {
        blocks.push({ type: "code", lang: code.lang, value: code.lines.join("\n") });
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushLists();
      code = { lang: trimmed.slice(3).trim(), lines: [] };
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      flushLists();
      continue;
    }

    if (looksLikeRawHtml(trimmed)) {
      flushParagraph();
      flushLists();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        depth: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    const unorderedItem = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (unorderedItem) {
      flushParagraph();
      ordered = [];
      unordered.push(unorderedItem[1]);
      continue;
    }

    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (orderedItem) {
      flushParagraph();
      unordered = [];
      ordered.push(orderedItem[1]);
      continue;
    }

    flushLists();
    paragraph.push(trimmed);
  }

  if (code) blocks.push({ type: "code", lang: code.lang, value: code.lines.join("\n") });
  flushParagraph();
  flushLists();
  return blocks;
}

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case "heading": {
      const children = renderInline(block.text);
      if (block.depth === 1) return <h1 key={index}>{children}</h1>;
      if (block.depth === 2) return <h2 key={index}>{children}</h2>;
      return <h3 key={index}>{children}</h3>;
    }
    case "paragraph":
      return <p key={index}>{renderInline(block.text)}</p>;
    case "unordered":
      return <ul key={index}>{block.items.map(renderListItem)}</ul>;
    case "ordered":
      return <ol key={index}>{block.items.map(renderListItem)}</ol>;
    case "code":
      return (
        <pre key={index} data-language={block.lang || undefined}>
          <code>{block.value}</code>
        </pre>
      );
  }
}

function renderListItem(item: string, index: number) {
  return <li key={index}>{renderInline(item)}</li>;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(renderInlineToken(match[0], nodes.length));
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderInlineToken(token: string, key: number): ReactNode {
  if (token.startsWith("`") && token.endsWith("`")) {
    return <code key={key}>{token.slice(1, -1)}</code>;
  }
  if (token.startsWith("**") && token.endsWith("**")) {
    return <strong key={key}>{token.slice(2, -2)}</strong>;
  }

  const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
  if (link) {
    const href = link[2].trim();
    if (isSafeHref(href)) {
      return (
        <a key={key} href={href}>
          {link[1]}
        </a>
      );
    }
    return link[1];
  }

  return token;
}

function looksLikeRawHtml(value: string): boolean {
  return /^<\/?[a-zA-Z][^>]*>$/.test(value);
}

function isSafeHref(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}
