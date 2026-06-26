import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Cloud,
  ExternalLink,
  Eye,
  Folder,
  Github,
  Globe,
  HardDrive,
  Plug,
} from "lucide-react";
import type {
  ContentDirNode,
  ContentFileNode,
  ContentNode,
} from "@/lib/content-source";
import type { SourceKind } from "@/lib/source-info";
import type { HomeConnectedSource, HomeProviderKind } from "@/lib/home";

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

const HOW_IT_WORKS = [
  { icon: Plug, title: "Connect a source", text: "Point Verto at a repository or remote folder." },
  { icon: Folder, title: "Choose your files", text: "Pick the folder that holds your MDX." },
  { icon: Eye, title: "Read it rendered", text: "Browse and read, always live from the source." },
] as const;

const ON_THIS_PAGE = [
  { label: "The library", href: "#library" },
  { label: "Continue reading", href: "#continue-reading" },
  { label: "Your source", href: "#your-source" },
  { label: "How it works", href: "#how-it-works" },
] as const;

const MAX_ITEMS_PER_GROUP = 8;

export interface LibraryGroup {
  title: string;
  href: string;
  total: number;
  items: ContentFileNode[];
}

function collectFiles(node: ContentNode): ContentFileNode[] {
  if (node.type === "file") {
    return node.hidden || node.draft ? [] : [node];
  }
  return node.children.flatMap(collectFiles);
}

export function buildLibraryIndex(tree: ContentDirNode): LibraryGroup[] {
  const groups: LibraryGroup[] = [];
  const loose: ContentFileNode[] = [];

  for (const child of tree.children) {
    if (child.hidden) continue;
    if (child.type === "file") {
      if (!child.draft) loose.push(child);
      continue;
    }
    const files = collectFiles(child);
    if (files.length === 0) continue;
    groups.push({
      title: child.title,
      href: child.href,
      total: files.length,
      items: files.slice(0, MAX_ITEMS_PER_GROUP),
    });
  }

  if (loose.length > 0) {
    groups.unshift({
      title: "Overview",
      href: "/read",
      total: loose.length,
      items: loose.slice(0, MAX_ITEMS_PER_GROUP),
    });
  }

  return groups;
}

export function newestUpdated(files: ContentFileNode[]): string {
  const newest = [...files].sort((a, b) => b.mtime - a.mtime)[0];
  if (!newest) return "Not yet";
  const iso =
    newest.updated ??
    newest.date ??
    (newest.mtime > 0 ? new Date(newest.mtime).toISOString() : null);
  if (!iso) return "Not yet";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Not yet";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
      <h1 className="home-title">Your library</h1>
      <p className="home-subtitle">
        Every document you connect, rendered the way you wrote it and always live
        from the source.
      </p>
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

export function LibraryIndex({ groups, total }: { groups: LibraryGroup[]; total: number }) {
  return (
    <section id="library" className="home-library" aria-labelledby="library-title">
      <div className="home-section-head">
        <div>
          <h2 className="home-section-title" id="library-title">
            The library
          </h2>
          <p className="home-section-sub">
            {total} document{total === 1 ? "" : "s"} across {groups.length} section
            {groups.length === 1 ? "" : "s"}, ready to read.
          </p>
        </div>
        <Link href="/read" className="home-viewall">
          Open library
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {groups.length > 0 ? (
        <div className="home-index">
          {groups.map((group, i) => (
            <section
              className="home-index-group"
              key={group.href}
              style={{ "--i": i } as CSSProperties}
            >
              <div className="home-index-group-head">
                <Link href={group.href} className="home-index-group-title">
                  {group.title}
                </Link>
                <span className="home-index-group-count">{group.total}</span>
              </div>
              <ul className="home-index-list">
                {group.items.map((file) => (
                  <li key={file.slug.join("/")}>
                    <Link href={file.href} className="home-index-item">
                      <span className="home-index-item-title">{file.title}</span>
                      <ArrowUpRight className="home-index-item-arrow" aria-hidden />
                    </Link>
                  </li>
                ))}
                {group.total > group.items.length ? (
                  <li>
                    <Link href={group.href} className="home-index-more">
                      View all {group.total}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </li>
                ) : null}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="home-empty">No documents yet. Connect a source to start reading MDX.</p>
      )}
    </section>
  );
}

export function SourcePanel({
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
  const detail = active
    ? active.branch
      ? `Branch ${active.branch}`
      : (active.path ?? "Connected and live.")
    : "Verto reads your MDX live. Nothing is synced or stored.";

  return (
    <section id="your-source" className="home-source-panel" aria-labelledby="your-source-title">
      <div className="home-section-head">
        <div>
          <h2 className="home-section-title" id="your-source-title">
            Your source
          </h2>
          <p className="home-section-sub">Where this library is read from.</p>
        </div>
      </div>

      <div className="home-source-active">
        <span className="home-source-active-icon" aria-hidden>
          <SourceIcon className="h-5 w-5" />
        </span>
        <div className="home-source-active-body">
          <span className="home-source-active-label">
            Reading from {active ? active.primary : sourceLabel}
          </span>
          <span className="home-source-active-detail">{detail}</span>
        </div>
        {active?.url ? (
          <a className="home-source-open" href={active.url} target="_blank" rel="noopener noreferrer">
            Open
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <Link href="/read" className="home-source-open">
            Open library
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
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
                {source.connected ? <Check className="home-source-chip-state" aria-hidden /> : null}
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
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="home-how" aria-labelledby="how-it-works-title">
      <div className="home-section-head">
        <div>
          <h2 className="home-section-title" id="how-it-works-title">
            How it works
          </h2>
          <p className="home-section-sub">From a connected source to your first read.</p>
        </div>
        <Link href="/integrations" className="home-viewall">
          Remote preview
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ol className="home-flow">
        {HOW_IT_WORKS.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <li className="home-flow-step" key={step.title} style={{ "--i": i } as CSSProperties}>
              <span className="home-flow-icon" aria-hidden>
                <StepIcon className="h-4 w-4" />
              </span>
              <span className="home-flow-title">{step.title}</span>
              <span className="home-flow-text">{step.text}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Aside({ connectedCount }: { connectedCount: number }) {
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
