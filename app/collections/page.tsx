import Link from "next/link";
import { Bookmark, Braces, LayoutGrid, Notebook, Plus, Rows3, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getContentTree } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import { buildLibraryIndex } from "@/components/home/home-data";
import { SAMPLE_COLLECTIONS, type SampleCollection } from "@/components/pages/sample";

export const metadata = { title: "Collections" };

const ICONS: Record<SampleCollection["icon"], LucideIcon> = {
  users: Users,
  sparkles: Sparkles,
  layout: LayoutGrid,
  notebook: Notebook,
  braces: Braces,
  bookmark: Bookmark,
};

const TINTS = ["#6366f1", "#16a34a", "#7c3aed", "#db2777", "#2563eb", "#9333ea"];
const ICON_CYCLE: SampleCollection["icon"][] = [
  "users",
  "sparkles",
  "layout",
  "notebook",
  "braces",
  "bookmark",
];

interface Collection {
  name: string;
  count: number;
  updated: string;
  tint: string;
  href: string;
  icon: SampleCollection["icon"];
}

export default async function CollectionsPage() {
  const tree = await getContentTree();
  const groups = buildLibraryIndex(tree);

  const collections: Collection[] =
    groups.length > 0
      ? groups.map((g, i) => ({
          name: g.title,
          count: g.total,
          updated: "In your workspace",
          tint: TINTS[i % TINTS.length],
          href: g.href,
          icon: ICON_CYCLE[i % ICON_CYCLE.length],
        }))
      : SAMPLE_COLLECTIONS.map((c) => ({ ...c, href: "/library" }));

  return (
    <div className="collections-page">
      <PageHeader
        title="Collections"
        subtitle="Organize your knowledge into collections."
        tools={
          <>
            <button type="button" className="v-btn v-btn--sm">
              <Plus aria-hidden /> New Collection
            </button>
            <div className="v-seg col-view" role="group" aria-label="View">
              <button type="button" className="v-seg-btn is-active" aria-label="Grid view">
                <LayoutGrid aria-hidden />
              </button>
              <button type="button" className="v-seg-btn" aria-label="List view">
                <Rows3 aria-hidden />
              </button>
            </div>
          </>
        }
      />

      <div className="v-page">
        <div className="col-grid">
          {collections.map((c, i) => {
            const Icon = ICONS[c.icon];
            return (
              <Link
                key={`${c.name}-${i}`}
                href={c.href}
                className="col-card"
                style={{ ["--tint" as string]: c.tint }}
              >
                <span className="col-card-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="col-card-name">{c.name}</span>
                <span className="col-card-meta">{c.count} documents</span>
                <span className="col-card-updated">{c.updated}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
