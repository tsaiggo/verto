"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { loadReadingState, type ReadingEntry } from "@/lib/reading-state";
import type { StarterDoc } from "@/components/home/home-data";

interface ContinueReadingCardProps {
  hrefs: string[];
  starters: StarterDoc[];
  /** Progress shown on the starter fallback so an empty vault mirrors the mockup. */
  sampleProgress?: number;
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

/**
 * Home "Continue Reading" card. Surfaces the most recent reading-state entry
 * with its progress; falls back to a starter document when nothing has been
 * opened yet.
 */
export default function ContinueReadingCard({
  hrefs,
  starters,
  sampleProgress,
}: ContinueReadingCardProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const primary = useMemo(() => {
    const available = new Set(hrefs);
    return parseRecent(snapshot).filter((e) => available.has(e.href))[0] ?? null;
  }, [hrefs, snapshot]);

  const starter = starters[0];
  const pct = primary ? Math.max(0, Math.min(100, Math.round(primary.progress))) : 0;

  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <BookOpen aria-hidden />
          Continue Reading
        </span>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-body">
        {primary ? (
          <Link href={primary.href} className="home-continue">
            <span className="home-continue-icon" aria-hidden>
              <BookOpen />
            </span>
            <span className="home-continue-body">
              <span className="home-continue-title">{primary.title}</span>
              <span className="home-continue-sub">{sectionOf(primary)}</span>
              <span className="home-continue-track" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
            </span>
            <span className="home-continue-pct">{pct}%</span>
          </Link>
        ) : starter ? (
          <Link href={starter.href} className="home-continue">
            <span className="home-continue-icon" aria-hidden>
              <BookOpen />
            </span>
            <span className="home-continue-body">
              <span className="home-continue-title">{starter.title}</span>
              <span className="home-continue-sub">{starter.section}</span>
              {typeof sampleProgress === "number" && (
                <span className="home-continue-track" aria-hidden>
                  <span style={{ width: `${sampleProgress}%` }} />
                </span>
              )}
            </span>
            {typeof sampleProgress === "number" ? (
              <span className="home-continue-pct">{sampleProgress}%</span>
            ) : (
              <ArrowRight className="home-continue-go" aria-hidden />
            )}
          </Link>
        ) : (
          <p className="home-muted">Open any document and it will appear here.</p>
        )}
      </div>
    </section>
  );
}
