import Link from "next/link";
import {
  Bookmark,
  CircleHelp,
  FileText,
  FolderClosed,
  FolderInput,
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
              <FolderInput className="home-triage-icon" aria-hidden />
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
        <Link href="/inbox" className="v-cardhead-link">
          Open inbox
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
