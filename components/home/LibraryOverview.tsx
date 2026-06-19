import Link from "next/link";
import { ArrowRight, FileText, Hash, ListChecks, Tags } from "lucide-react";
import type { HomeLibraryCollection, HomeLibraryOverview } from "@/lib/home";

export default function LibraryOverview({ overview }: { overview: HomeLibraryOverview }) {
  return (
    <section id="library-overview" className="home-panel" aria-labelledby="library-overview-title">
      <div className="home-panel-head">
        <div>
          <h2 className="home-panel-title" id="library-overview-title">
            Library overview
          </h2>
          <p className="home-panel-sub">
            Turn frontmatter into lightweight collections for a Notion-like personal workspace.
          </p>
        </div>
        <Link href="/search" className="home-viewall">
          Search library
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="home-overview-grid">
        <OverviewStat
          icon={FileText}
          label="Documents"
          value={overview.totalDocuments}
          detail="Readable MD/MDX files"
        />
        <OverviewStat
          icon={Tags}
          label="Tags"
          value={overview.tagCount}
          detail={`${overview.taggedDocuments} tagged document${overview.taggedDocuments === 1 ? "" : "s"}`}
        />
        <OverviewStat
          icon={ListChecks}
          label="Statuses"
          value={overview.statusCount}
          detail="Optional workflow labels"
        />
      </div>

      {overview.collections.length > 0 ? (
        <div className="home-collections" aria-label="Popular collections">
          {overview.collections.map((collection) => (
            <CollectionPill
              key={`${collection.kind}:${collection.label}`}
              collection={collection}
            />
          ))}
        </div>
      ) : (
        <p className="home-empty">
          Add <code>tags</code> or <code>status</code> to frontmatter to build personal collections.
        </p>
      )}
    </section>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="home-overview-stat">
      <span className="home-overview-icon" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="home-overview-value">{value}</span>
      <span className="home-overview-label">{label}</span>
      <span className="home-overview-detail">{detail}</span>
    </div>
  );
}

function CollectionPill({ collection }: { collection: HomeLibraryCollection }) {
  const content = (
    <>
      {collection.kind === "tag" ? (
        <Hash className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ListChecks className="h-3.5 w-3.5" aria-hidden />
      )}
      <span>{collection.label}</span>
      <span className="home-collection-count">{collection.count}</span>
    </>
  );

  if (collection.href) {
    return (
      <Link href={collection.href} className="home-collection-pill">
        {content}
      </Link>
    );
  }

  return <span className="home-collection-pill is-static">{content}</span>;
}
