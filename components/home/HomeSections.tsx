import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Cloud,
  ExternalLink,
  Github,
  Globe,
  HardDrive,
} from "lucide-react";
import type { SourceKind } from "@/lib/source-info";
import type { HomeConnectedSource, HomeProviderKind } from "@/lib/home";
import type { LibraryGroup, RecentDoc } from "./home-data";

export type IconType = typeof Github;

export const SOURCE_BADGE: Record<SourceKind, { label: string; icon: IconType }> = {
  github: { label: "GitHub", icon: Github },
  onedrive: { label: "OneDrive", icon: Cloud },
  local: { label: "Local", icon: HardDrive },
};

const PROVIDER_ICON: Record<HomeProviderKind, IconType> = {
  github: Github,
  onedrive: Cloud,
  googledrive: HardDrive,
};

const ON_THIS_PAGE = [
  { label: "Continue reading", href: "#continue-reading" },
  { label: "Recently updated", href: "#recent" },
  { label: "Sources", href: "#sources" },
] as const;

const MAX_ASIDE_SECTIONS = 6;

export function Masthead({
  documents,
  sections,
  sourceLabel,
  SourceIcon,
  lastUpdated,
}: {
  documents: number;
  sections: number;
  sourceLabel: string;
  SourceIcon: IconType;
  lastUpdated: string;
}) {
  return (
    <header className="home-masthead">
      <h1 className="home-title">Your reading room</h1>
      <p className="home-subtitle">
        Every document you connect, rendered the way you wrote it and read live
        from the source.
      </p>
      <div className="home-masthead-actions">
        <Link href="/read" className="home-action-primary">
          Browse the library
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/search" className="home-action-quiet">
          Search documents
        </Link>
      </div>
      <dl className="home-dateline" aria-label="Library at a glance">
        <div className="home-dateline-unit">
          <dt className="home-dateline-label">Documents</dt>
          <dd className="home-dateline-value">{documents}</dd>
        </div>
        <div className="home-dateline-unit">
          <dt className="home-dateline-label">Sections</dt>
          <dd className="home-dateline-value">{sections}</dd>
        </div>
        <div className="home-dateline-unit">
          <dt className="home-dateline-label">Source</dt>
          <dd className="home-dateline-value home-dateline-value-text">
            <SourceIcon className="home-dateline-icon" aria-hidden />
            {sourceLabel}
          </dd>
        </div>
        <div className="home-dateline-unit">
          <dt className="home-dateline-label">Updated</dt>
          <dd className="home-dateline-value home-dateline-value-text">{lastUpdated}</dd>
        </div>
      </dl>
    </header>
  );
}

