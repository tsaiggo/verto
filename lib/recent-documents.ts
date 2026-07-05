import type { ContentFileNode } from "@/lib/content-source";

function timestamp(file: ContentFileNode): number {
  const explicitDate = file.updated ?? file.date;
  const parsed = explicitDate ? Date.parse(explicitDate) : Number.NaN;
  return Number.isNaN(parsed) ? file.mtime : parsed;
}

export function sortRecentDocuments(files: ContentFileNode[], limit = 12): ContentFileNode[] {
  return files
    .filter((file) => !file.hidden && !file.draft)
    .toSorted((a, b) => timestamp(b) - timestamp(a))
    .slice(0, limit);
}
