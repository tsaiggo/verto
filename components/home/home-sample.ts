import type { LibraryGroup, RecentDoc, StarterDoc } from "@/components/home/home-data";
import type { WeekStats } from "@/components/home/HomeCards";
import { SAMPLE_DOCS } from "@/components/pages/sample";

/**
 * Home dashboard fallback data. Real reading state, edits, and collections are
 * always preferred; these representative values are surfaced only when the
 * vault is empty (e.g. a fresh checkout) so the dashboard matches the design
 * mockups instead of showing a screen full of empty states.
 */

export const SAMPLE_RECENT_DOCS: RecentDoc[] = SAMPLE_DOCS.slice(0, 6).map((doc) => ({
  href: "/library",
  title: `${doc.title}.md`,
  description: doc.excerpt,
  section: doc.source,
  iso: null,
  relative: doc.updated,
}));

export const SAMPLE_STARTERS: StarterDoc[] = [
  {
    href: "/library",
    title: `${SAMPLE_DOCS[0].title}.md`,
    section: "Section 3 · Core Principles",
  },
];

export const SAMPLE_CONTINUE_PROGRESS = 42;

export const SAMPLE_GROUPS: LibraryGroup[] = [
  { title: "AI & Agents", href: "/collections", total: 24, items: [] },
  { title: "Product Design", href: "/collections", total: 18, items: [] },
  { title: "Engineering Notes", href: "/collections", total: 31, items: [] },
  { title: "Research Library", href: "/collections", total: 42, items: [] },
  { title: "Personal Wiki", href: "/collections", total: 15, items: [] },
];

export const SAMPLE_WEEK_STATS: WeekStats = {
  notesCreated: 18,
  notesEdited: 9,
  collectionsUpdated: 3,
  bookmarksAdded: 7,
  graphConnections: 2,
};
