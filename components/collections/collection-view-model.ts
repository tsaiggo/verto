export interface CollectionItemOrigin {
  isExternal: boolean;
  label: string;
  path: string;
}

export function collectionItemOrigin(href: string): CollectionItemOrigin {
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const hostname = url.hostname.replace(/^www\./, "");
      const path = `${url.pathname}${url.search}${url.hash}`;
      return {
        isExternal: true,
        label: "Web article",
        path: path === "/" || path === "" ? hostname : `${hostname}${path}`,
      };
    }
  } catch {
    // Local reader paths are intentionally preserved below.
  }

  return { isExternal: false, label: "Library document", path: href };
}

export function formatCollectionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
