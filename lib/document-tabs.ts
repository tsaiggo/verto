export interface DocumentTab {
  path: string;
  title: string;
}

/**
 * Resolve the current readable location into a persistent document tab.
 * Runtime-local documents are query-addressed, so their complete URL must be
 * kept; otherwise multiple local files would collapse into one `/runtime/local`
 * tab and switching tabs would lose the selected file.
 */
export function resolveDocumentTab(pathname: string, search = ""): DocumentTab | null {
  if (pathname === "/runtime/local") {
    const params = new URLSearchParams(search);
    const file = params.get("file")?.trim();
    if (!file) return null;

    const title = params.get("title")?.trim() || titleFromPath(file);
    const query = params.toString();
    return {
      path: query ? `${pathname}?${query}` : pathname,
      title,
    };
  }

  if (pathname === "/read") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const head = segments[0];
  const second = segments[1];
  const isHelpDoc = head === "help";
  const isReadDoc = head === "read" && second !== "tags" && second !== "status";
  if (!isHelpDoc && !isReadDoc) return null;

  const last = decodeSegment(segments.at(-1) ?? "");
  return { path: pathname, title: prettifyTitle(last) };
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function prettifyTitle(segment: string): string {
  const spaced = segment.replace(/[-_]+/g, " ").trim();
  if (!spaced) return segment;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function titleFromPath(file: string): string {
  const name = file.split(/[\\/]/).filter(Boolean).at(-1) ?? "Runtime file";
  return prettifyTitle(name.replace(/\.(mdx?|markdown)$/i, "") || name);
}
