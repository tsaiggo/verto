import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bookmark,
  CircleHelp,
  FileText,
  FolderClosed,
  Inbox as InboxIcon,
  PencilLine,
  Plus,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LibraryGroup, RecentDoc } from "@/components/home/home-data";

/* ---- Recent Edits ------------------------------------------------------- */

export function RecentEditsCard({ docs }: { docs: RecentDoc[] }) {
  const more = 5;
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <PencilLine aria-hidden />
          Recent Edits
        </span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-list">
        {docs.slice(0, 3).map((doc) => (
          <li key={`${doc.href}-${doc.title}`}>
            <Link href={doc.href} className="home-list-row">
              <FileText className="home-list-icon" aria-hidden />
              <span className="home-list-body">
                <span className="home-list-title">{doc.title}</span>
                <span className="home-list-meta">
                  {doc.relative.startsWith("Edited")
                    ? doc.relative
                    : `Edited ${doc.relative || "recently"}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {docs.length === 0 && <li className="home-list-empty">No recent edits yet.</li>}
      </ul>
      {more > 0 && <div className="home-more">+ {more} more</div>}
    </section>
  );
}

/* ---- Agent Highlights --------------------------------------------------- */

const AGENT_HIGHLIGHTS = [
  { title: "Agent summarised 4 documents", meta: "2 hours ago" },
  { title: "Created 2 new knowledge cards", meta: "Yesterday" },
  { title: "Connected 6 related ideas", meta: "Yesterday" },
];

export function AgentHighlightsCard() {
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <Sparkles aria-hidden />
          Agent Highlights
        </span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-agent">
        {AGENT_HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <Link href="/agent" className="home-agent-row">
              <Sparkles className="home-agent-icon" aria-hidden />
              <span className="home-agent-body">
                <span className="home-agent-title">{item.title}</span>
                <span className="home-agent-action">{item.meta}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="home-more">+ 5 more</div>
    </section>
  );
}

/* ---- Knowledge Activity (heatmap) --------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Deterministic 0–4 intensity so the grid is stable across renders/SSR. */
function intensity(row: number, col: number, seed: number): number {
  const h = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + seed) * 43758.5453;
  const f = h - Math.floor(h);
  if (f < 0.45) return 0;
  if (f < 0.68) return 1;
  if (f < 0.84) return 2;
  if (f < 0.94) return 3;
  return 4;
}

export function KnowledgeActivityCard({ seed = 7 }: { seed?: number }) {
  const columns = 36;
  const rows = 3;
  const monthLabels = MONTHS;
  const weekdayLabels = ["Mon", "Wed", "Fri"];

  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <Activity aria-hidden />
          Knowledge Activity
        </span>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-body">
        <p className="home-card-subtitle">Your knowledge rhythm</p>
        <div className="home-heat">
          <div className="home-heat-main">
            <div className="home-heat-months" aria-hidden>
              {monthLabels.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="home-heat-days" aria-hidden>
              {weekdayLabels.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="home-heat-grid" role="img" aria-label="Daily knowledge activity">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="home-heat-rowline">
                  {Array.from({ length: columns }).map((_, c) => (
                    <span key={c} className="home-heat-cell" data-level={intensity(r, c, seed)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="home-heat-legend" aria-hidden>
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="home-heat-cell" data-level={level} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}

/* ---- This Week ---------------------------------------------------------- */

export interface WeekStats {
  notesCreated: number;
  notesEdited: number;
  collectionsUpdated: number;
  bookmarksAdded: number;
  graphConnections: number;
}

export function ThisWeekCard({ stats }: { stats: WeekStats }) {
  const rows: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: Activity, value: "3h 42m", label: "Reading time" },
    { icon: PencilLine, value: String(stats.notesEdited || 4), label: "Documents edited" },
    { icon: FileText, value: String(stats.notesCreated || 12), label: "Notes captured" },
    { icon: Sparkles, value: String(stats.graphConnections || 2), label: "Knowledge cards" },
  ];
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <Activity aria-hidden />
          This Week
        </span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-stats">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="home-stat">
              <Icon className="home-stat-icon" aria-hidden />
              <span className="home-stat-body">
                <span className="home-stat-value">{row.value}</span>
                <span className="home-stat-label">{row.label}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/activity" className="v-cardhead-link">
          View full activity <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---- Inbox / Triage ----------------------------------------------------- */

interface TriageItem {
  title: string;
  tone: "web" | "notes" | "local" | "slack";
}

const TRIAGE: TriageItem[] = [
  { title: "5 highlights without notes", tone: "web" },
  { title: "3 documents need summary", tone: "notes" },
  { title: "2 unresolved agent questions", tone: "slack" },
  { title: "1 source needs attention", tone: "local" },
];

export function InboxTriageCard() {
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <InboxIcon aria-hidden />
          Inbox
        </span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-triage">
        {TRIAGE.map((item) => (
          <li key={item.title} className="home-triage-row">
            {item.tone === "slack" ? (
              <CircleHelp className="home-triage-icon" aria-hidden />
            ) : item.tone === "local" ? (
              <Activity className="home-triage-icon" aria-hidden />
            ) : item.tone === "notes" ? (
              <FileText className="home-triage-icon" aria-hidden />
            ) : (
              <Bookmark className="home-triage-icon" aria-hidden />
            )}
            <span className="home-triage-title">{item.title}</span>
          </li>
        ))}
      </ul>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/activity" className="v-cardhead-link">
          View full activity <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---- Recent Collections ------------------------------------------------- */

const COLLECTION_ICONS: LucideIcon[] = [Sparkles, PencilLine, FileText, FolderClosed, Bookmark];

export function RecentCollectionsRow({ groups }: { groups: LibraryGroup[] }) {
  const items = groups.slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="v-card home-collections">
      <div className="v-cardhead home-collections-head">
        <span className="v-cardhead-title">
          <FolderClosed aria-hidden />
          Recent Collections
        </span>
        <Link href="/collections" className="v-btn v-btn--sm home-collections-new">
          <Plus aria-hidden /> New Collection
        </Link>
      </div>
      <div className="v-card-divider" />
      <div className="home-collections-grid">
        {items.map((group, i) => {
          const Icon = COLLECTION_ICONS[i % COLLECTION_ICONS.length];
          return (
            <Link
              key={`${group.href}-${group.title}`}
              href={group.href}
              className="v-card home-collection"
            >
              <span className="home-collection-icon" aria-hidden>
                <Icon />
              </span>
              <span className="home-collection-body">
                <span className="home-collection-name">{group.title}</span>
                <span className="home-collection-meta">{group.total} docs</span>
                <span className="home-collection-updated">
                  Updated {i < 2 ? "2h ago" : i === 2 ? "Yesterday" : "3d ago"}
                </span>
              </span>
              <MoreHorizontal className="home-collection-more" aria-hidden />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
