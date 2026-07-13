const BROWSER_LOCAL_PREFIX = "browser-local:";

/** Remove the title heading already represented by the reader masthead. */
export function stripRuntimeTitleHeading(source: string): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  let cursor = 0;

  if (lines[0]?.replace(/^\uFEFF/, "").trim() === "---") {
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closing === -1) return source;
    cursor = closing + 1;
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  if (!/^#\s+\S/.test(lines[cursor] ?? "")) return source;

  lines.splice(cursor, 1);
  if (lines[cursor]?.trim() === "") lines.splice(cursor, 1);
  return lines.join(newline);
}

/** Keep opaque/absolute runtime IDs out of the visible page identity. */
export function runtimeFileLabel(file: string, title: string, ext: string): string {
  if (!file) return `${title}${ext}`;

  const browserPath = file.startsWith(BROWSER_LOCAL_PREFIX)
    ? file.slice(BROWSER_LOCAL_PREFIX.length)
    : null;
  const parts = (browserPath ?? file)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map(decodePathSegment);

  if (browserPath !== null) parts.shift();
  return parts.slice(-2).join("/") || `${title}${ext}`;
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
