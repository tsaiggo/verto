"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { loadReadingState, selectRecentInScope, type ReadingEntry } from "@/lib/reading-state";
import type { StarterDoc } from "@/components/home/home-data";

interface ContinueReadingCardProps {
  /** Hrefs of every readable document, so recent entries for missing docs are dropped. */
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
    if (
      parsed &&
      typeof parsed === "object" &&
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

function prettify(segment: string) {
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionOf(entry: ReadingEntry) {
  if (entry.slug.length > 1 && entry.slug[0]) return prettify(entry.slug[0]);
  return "Overview";
}

function clampPct(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

/**
 * Home "Continue Reading" card. Surfaces the reader's real reading history
 * (most recent first, filtered to documents still present in the library) so
 * you can resume where you left off; falls back to starter documents when
 * nothing has been opened yet.
 */
export default function ContinueReadingCard({ hrefs, starters }: ContinueReadingCardProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recent = useMemo(
    () => selectRecentInScope(parseRecent(snapshot), hrefs, 3),
    [hrefs, snapshot]
  );

  return (
    <section className="v-card home-card home-card--continue">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <BookOpen aria-hidden />
          Continue reading
        </span>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-body">
        {recent.length > 0 ? (
          <div className="home-continue-list">
            {recent.map((entry) => {
              const pct = clampPct(entry.progress);
              return (
                <Link key={entry.href} href={entry.href} className="home-continue">
                  <span className="home-continue-icon" aria-hidden>
                    <BookOpen />
                  </span>
                  <span className="home-continue-body">
                    <span className="home-continue-title">{entry.title}</span>
                    <span className="home-continue-sub">
                      {sectionOf(entry)} · {pct}% read
                    </span>
                    <span className="home-continue-track" aria-hidden>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <span className="home-continue-pct">{pct > 0 ? "Resume" : "Open"}</span>
                  <ArrowRight className="home-continue-go" aria-hidden />
                </Link>
              );
            })}
          </div>
        ) : starters.length > 0 ? (
          <div className="home-continue-list">
            {starters.slice(0, 3).map((starter) => (
              <Link
                key={`${starter.href}-${starter.title}`}
                href={starter.href}
                className="home-continue"
              >
                <span className="home-continue-icon" aria-hidden>
                  <BookOpen />
                </span>
                <span className="home-continue-body">
                  <span className="home-continue-title">{starter.title}</span>
                  <span className="home-continue-sub">{starter.section}</span>
                </span>
                <span className="home-continue-pct">Open</span>
                <ArrowRight className="home-continue-go" aria-hidden />
              </Link>
            ))}
          </div>
        ) : (
          <p className="home-muted">Open any document and it will appear here.</p>
        )}
      </div>
    </section>
  );
}
