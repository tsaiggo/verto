"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StarterDoc } from "@/components/home/home-data";
import { deleteReadingEntry, loadReadingState, type ReadingEntry } from "@/lib/reading-state";

interface ContinueReadingProps {
  hrefs: string[];
  starters?: StarterDoc[];
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 12;

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
  if (Number.isNaN(timestamp)) return "recently";
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return "yesterday";
  return `${Math.floor(diff / day)}d ago`;
}

function prettify(segment: string) {
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sectionOf(entry: ReadingEntry) {
  if (entry.slug.length > 1 && entry.slug[0]) return prettify(entry.slug[0]);
  return "Overview";
}

function clampPercent(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function removeEntry(entry: ReadingEntry) {
  deleteReadingEntry(entry.href);
  toast.success("Removed from Jump back in", {
    description: entry.title,
  });
}

function ProgressRing({ progress }: { progress: number }) {
  const pct = clampPercent(progress);
  const done = pct >= 95;
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);

  return (
    <span className="home-jump-ring" aria-hidden>
      <svg viewBox="0 0 30 30">
        <circle className="home-jump-rt" cx="15" cy="15" r="12" />
        <circle
          className="home-jump-rf"
          cx="15"
          cy="15"
          r="12"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={done ? 0 : offset}
        />
      </svg>
      <span className="home-jump-rn">
        {done ? <Check className="home-jump-check" aria-hidden /> : pct}
      </span>
    </span>
  );
}

function ReadingEntryMenu({ entry }: { entry: ReadingEntry }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="home-resume-more"
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

export default function ContinueReading({ hrefs, starters = [] }: ContinueReadingProps) {
  const snapshot = useSyncExternalStore(subscribeReadingState, getSnapshot, getServerSnapshot);
  const recent = useMemo(() => {
    const available = new Set(hrefs);
    return readStateFromSnapshot(snapshot).filter((entry) => available.has(entry.href));
  }, [hrefs, snapshot]);
  const primary = recent[0];
  const remaining = recent.slice(1, 4);

  return (
    <section className="home-sec" aria-labelledby="continue-title">
      <div className="home-sec-head">
        <h2 className="home-sec-h" id="continue-title">
          {primary ? "Jump back in" : "Start here"}
        </h2>
        <Link href="/read" className="home-sec-link">
          All documents
          <ArrowRight aria-hidden />
        </Link>
      </div>

      {primary ? (
        <div className={`home-jump${remaining.length > 0 ? "" : " is-solo"}`}>
          <article className="home-resume">
            <div className="home-resume-kicker">
              <span className="home-resume-ksec">{sectionOf(primary)}</span>
              <span className="home-resume-kdot" aria-hidden />
              <span>Opened {formatRelativeTime(primary.lastReadAt)}</span>
            </div>
            <Link href={primary.href} className="home-resume-title">
              {primary.title}
            </Link>
            <div className="home-resume-track" aria-hidden>
              <span style={{ width: `${clampPercent(primary.progress)}%` }} />
            </div>
            <div className="home-resume-foot">
              <Link href={primary.href} className="home-resume-btn">
                <Play className="h-4 w-4" aria-hidden />
                Resume reading
              </Link>
              <span className="home-resume-prog">
                <b>{clampPercent(primary.progress)}%</b>{" "}
                {clampPercent(primary.progress) >= 95 ? "finished" : "read"}
              </span>
            </div>
            <ReadingEntryMenu entry={primary} />
          </article>

          {remaining.length > 0 ? (
            <div className="home-jumplist">
              <p className="home-jump-cap">Recently read</p>
              {remaining.map((entry) => (
                <Link key={entry.href} href={entry.href} className="home-jump-item">
                  <ProgressRing progress={entry.progress} />
                  <span className="home-jump-body">
                    <span className="home-jump-t">{entry.title}</span>
                    <span className="home-jump-s">{sectionOf(entry)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : starters.length > 0 ? (
        <ul className="home-starters">
          {starters.map((doc) => (
            <li key={doc.href}>
              <Link href={doc.href} className="home-starter">
                <span className="home-starter-section">{doc.section}</span>
                <span className="home-starter-title">{doc.title}</span>
                <span className="home-starter-cta">
                  Read
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-empty">Open any document from the library and it will appear here.</p>
      )}
    </section>
  );
}
