/**
 * Command palette filter — pure, no I/O, no mocks.
 *
 * Data source is the same flat list LabsSidebar uses:
 * `flattenToList(buildLabsTree(...))` + shortcuts list.
 * Empty query returns recents (first N when no query).
 * Hidden items are pruned. Matching is case-insensitive on label/href/keywords.
 */

export interface CommandItem {
  id: string;
  label: string;
  href: string;
  keywords?: string[];
  group?: string;
  hidden?: boolean;
  /** Optional recency rank; lower = more recent */
  recentRank?: number;
}

export interface FilterOptions {
  /** Max results when query empty (recents). Default 8 */
  recentLimit?: number;
  /** Max results when filtering. Default 20 */
  limit?: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function matches(item: CommandItem, q: string): boolean {
  const nq = normalize(q);
  if (nq.length === 0) return true;
  const hay = [item.label, item.href, ...(item.keywords ?? [])].join(" ").toLowerCase();
  return hay.includes(nq);
}

/**
 * Filter command items.
 * - hidden === true pruned
 * - case-insensitive substring match on label/href/keywords
 * - empty query returns recents sorted by recentRank then original order
 * - non-empty query returns matches in original order (stable)
 */
export function filterCommandItems(
  items: CommandItem[],
  query: string,
  opts: FilterOptions = {}
): CommandItem[] {
  const recentLimit = opts.recentLimit ?? 8;
  const limit = opts.limit ?? 20;

  const visible = items.filter((it) => !it.hidden);
  const q = normalize(query);

  if (q.length === 0) {
    // Recents: items with recentRank defined come first, sorted by rank
    const recents = [...visible].sort((a, b) => {
      const ar = a.recentRank ?? Number.POSITIVE_INFINITY;
      const br = b.recentRank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return 0; // keep original order stable (JS sort is stable)
    });
    return recents.slice(0, recentLimit);
  }

  const filtered = visible.filter((it) => matches(it, q));
  return filtered.slice(0, limit);
}

/** Convert a Labs flat list item to CommandItem */
export function labsItemToCommandItem(input: {
  slug: string[];
  href: string;
  title: string;
  hidden?: boolean;
}): CommandItem {
  return {
    id: input.slug.join("/") || input.href,
    label: input.title,
    href: input.href,
    keywords: input.slug,
    hidden: input.hidden,
  };
}

/** Default workspace shortcuts (mirrors VxRail PRIMARY_NAV + utility, no mocks) */
export const DEFAULT_SHORTCUTS: CommandItem[] = [
  { id: "home", label: "Home", href: "/", keywords: ["home", "dashboard"] },
  { id: "library", label: "Library", href: "/library", keywords: ["library", "read"] },
  { id: "mail", label: "Mail", href: "/mail", keywords: ["email", "inbox", "messages"] },
  { id: "search", label: "Search", href: "/search", keywords: ["search", "find"] },
  { id: "collections", label: "Collections", href: "/collections", keywords: ["collections"] },
  { id: "tags", label: "Tags", href: "/tags", keywords: ["tags"] },
  { id: "bookmarks", label: "Bookmarks", href: "/bookmarks", keywords: ["bookmarks", "pinned"] },
  { id: "agent", label: "Agent", href: "/agent", keywords: ["agent", "ai"] },
  { id: "studio", label: "Knowledge Studio", href: "/studio", keywords: ["studio", "knowledge"] },
  { id: "sources", label: "Sources", href: "/integrations", keywords: ["sources", "integrations"] },
  { id: "settings", label: "Settings", href: "/settings", keywords: ["settings"] },
  { id: "editor", label: "New document", href: "/editor", keywords: ["editor", "new", "document"] },
  { id: "inbox", label: "Inbox", href: "/inbox", keywords: ["inbox"] },
];
