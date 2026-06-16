import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Cloud,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  GitBranch,
  Github,
  Globe,
  HardDrive,
  Lightbulb,
  Plug,
  Plus,
} from "lucide-react";
import ContinueReading from "@/components/home/ContinueReading";
import { listAllFiles, readFileNodeSource, type ContentFileNode } from "@/lib/content-source";
import { getSourceInfo, type SourceKind } from "@/lib/source-info";
import { getConnectionDetails } from "@/lib/connection-info";
import { estimateReadingTime, formatReadingTime } from "@/lib/reading-time";
import {
  buildConnectedSources,
  countConnected,
  type HomeConnectedSource,
  type HomeProviderKind,
} from "@/lib/home";
import { formatDate } from "@/lib/format";

const PROVIDER_ICON: Record<HomeProviderKind, typeof Github> = {
  github: Github,
  onedrive: Cloud,
  googledrive: HardDrive,
};

const PROVIDER_ICON_CLASS: Record<HomeProviderKind, string> = {
  github: "is-github",
  onedrive: "is-onedrive",
  googledrive: "is-googledrive",
};

const SOURCE_BADGE: Record<SourceKind, { label: string; icon: typeof Github }> = {
  github: { label: "GitHub", icon: Github },
  onedrive: { label: "OneDrive", icon: Cloud },
  docs: { label: "Showcase", icon: FileText },
  local: { label: "Local", icon: HardDrive },
};

const HOW_IT_WORKS = [
  {
    icon: Plug,
    title: "Connect source",
    text: "Add and connect your remote storage or repository.",
  },
  {
    icon: Folder,
    title: "Select folder",
    text: "Choose a repository or folder that contains MDX files.",
  },
  {
    icon: Eye,
    title: "Preview MDX",
    text: "Browse and read MDX content instantly in Verto.",
  },
] as const;

const QUICK_TIPS = [
  "You can connect multiple sources and switch between them anytime.",
  "Verto never stores your content. We read files remotely and securely.",
  "Only MDX files are shown in your library.",
] as const;

