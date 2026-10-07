/** Remove MDX expressions as data, without evaluating any source. */
function withoutExpressions(source: string): string {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let output = "";
  for (const character of source) {
    if (depth === 0) {
      if (character === "{") depth = 1;
      else output += character;
      continue;
    }
    if (character === "\n") output += "\n";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
  }
  return output;
}

function plainText(source: string): string {
  return source
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\[[^\]]*\]/g, " ")
    .replace(
      /\[([^\]]+)\]\([^)]*\)|\[([^\]]+)\]\[[^\]]*\]/g,
      (_, inline, reference) => inline ?? reference
    )
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(
      /&(?:nbsp|amp|lt|gt|quot|apos);/gi,
      (entity) =>
        ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[
          entity.toLowerCase()
        ] ?? entity
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** A short prose preview for Markdown, HTML, and MDX; code and markup are never previews. */
export function firstProseParagraph(source: string, max = 200, ellipsis = "…"): string | undefined {
  const cleaned = withoutExpressions(
    withoutCode(source)
      .replace(/<!--[\s\S]*?(?:-->|$)/g, "\n")
      .replace(/<(script|style|head|pre)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "\n")
      .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi, "\n")
      .replace(/<\/?(?:p|div|section|article|blockquote|li|br)\b[^>]*>/gi, "\n\n")
  );
  const buffer: string[] = [];
  for (const line of cleaned.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buffer.length) break;
      continue;
    }
    if (/^#{1,6}\s|^(?:[-*_]\s*){3,}$|^\[[^\]]+\]:|^\|/.test(trimmed)) {
      if (buffer.length) break;
      continue;
    }
    const text = plainText(trimmed.replace(/^(?:>\s*|[-+*]\s+|\d+[.)]\s+)/, ""));
    if (text) buffer.push(text);
  }
  if (!buffer.length) return undefined;
  const text = buffer.join(" ");
  const characters = Array.from(text);
  return characters.length > max
    ? `${characters
        .slice(0, Math.max(0, max - Array.from(ellipsis).length))
        .join("")
        .trimEnd()}${ellipsis}`
    : text;
}

/** Ignore Markdown code and MDX module declarations before inspecting their contents. */
function withoutCode(source: string): string {
  let fence: string | null = null;
  let moduleBlock = false;
  return source
    .split(/\r?\n/)
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        return "";
      }
      if (fence) return "";
      if (!line.trim()) moduleBlock = false;
      if (/^(?:import|export)\s/.test(line.trim())) moduleBlock = true;
      return moduleBlock || /^\s{4}|^\t/.test(line) ? "" : line;
    })
    .join("\n");
}
