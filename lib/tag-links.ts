export function tagHref(name: string, hasIndexedContent: boolean): string {
  return hasIndexedContent ? `/read/tags/${encodeURIComponent(name)}` : "/search";
}
