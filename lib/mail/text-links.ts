export function safeMailLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const href = value.trim();
  if (!href || /[\u0000-\u0020\u007f<>]/.test(href)) return undefined;
  try {
    const url = new URL(href);
    if (url.username || url.password) return undefined;
    if (url.protocol === "http:" || url.protocol === "https:")
      return url.hostname ? href : undefined;
    if (url.protocol === "mailto:" && /^[^<>\s@]+@[^<>\s@]+$/.test(url.pathname)) return href;
  } catch {
    // Unsupported or incomplete URLs remain plain text.
  }
  return undefined;
}

export interface MailTextPart {
  text: string;
  href?: string;
}

function trimLinkEnd(value: string): string {
  let result = value.replace(/[.,;:!?，。；：！？）】》]+$/u, "");
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]) {
    while (result.endsWith(close) && result.split(close).length > result.split(open).length)
      result = result.slice(0, -1);
  }
  return result;
}

/** Linkify explicit web/email URLs only; never interpret body text as HTML. */
export function mailTextParts(text: string): MailTextPart[] {
  const parts: MailTextPart[] = [];
  let start = 0;
  for (const match of text.matchAll(/<([^<>\s]+)>|(?:https?:\/\/|mailto:)[^\s<>"']+/gi)) {
    const enclosed = match[1] !== undefined;
    if (!enclosed && match.index > 0 && !/[\s([{（【"'=]/u.test(text[match.index - 1])) continue;
    const value = enclosed ? match[1] : trimLinkEnd(match[0]);
    const href = safeMailLink(value);
    if (!href) continue;
    const offset = match.index + (enclosed ? 1 : 0);
    if (offset > start) parts.push({ text: text.slice(start, offset) });
    parts.push({ text: value, href });
    start = offset + value.length;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });
  return parts;
}
