"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { loadReadingState, selectRecentInScope, type ReadingEntry } from "@/lib/reading-state";
import type { StarterDoc } from "@/components/home/home-data";

interface ContinueReadingCardProps {
  hrefs: string[];
  starters: StarterDoc[];
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function getSnapshot() {
  return JSON.stringify(loadReadingState());
}
function getServerSnapshot() {
  return JSON.stringify({ recent: [] });
}
function parseRecent(snapshot: string): ReadingEntry[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (parsed && typeof parsed === "object" && "recent" in parsed && Array.isArray(parsed.recent))
      return parsed.recent as ReadingEntry[];
  } catch {
    return [];
  }
  return [];
}
function sectionOf(entry: ReadingEntry) {
  return entry.slug.length > 1 && entry.slug[0]
    ? entry.slug[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Overview";
}
function clampPct(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export default function ContinueReadingCard({ hrefs, starters }: ContinueReadingCardProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recent = useMemo(
    () => selectRecentInScope(parseRecent(snapshot), hrefs, 3),
    [hrefs, snapshot]
  );
  const entry = recent[0];
  const starter = starters[0];
  const primary = entry ?? starter;
  const pct = entry ? clampPct(entry.progress) : null;
  const secondary = entry
    ? recent.slice(1).map((item) => ({
        href: item.href,
        title: item.title,
        section: sectionOf(item),
        progress: clampPct(item.progress),
      }))
    : starters.slice(1, 3).map((item) => ({ ...item, progress: null }));

  return (
    <section className="home-resume-card" aria-labelledby="home-resume-heading">
      <header className="home-section-head">
        <h2 id="home-resume-heading">{entry ? "Continue Reading" : "Start Reading"}</h2>
        <Link href="/library" className="home-section-link">
          Browse library
          <ArrowRight aria-hidden />
        </Link>
      </header>
      {primary ? (
        <Link href={primary.href} className="home-continue home-resume-object">
          <span className="home-resume-icon" aria-hidden>
            <BookOpen />
          </span>
          <span className="home-resume-copy">
            <strong className="home-continue-title">{primary.title}</strong>
            <span className="home-continue-sub">{entry ? sectionOf(entry) : starter?.section}</span>
          </span>
          <span className="home-resume-footer">
            {pct !== null ? (
              <span className="home-resume-progress">
                <span className="home-continue-track" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="home-continue-pct">{pct}% read</span>
              </span>
            ) : (
              <span className="home-resume-ready">From your active library</span>
            )}
            <span className="home-resume-action">
              {entry ? (pct === 100 ? "Read again" : "Resume reading") : "Open document"}
              <ArrowRight aria-hidden />
            </span>
          </span>
        </Link>
      ) : (
        <p className="home-muted">Open a document from your library to begin reading.</p>
      )}
      {secondary.length > 0 ? (
        <div
          className="home-resume-secondary"
          aria-label={entry ? "Other recent reading" : "More documents to explore"}
        >
          {secondary.map((item) => (
            <Link key={item.href} href={item.href} className="home-continue home-resume-row">
              <FileText aria-hidden />
              <span>
                <strong>{item.title}</strong>
                <small>{item.section}</small>
              </span>
              <span className="home-resume-row-end">
                {item.progress === null ? "Open" : `${item.progress}%`}
                <ArrowRight aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
