import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cloud, HardDrive, type LucideIcon } from "lucide-react";
import type { SourceKind } from "@/lib/source-info";
import type { HomeConnectedSource } from "@/lib/home";
import type { LibraryGroup, RecentDoc } from "./home-data";

export type IconType = LucideIcon;

export const SOURCE_BADGE: Record<SourceKind, { label: string; icon: IconType }> = {
  onedrive: { label: "OneDrive", icon: Cloud },
  local: { label: "Local Library", icon: HardDrive },
};

const MAX_BROWSE_TILES = 6;

export function Masthead({
  documents,
  sections,
  updatedThisWeek,
}: {
  documents: number;
  sections: number;
  updatedThisWeek: number;
}) {
  const stats: Array<{ value: number; label: string }> = [];
  if (documents > 0) {
    stats.push({ value: documents, label: documents === 1 ? "document" : "documents" });
  }
  if (sections > 0) {
    stats.push({ value: sections, label: sections === 1 ? "section" : "sections" });
  }
  if (updatedThisWeek > 0) {
    stats.push({ value: updatedThisWeek, label: "updated this week" });
  }

  return (
    <header className="home-head">
      <p className="home-greet">Welcome back</p>
      <h1 className="home-h1">Your library</h1>
      {stats.length > 0 ? (
        <div className="home-meta">
          {stats.map((stat, index) => (
            <span key={stat.label} className="home-meta-item">
              {index > 0 ? <span className="home-mdot" aria-hidden /> : null}
              <span>
                <b>{stat.value}</b> {stat.label}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="home-meta home-meta-empty">
          Open a local library or add a feed to start reading.
        </p>
      )}
    </header>
  );
}

export function RecentlyUpdated({ docs }: { docs: RecentDoc[] }) {
  return (
    <section className="home-sec" aria-labelledby="recent-title">
      <div className="home-sec-head">
        <h2 className="home-sec-h" id="recent-title">
          Recently updated
        </h2>
        <Link href="/read" className="home-sec-link">
          View all
          <ArrowRight aria-hidden />
        </Link>
      </div>

      {docs.length > 0 ? (
        <div className="home-updates">
          {docs.map((doc) => (
            <Link key={doc.href} href={doc.href} className="home-upd">
              <span className="home-upd-main">
                <span className="home-upd-t">{doc.title}</span>
                <span className="home-upd-sec">{doc.section}</span>
              </span>
              <span className="home-upd-r">
                {doc.relative ? (
                  <time className="home-upd-time" dateTime={doc.iso ?? undefined}>
                    {doc.relative}
                  </time>
                ) : null}
                <ArrowUpRight className="home-upd-arrow" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="home-empty">
          No documents yet. Open a local library to start reading Markdown or MDX.
        </p>
      )}
    </section>
  );
}

export function BrowseSections({ groups }: { groups: LibraryGroup[] }) {
  if (groups.length === 0) return null;
  const tiles = groups.slice(0, MAX_BROWSE_TILES);

  return (
    <section className="home-sec" aria-labelledby="browse-title">
      <div className="home-sec-head">
        <h2 className="home-sec-h" id="browse-title">
          Browse by section
        </h2>
        {groups.length > tiles.length ? (
          <Link href="/read" className="home-sec-link">
            All sections
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="home-browse">
        {tiles.map((group) => {
          const samples = group.items.slice(0, 2);
          return (
            <Link key={group.href} href={group.href} className="home-tile">
              <span className="home-tile-head">
                <span className="home-tile-name">{group.title}</span>
                <span className="home-tile-cnt">{group.total}</span>
              </span>
              {samples.length > 0 ? (
                <span className="home-tile-samples">
                  {samples.map((item) => (
                    <span key={item.href}>{item.title}</span>
                  ))}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SourceStrip({
  sources,
  sourceLabel,
  SourceIcon,
}: {
  sources: HomeConnectedSource[];
  sourceLabel: string;
  SourceIcon: IconType;
}) {
  const active = sources.find((source) => source.connected);
  const detail = active
    ? active.branch
      ? `Branch ${active.branch}`
      : (active.path ?? "Live, nothing synced or stored")
    : "Live, nothing synced or stored";

  return (
    <div className="home-sources">
      <span className="home-src-icon" aria-hidden>
        <SourceIcon />
      </span>
      <div className="home-src-body">
        <p className="home-src-t">Reading from {active ? active.primary : sourceLabel}</p>
        <p className="home-src-d">{detail}</p>
      </div>
      <Link href="/integrations" className="home-src-link">
        Manage sources
        <ArrowRight aria-hidden />
      </Link>
    </div>
  );
}
