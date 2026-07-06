import Link from "next/link";
import { Plus } from "lucide-react";
import { getContentTree } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import { buildLibraryIndex } from "@/components/home/home-data";
import { SAMPLE_COLLECTIONS, type SampleCollection } from "@/components/pages/sample";

export const metadata = { title: "Collections" };

interface Collection {
  name: string;
  count: number;
  updated: string;
  href: string;
}

export default async function CollectionsPage() {
  const tree = await getContentTree();
  const groups = buildLibraryIndex(tree);

  const collections: Collection[] =
    groups.length > 0
      ? groups.map((g) => ({
          name: g.title,
          count: g.total,
          updated: "In your workspace",
          href: g.href,
        }))
      : SAMPLE_COLLECTIONS.map((c: SampleCollection) => ({
          name: c.name,
          count: c.count,
          updated: c.updated,
          href: "/library",
        }));

  return (
    <div className="collections-page">
      <PageHeader
        title="Collections"
        subtitle="Organize your knowledge into collections."
        tools={
          <button type="button" className="v-btn v-btn--sm">
            <Plus aria-hidden /> New Collection
          </button>
        }
      />

      <div className="v-page">
        <div className="col-grid">
          {collections.map((c, i) => (
            <Link key={`${c.name}-${i}`} href={c.href} className="v-card col-card">
              <span className="col-card-name">{c.name}</span>
              <span className="col-card-meta">{c.count} documents</span>
              <span className="col-card-updated">{c.updated}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