const ON_THIS_PAGE = [
  { label: "Connected sources", href: "#connected-sources" },
  { label: "Continue reading", href: "#continue-reading" },
  { label: "Recent documents", href: "#recent-documents" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Quick tips", href: "#quick-tips" },
] as const;

/** Display the most reliable "last modified" value a file can supply. */
function lastModified(file: ContentFileNode): string {
  const explicit = file.updated ?? file.date;
  if (explicit) return formatDate(explicit);
  if (file.mtime > 0) return formatDate(new Date(file.mtime).toISOString());
  return "—";
}

/** Source-relative path of a document, e.g. `docs/intro/getting-started.mdx`. */
function docPath(file: ContentFileNode): string {
  return `${file.slug.join("/")}${file.ext}`;
}

async function withReadingTime(file: ContentFileNode) {
  try {
    const source = await readFileNodeSource(file);
    return { file, readingMinutes: estimateReadingTime(source) };
  } catch {
    // Match the search index: one unreadable remote file should not break the
    // landing page. Empty content falls back to the minimum reading estimate.
    return { file, readingMinutes: estimateReadingTime("") };
  }
}

export default async function HomePage() {
  const files = await listAllFiles();
  const source = getSourceInfo();
  const connection = getConnectionDetails();
  const sources = buildConnectedSources(connection);
  const connectedCount = countConnected(sources);

  const recent = await Promise.all(
    [...files]
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5)
      .map(withReadingTime)
  );
  const badge = SOURCE_BADGE[source.kind];
  const BadgeIcon = badge.icon;

  return (
    <div className="home-page">
      <div className="home-main">
        <header className="home-head">
          <h1 className="home-title">Your library</h1>
          <p className="home-subtitle">
            Connect a source and read your MDX the way you wrote it — rendered, navigable, and
            always current.
          </p>
        </header>

        {/* Connected sources */}
        <section
          id="connected-sources"
          className="home-panel"
          aria-labelledby="connected-sources-title"
        >
          <div className="home-panel-head">
            <div>
              <h2 className="home-panel-title" id="connected-sources-title">
                Your connected sources
              </h2>
              <p className="home-panel-sub">
                Connect remote storage or a repository to read its MDX files.
              </p>
            </div>
            <Link href="/integrations" className="home-addsource">
              <Plus className="h-4 w-4" aria-hidden />
              Add source
            </Link>
          </div>

          <div className="home-sources">
            {sources.map((src) => (
              <SourceCard key={src.kind} source={src} />
            ))}
          </div>
        </section>

        <ContinueReading hrefs={files.map((file) => file.href)} />

        {/* Recent documents + How it works */}
        <div className="home-bottom">
          <section
            id="recent-documents"
            className="home-panel"
            aria-labelledby="recent-documents-title"
          >
            <div className="home-panel-head">
              <div>
                <h2 className="home-panel-title" id="recent-documents-title">
                  Recent documents
                </h2>
                <p className="home-panel-sub">
                  Recently opened or updated MDX files from your remote sources.
                </p>
              </div>
              <Link href="/read" className="home-viewall">
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {recent.length > 0 ? (
              <>
                <div className="home-doc-table" role="table">
                  <div className="home-doc-row is-head" role="row">
                    <span role="columnheader">Document</span>
                    <span role="columnheader">Source</span>
                    <span role="columnheader">Last modified</span>
                  </div>
                  {recent.map(({ file, readingMinutes }) => (
                    <div className="home-doc-row" role="row" key={file.slug.join("/")}>
                      <Link href={file.href} className="home-doc-name" role="cell">
                        <FileText className="home-doc-icon" aria-hidden />
                        <span className="home-doc-name-text">
                          <span className="home-doc-title">{file.title}</span>
                          <span className="home-doc-path">{docPath(file)}</span>
                          <span className="home-doc-readtime">
                            {formatReadingTime(readingMinutes)}
                          </span>
                        </span>
                      </Link>
                      <span className="home-doc-source" role="cell">
                        <BadgeIcon className="home-doc-source-icon" aria-hidden />
                        {badge.label}
                      </span>
                      <time
                        className="home-doc-time"
                        role="cell"
                        dateTime={file.mtime > 0 ? new Date(file.mtime).toISOString() : undefined}
                      >
                        {lastModified(file)}
                      </time>
                    </div>
                  ))}
                </div>
                <p className="home-doc-foot">
                  Showing {recent.length} of {files.length} recent document
                  {files.length === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <p className="home-empty">No documents yet. Connect a source to start reading MDX.</p>
            )}
          </section>

          <section
            id="how-it-works"
            className="home-panel home-how"
            aria-labelledby="how-it-works-title"
          >
            <h2 className="home-panel-title" id="how-it-works-title">
              How it works
            </h2>
            <p className="home-panel-sub">From a connected source to reading, in three steps.</p>

            <ol className="home-steps">
              {HOW_IT_WORKS.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <li className="home-step" key={step.title}>
                    <span className="home-step-icon" aria-hidden>
                      <StepIcon className="h-4 w-4" />
                    </span>
                    <span className="home-step-body">
                      <span className="home-step-title">
                        {i + 1}. {step.title}
                      </span>
                      <span className="home-step-text">{step.text}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <Link href="/integrations" className="home-how-link">
              Learn more about remote preview
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>

      {/* Right rail */}
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

        <section id="quick-tips" className="home-card">
          <h3 className="home-card-title">
            <Lightbulb className="home-card-icon" aria-hidden />
            Quick tips
          </h3>
          <ul className="home-tips">
            {QUICK_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="home-card">
          <h3 className="home-card-title">
            <Globe className="home-card-icon" aria-hidden />
            Remote preview
          </h3>
          <p className="home-card-text">
            Verto reads MDX files directly from your connected sources. No syncing, no downloads —
            always up to date.
          </p>
          <Link href="/integrations" className="home-card-link">
            Learn more
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>

        <Link href="/integrations" className="home-cta">
          <span className="home-cta-icon" aria-hidden>
            <Github className="h-4 w-4" />
          </span>
          <span className="home-cta-body">
            <span className="home-cta-title">
              {connectedCount > 0 ? "Manage sources" : "Connect GitHub"}
            </span>
            <span className="home-cta-text">
              {connectedCount > 0
                ? "Review and connect more repositories."
                : "Quickly connect a repository to get started."}
            </span>
          </span>
          <ArrowRight className="home-cta-arrow" aria-hidden />
        </Link>
      </aside>
    </div>
  );
}

function SourceCard({ source }: { source: HomeConnectedSource }) {
  const Icon = PROVIDER_ICON[source.kind];
  return (
    <div className={`home-source${source.connected ? " is-connected" : ""}`}>
      <div className="home-source-top">
        <span className={`home-source-icon ${PROVIDER_ICON_CLASS[source.kind]}`} aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <span className="home-source-name">{source.name}</span>
        {source.connected && (
          <span className="home-source-badge">
            <span className="home-dot" aria-hidden />
            Connected
          </span>
        )}
      </div>

      {source.connected ? (
        <>
          <div className="home-source-meta">
            <span className="home-source-primary">{source.primary}</span>
            {source.branch ? (
              <span className="home-source-line">
                <GitBranch className="home-source-line-icon" aria-hidden />
                {source.branch}
              </span>
            ) : source.path ? (
              <span className="home-source-line">
                <Folder className="home-source-line-icon" aria-hidden />
                {source.path}
              </span>
            ) : null}
            <span className="home-source-status">Connected</span>
          </div>
          {source.url ? (
            <a
              className="home-source-open"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <Link href="/read" className="home-source-open">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="home-source-blurb">{source.blurb}</p>
          {source.comingSoon ? (
            <span className="home-source-soon">Coming soon</span>
          ) : (
            <Link href="/integrations" className="home-source-connect">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Connect
            </Link>
          )}
        </>
      )}
    </div>
  );
}
