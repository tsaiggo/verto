"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { loadReadingState, selectRecentInScope, type ReadingEntry } from "@/lib/reading-state";
import type { RecentDoc, StarterDoc } from "@/components/home/home-data";
import HomeArticleCover from "@/components/home/HomeArticleCover";

interface ContinueReadingCardProps {
  hrefs: string[];
  starters: StarterDoc[];
  documents?: RecentDoc[];
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

interface ReadingSelection extends StarterDoc {
  progress: number | null;
}

export function selectHomeReading(
  entries: ReadingEntry[],
  hrefs: string[],
  starters: StarterDoc[],
  documents: RecentDoc[] = []
) {
  const recent = selectRecentInScope(entries, hrefs, 3);
  const metadata = new Map([...starters, ...documents].map((doc) => [doc.href, doc]));
  const reading: ReadingSelection[] = recent.map((entry) => ({
    ...metadata.get(entry.href),
    href: entry.href,
    title: metadata.get(entry.href)?.title ?? entry.title,
    section: metadata.get(entry.href)?.section ?? sectionOf(entry),
    progress: clampPct(entry.progress),
  }));
  const seen = new Set(reading.map((item) => item.href));
  const available = new Set(hrefs);
  for (const doc of [...starters, ...documents]) {
    if (reading.length >= 3) break;
    if (!available.has(doc.href) || seen.has(doc.href)) continue;
    seen.add(doc.href);
    reading.push({ ...doc, progress: null });
  }

  return {
    primary: reading[0],
    secondary: reading.slice(1, 3),
    hasRecentReading: recent.length > 0,
  };
}

export default function ContinueReadingCard({
  hrefs,
  starters,
  documents = [],
}: ContinueReadingCardProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { primary, secondary, hasRecentReading } = useMemo(
    () => selectHomeReading(parseRecent(snapshot), hrefs, starters, documents),
    [hrefs, snapshot, starters, documents]
  );
  const pct = primary?.progress ?? null;

  return (
    <section className="home-resume-card" aria-labelledby="home-resume-heading">
      <header className="home-section-head">
        <h2 id="home-resume-heading">{hasRecentReading ? "Continue Reading" : "Start Reading"}</h2>
        <Link href="/library" className="home-section-link">
          Browse library
          <ArrowRight aria-hidden />
        </Link>
      </header>
      <div className={`home-reading-grid${secondary.length ? " has-secondary" : ""}`}>
        {primary ? (
          <Link href={primary.href} className="home-continue home-resume-object">
            {primary.cover ? (
              <HomeArticleCover
                key={primary.cover}
                src={primary.cover}
                className="home-resume-cover"
              />
            ) : null}
            <span className="home-resume-copy">
              <strong className="home-continue-title">{primary.title}</strong>
              <span className="home-continue-sub">{primary.section}</span>
              {primary.description ? (
                <span className="home-resume-description">{primary.description}</span>
              ) : null}
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
                {hasRecentReading
                  ? pct === 100
                    ? "Read again"
                    : "Resume reading"
                  : "Open document"}
                <ArrowRight aria-hidden />
              </span>
            </span>
          </Link>
        ) : (
          <p className="home-muted">Open a document from your library to begin reading.</p>
        )}
        {secondary.length > 0 ? (
          <div className="home-resume-secondary" aria-label="More from your library">
            {secondary.map((item) => (
              <Link key={item.href} href={item.href} className="home-continue home-resume-row">
                <span className="home-resume-row-copy">
                  <strong>{item.title}</strong>
                  <small>{item.section}</small>
                  {item.description ? (
                    <span className="home-resume-row-description">{item.description}</span>
                  ) : null}
                </span>
                <span className="home-resume-row-end">
                  {item.progress === null ? "Open document" : `${item.progress}% read`}
                  <ArrowRight aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
