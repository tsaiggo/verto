import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bookmark,
  FileText,
  FolderClosed,
  Inbox as InboxIcon,
  PencilLine,
  Sparkles,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LibraryGroup, RecentDoc } from "@/components/home/home-data";

/* ---- Recent Edits ------------------------------------------------------- */

export function RecentEditsCard({ docs }: { docs: RecentDoc[] }) {
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <PencilLine aria-hidden />
          Recent Edits
        </span>
        <Link href="/library" className="v-cardhead-link">
          View all edits <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="v-card-divider" />
      <ul className="home-list">
        {docs.slice(0, 4).map((doc) => (
          <li key={doc.href}>
            <Link href={doc.href} className="home-list-row">
              <FileText className="home-list-icon" aria-hidden />
              <span className="home-list-title">{doc.title}</span>
              <span className="home-list-meta">{doc.relative || "recently"}</span>
            </Link>
          </li>
        ))}
        {docs.length === 0 && <li className="home-list-empty">No recent edits yet.</li>}
      </ul>
    </section>
  );
}

/* ---- Agent Highlights --------------------------------------------------- */

const AGENT_ACTIONS = [
  "Created a summary and extracted core principles",
  "Suggested related content from your library",
  "Linked related notes and updated references",
  "Drafted an outline from your latest edits",
];

export function AgentHighlightsCard({ docs }: { docs: RecentDoc[] }) {
  const items = docs.slice(0, 3);
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <Sparkles aria-hidden />
          Agent Highlights
        </span>
        <Link href="/agent" className="v-cardhead-link">
          View all <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="v-card-divider" />
      <ul className="home-agent">
        {items.map((doc, i) => (
          <li key={doc.href}>
            <Link href={doc.href} className="home-agent-row">
              <span className="home-agent-body">
                <span className="home-agent-title">{doc.title}</span>
                <span className="home-agent-action">{AGENT_ACTIONS[i % AGENT_ACTIONS.length]}</span>
              </span>
            </Link>
          </li>
        ))}
        {items.length === 0 && (
          <li className="home-list-empty">The agent has no highlights yet.</li>
        )}
      </ul>
    </section>
  );
}

/* ---- Knowledge Activity (heatmap) --------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Wed", "Fri", "Sun"];

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
  const rows = 7;
  const cols = 20;
  const now = new Date();
  const monthLabels = Array.from({ length: 5 }, (_, i) => MONTHS[(now.getMonth() - i + 12) % 12]);

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
        <div className="home-heat">
          <div className="home-heat-days" aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="home-heat-main">
            <div className="home-heat-months" aria-hidden>
              {monthLabels.map((m, i) => (
                <span key={`${m}-${i}`}>{m}</span>
              ))}
            </div>
            <div className="home-heat-grid" role="img" aria-label="Daily knowledge activity">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="home-heat-rowline">
                  {Array.from({ length: cols }).map((_, c) => (
                    <span key={c} className="home-heat-cell" data-level={intensity(r, c, seed)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <span>Daily activity in your local knowledge graph</span>
        <Link href="/activity" className="v-cardhead-link">
          View full activity <ArrowRight aria-hidden />
        </Link>
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
  const rows: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: FileText, value: stats.notesCreated, label: "Notes created" },
    { icon: PencilLine, value: stats.notesEdited, label: "Notes edited" },
    { icon: FolderClosed, value: stats.collectionsUpdated, label: "Collections updated" },
    { icon: Bookmark, value: stats.bookmarksAdded, label: "Bookmarks added" },
    { icon: Waypoints, value: stats.graphConnections, label: "Graph connections" },
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
              <span className="home-stat-value">{row.value}</span>
              <span className="home-stat-label">{row.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/activity" className="v-cardhead-link">
          View weekly stats <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---- Inbox / Triage ----------------------------------------------------- */

interface TriageItem {
  title: string;
  source: string;
  time: string;
  tone: "web" | "notes" | "local" | "slack" | "alert";
}

const TRIAGE: TriageItem[] = [
  { title: "New article: Building effective agents", source: "Web", time: "10m", tone: "web" },
  { title: "Research: txtai vs LanceDB benchmarks", source: "Notes", time: "1h", tone: "alert" },
  { title: "Product spec draft v0.3", source: "Local", time: "3h", tone: "local" },
  { title: "Meeting notes: AI roadmap sync", source: "Notes", time: "Yesterday", tone: "notes" },
  { title: "Design-inspiration collection", source: "Web", time: "Yesterday", tone: "web" },
  { title: "Question: How does RAG handle recency?", source: "Slack", time: "2d", tone: "slack" },
];

export function InboxTriageCard({ count }: { count: number }) {
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <InboxIcon aria-hidden />
          Inbox / Triage
        </span>
        <span className="home-count">{count}</span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-triage">
        {TRIAGE.map((item) => (
          <li key={item.title} className="home-triage-row">
            <span className={`home-triage-dot is-${item.tone}`} aria-hidden />
            <span className="home-triage-title">{item.title}</span>
            <span className="v-chip home-triage-src">{item.source}</span>
            <span className="home-triage-time">{item.time}</span>
          </li>
        ))}
      </ul>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/inbox" className="v-cardhead-link">
          Open inbox <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---- Recent Collections ------------------------------------------------- */

const COLLECTION_TINTS = ["#7c6cf0", "#3b82f6", "#16a34a", "#d97706", "#6b7280"];
const COLLECTION_ICONS: LucideIcon[] = [Sparkles, PencilLine, FileText, FolderClosed, Bookmark];

export function RecentCollectionsRow({ groups }: { groups: LibraryGroup[] }) {
  const items = groups.slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section className="home-collections">
      <div className="home-collections-head">
        <h2 className="home-collections-title">Recent Collections</h2>
        <Link href="/collections" className="v-cardhead-link">
          View all collections <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="home-collections-grid">
        {items.map((group, i) => {
          const Icon = COLLECTION_ICONS[i % COLLECTION_ICONS.length];
          const tint = COLLECTION_TINTS[i % COLLECTION_TINTS.length];
          return (
            <Link key={group.href} href={group.href} className="v-card home-collection">
              <span className="home-collection-icon" style={{ background: tint }} aria-hidden>
                <Icon />
              </span>
              <span className="home-collection-name">{group.title}</span>
              <span className="home-collection-meta">{group.total} notes</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
