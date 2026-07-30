const BROWSER_LOCAL_PREFIX = "browser-local:";

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