export function RecentlyUpdated({ docs }: { docs: RecentDoc[] }) {
  const [lead, ...rest] = docs;

  return (
    <section id="recent" className="home-recent" aria-labelledby="recent-title">
      <div className="home-section-head">
        <div>
          <h2 className="home-section-title" id="recent-title">
            Recently updated
          </h2>
          <p className="home-section-sub">The latest changes across your library.</p>
        </div>
        <Link href="/read" className="home-viewall">
          All documents
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {lead ? (
        <div className="home-recent-grid">
          <Link href={lead.href} className="home-recent-lead">
            <span className="home-recent-kicker">
              <span className="home-recent-section">{lead.section}</span>
              {lead.relative ? (
                <span className="home-recent-time">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {lead.relative}
                </span>
              ) : null}
            </span>
            <span className="home-recent-lead-title">{lead.title}</span>
            {lead.description ? (
              <span className="home-recent-lead-desc">{lead.description}</span>
            ) : null}
            <span className="home-recent-lead-cta">
              Read this
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>

          {rest.length > 0 ? (
            <ul className="home-recent-list">
              {rest.map((doc, i) => (
                <li key={doc.href} style={{ "--i": i } as CSSProperties}>
                  <Link href={doc.href} className="home-recent-item">
                    <span className="home-recent-item-main">
                      <span className="home-recent-item-title">{doc.title}</span>
                      <span className="home-recent-item-section">{doc.section}</span>
                    </span>
                    {doc.relative ? (
                      <time className="home-recent-item-time" dateTime={doc.iso ?? undefined}>
                        {doc.relative}
                      </time>
                    ) : null}
                    <ArrowUpRight className="home-recent-item-arrow" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="home-empty">No documents yet. Connect a source to start reading MDX.</p>
      )}
    </section>
  );
}

export function SourceStrip({
  sources,
  connectedCount,
  sourceLabel,
  SourceIcon,
}: {
  sources: HomeConnectedSource[];
  connectedCount: number;
  sourceLabel: string;
  SourceIcon: IconType;
}) {
  const active = sources.find((source) => source.connected);
  const detailIsToken = Boolean(active && (active.branch || active.path));
  const detail = active
    ? active.branch
      ? `Branch ${active.branch}`
      : (active.path ?? "Connected and live.")
    : "Read live from your source. Nothing is synced or stored.";

  return (
    <section id="sources" className="home-sources" aria-labelledby="sources-title">
      <h2 className="home-sources-title" id="sources-title">
        Sources
      </h2>
      <div className="home-sources-body">
        <div className="home-source-active">
          <span className="home-source-active-icon" aria-hidden>
            <SourceIcon className="h-5 w-5" />
          </span>
          <div className="home-source-active-body">
            <span className="home-source-active-label">
              Reading from {active ? active.primary : sourceLabel}
            </span>
            <span className={`home-source-active-detail${detailIsToken ? " is-token" : ""}`}>
              {detail}
            </span>
          </div>
          {active?.url ? (
            <a
              className="home-source-open"
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <Link href="/read" className="home-source-open">
              Open library
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>

        <div className="home-source-more">
          <span className="home-source-more-label">
            {connectedCount > 0 ? "Connect another source" : "Connect a remote source"}
          </span>
          <ul className="home-source-chips">
            {sources.map((source) => {
              const Icon = PROVIDER_ICON[source.kind];
              const inner = (
                <>
                  <Icon className="home-source-chip-icon" aria-hidden />
                  {source.name}
                  {source.connected ? (
                    <Check className="home-source-chip-state" aria-hidden />
                  ) : null}
                </>
              );

              if (source.comingSoon) {
                return (
                  <li key={source.kind}>
                    <span className="home-source-chip is-soon">
                      {inner}
                      <span className="home-source-chip-soon">Soon</span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={source.kind}>
                  <Link
                    href="/integrations"
                    className={`home-source-chip${source.connected ? " is-connected" : ""}`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Aside({
  connectedCount,
  groups,
  totalSections,
}: {
  connectedCount: number;
  groups: LibraryGroup[];
  totalSections: number;
}) {
  const visible = groups.slice(0, MAX_ASIDE_SECTIONS);

  return (
    <aside className="home-aside" aria-label="Page overview">
      <nav className="home-onthispage" aria-label="On this page">
        <span className="home-onthispage-title">On this page</span>
        <ul>
          {ON_THIS_PAGE.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {visible.length > 0 ? (
        <nav className="home-browse" aria-label="Browse by section">
          <span className="home-browse-title">Browse by section</span>
          <ul>
            {visible.map((group) => (
              <li key={group.href}>
                <Link href={group.href} className="home-browse-link">
                  <span className="home-browse-name">{group.title}</span>
                  <span className="home-browse-count">{group.total}</span>
                </Link>
              </li>
            ))}
          </ul>
          {totalSections > visible.length ? (
            <Link href="/read" className="home-browse-all">
              All {totalSections} sections
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </nav>
      ) : null}

      <section className="home-note">
        <h3 className="home-note-title">
          <Globe className="home-note-icon" aria-hidden />
          Always live
        </h3>
        <p className="home-note-text">
          Verto reads MDX straight from your source. No syncing, no downloads, no
          stored copies. What you see is the current file.
        </p>
        <Link href="/integrations" className="home-note-link">
          How remote preview works
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </section>

      <Link href="/integrations" className="home-cta">
        <span className="home-cta-icon" aria-hidden>
          <Github className="h-4 w-4" />
        </span>
        <span className="home-cta-body">
          <span className="home-cta-title">
            {connectedCount > 0 ? "Manage sources" : "Connect a repository"}
          </span>
          <span className="home-cta-text">
            {connectedCount > 0 ? "Review and add more sources." : "Read your own MDX in minutes."}
          </span>
        </span>
        <ArrowRight className="home-cta-arrow" aria-hidden />
      </Link>
    </aside>
  );
}
