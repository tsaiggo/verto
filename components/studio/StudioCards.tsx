"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { loadAnnotations, type Annotation } from "@/lib/annotations";
import { loadSummaries, type SavedSummary } from "@/lib/summaries";
import { buildStudioCards } from "@/lib/studio-cards";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return JSON.stringify({
    summaries: loadSummaries().summaries,
    annotations: loadAnnotations().annotations,
  });
}

function getServerSnapshot() {
  return JSON.stringify({ summaries: [], annotations: [] });
}

interface StudioSnapshot {
  summaries: SavedSummary[];
  annotations: Annotation[];
}

/**
 * Knowledge Studio card grid, built from the reader's real saved artifacts
 * (AI summaries + notes). Client-side because both stores live in localStorage;
 * re-renders on same-tab or cross-tab changes via the storage event.
 */
export default function StudioCards() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const cards = useMemo(() => {
    const { summaries, annotations } = JSON.parse(snapshot) as StudioSnapshot;
    return buildStudioCards(summaries, annotations);
  }, [snapshot]);

  if (cards.length === 0) {
    return (
      <div className="v-empty">
        <span className="v-empty-icon" aria-hidden>
          <Sparkles />
        </span>
        <strong className="v-empty-title">No knowledge cards yet</strong>
        <p className="v-empty-text">
          Save an AI summary or write a note while reading and it will appear here as a reusable
          card.
        </p>
      </div>
    );
  }

  return (
    <div className="studio-grid">
      {cards.map((card) => (
        <Link key={card.key} href={card.href} className="v-card studio-tile">
          <span className="studio-tile-kind">{card.kind}</span>
          <span className="studio-tile-title">{card.title}</span>
          <span className="studio-tile-desc">{card.desc}</span>
        </Link>
      ))}
    </div>
  );
}
