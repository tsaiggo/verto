"use client";

import Link from "next/link";
import { ArrowRight, FileText, MoreHorizontal, PlayCircle, Trash2 } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteReadingEntry,
  getReadingStatus,
  loadReadingState,
  type ReadingEntry,
  type ReadingStatus,
} from "@/lib/reading-state";

interface ContinueReadingProps {
  hrefs: string[];
}

function subscribeReadingState(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return JSON.stringify(loadReadingState());
}

function getServerSnapshot() {
  return JSON.stringify({ recent: [] });
}

function readStateFromSnapshot(snapshot: string) {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "recent" in parsed &&
      Array.isArray(parsed.recent)
    ) {
      return parsed.recent as ReadingEntry[];
    }
  } catch {
    return [];
  }
  return [];
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Recently";
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

function progressLabel(progress: number) {
  if (progress <= 0) return "Not started";
  if (progress >= 95) return "Done";
  return `${Math.round(progress)}%`;
}

function statusLabel(status: ReadingStatus) {
  if (status === "read") return "Read";
  if (status === "reading") return "Reading";
  return "Unread";
}

function StatusBadge({ entry }: { entry: ReadingEntry }) {
  const status = getReadingStatus(entry.progress);

  return (
    <span className={`home-reading-badge is-${status}`}>
      <span className="home-reading-dot" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

function removeEntry(entry: ReadingEntry) {
  deleteReadingEntry(entry.href);
  toast.success("Removed from Continue reading", {
    description: entry.title,
  });
}

function ReadingEntryMenu({ entry }: { entry: ReadingEntry }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="home-doc-more"
          aria-label={`Reading options for ${entry.title}`}
          title={`Reading options for ${entry.title}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => removeEntry(entry)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Remove from list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ContinueReading({ hrefs }: ContinueReadingProps) {
  const snapshot = useSyncExternalStore(subscribeReadingState, getSnapshot, getServerSnapshot);
  const recent = useMemo(() => {
    const available = new Set(hrefs);
    return readStateFromSnapshot(snapshot).filter((entry) => available.has(entry.href));
  }, [hrefs, snapshot]);
  const primary = recent[0];
  const remaining = recent.slice(1);

  return (
    <section
      id="continue-reading"
      className="home-panel home-continue"
      aria-labelledby="continue-reading-title"
    >
      <div className="home-panel-head">
        <div>
          <h2 className="home-panel-title" id="continue-reading-title">
            Continue reading
          </h2>
          <p className="home-panel-sub">
            Resume the documents you opened most recently on this device.
          </p>
        </div>
        <Link href="/read" className="home-viewall">
          Library
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {primary ? (
        <>
          <div className="home-continue-card">
            <Link href={primary.href} className="home-continue-main">
              <span className="home-continue-icon" aria-hidden>
                <PlayCircle className="h-5 w-5" />
              </span>
              <span className="home-continue-body">
                <span className="home-continue-title">{primary.title}</span>
                <span className="home-continue-meta">
                  <span>{primary.path || primary.slug.join("/")}</span>
                  <StatusBadge entry={primary} />
                  <span>{progressLabel(primary.progress)}</span>
                  <span>{formatRelativeTime(primary.lastReadAt)}</span>
                </span>
                <span className="home-continue-track" aria-hidden>
                  <span style={{ width: `${Math.max(0, Math.min(100, primary.progress))}%` }} />
                </span>
              </span>
              <ArrowRight className="home-continue-arrow" aria-hidden />
            </Link>
            <ReadingEntryMenu entry={primary} />
          </div>

          {remaining.length > 0 && (
            <div className="home-doc-table home-recently-read" role="table">
              <div className="home-doc-row is-head" role="row">
                <span role="columnheader">Recently read</span>
                <span role="columnheader">Progress</span>
                <span role="columnheader">Last read</span>
                <span aria-hidden />
              </div>
              {remaining.map((entry) => (
                <div className="home-doc-row" role="row" key={entry.href}>
                  <Link href={entry.href} className="home-doc-name" role="cell">
                    <FileText className="home-doc-icon" aria-hidden />
                    <span className="home-doc-name-text">
                      <span className="home-doc-title">{entry.title}</span>
                      <span className="home-doc-path">{entry.path || entry.slug.join("/")}</span>
                    </span>
                  </Link>
                  <span className="home-doc-source" role="cell">
                    <StatusBadge entry={entry} />
                  </span>
                  <time className="home-doc-time" role="cell" dateTime={entry.lastReadAt}>
                    {formatRelativeTime(entry.lastReadAt)}
                  </time>
                  <span className="home-doc-actions" role="cell">
                    <ReadingEntryMenu entry={entry} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="home-empty">Open any document from the library and it will appear here.</p>
      )}
    </section>
  );
}
