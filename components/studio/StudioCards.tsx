"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ContentTabs from "@/components/layout/ContentTabs";
import { Button } from "@/components/ui/button";
import { ContentEmptyState, ContentToolbar } from "@/components/ui/content-primitives";
import { loadAnnotations, type Annotation } from "@/lib/annotations";
import { loadSummaries, type SavedSummary } from "@/lib/summaries";
import { getStateStore } from "@/lib/state-store";
import {
  buildStudioCards,
  filterStudioCards,
  studioCardCopyText,
  type StudioCard,
  type StudioCardFilter,
} from "@/lib/studio-cards";
import StudioCardDialog from "./StudioCardDialog";
import StudioCardTile from "./StudioCardTile";
import styles from "./StudioCards.module.css";

const EMPTY_SNAPSHOT = JSON.stringify({ summaries: [], annotations: [] });

function subscribe(callback: () => void) {
  return getStateStore().subscribe(callback);
}

function getSnapshot() {
  return JSON.stringify({
    summaries: loadSummaries().summaries,
    annotations: loadAnnotations().annotations,
  });
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

interface StudioSnapshot {
  summaries: SavedSummary[];
  annotations: Annotation[];
}

function parseSnapshot(snapshot: string): StudioSnapshot {
  try {
    return JSON.parse(snapshot) as StudioSnapshot;
  } catch {
    return { summaries: [], annotations: [] };
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable");
}

function StudioFilterBar({
  cards,
  filteredCount,
  filter,
  query,
  onFilterChange,
  onQueryChange,
}: {
  cards: StudioCard[];
  filteredCount: number;
  filter: StudioCardFilter;
  query: string;
  onFilterChange: (value: StudioCardFilter) => void;
  onQueryChange: (value: string) => void;
}) {
  const summaryCount = cards.filter((card) => card.kind === "Summary").length;
  const tabs = [
    { id: "all" as const, label: "All", count: cards.length, panelId: "studio-panel" },
    {
      id: "summary" as const,
      label: "Summaries",
      count: summaryCount,
      panelId: "studio-panel",
    },
    {
      id: "note" as const,
      label: "Notes",
      count: cards.length - summaryCount,
      panelId: "studio-panel",
    },
  ];

  return (
    <>
      <ContentTabs
        className={styles.tabs}
        items={tabs}
        value={filter}
        onValueChange={onFilterChange}
        label="Knowledge card types"
      />
      <ContentToolbar className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} aria-hidden />
          <label className="sr-only" htmlFor="studio-search">
            Search knowledge cards
          </label>
          <input
            id="studio-search"
            type="search"
            className={styles.search}
            placeholder="Search summaries and notes"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <span className={styles.resultCount} aria-live="polite">
          {filteredCount} {filteredCount === 1 ? "card" : "cards"}
        </span>
      </ContentToolbar>
    </>
  );
}

function StudioResults({
  cards,
  filtered,
  onOpen,
  onCopy,
  onEdit,
  onDelete,
  onReset,
}: {
  cards: StudioCard[];
  filtered: StudioCard[];
  onOpen: (card: StudioCard) => void;
  onCopy: (card: StudioCard) => void;
  onEdit: (card: StudioCard) => void;
  onDelete: (card: StudioCard) => void;
  onReset: () => void;
}) {
  if (cards.length === 0) {
    return (
      <ContentEmptyState
        icon={<Sparkles aria-hidden />}
        title="No knowledge cards yet"
        description="Save an AI summary or write a note while reading and it will appear here."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/library">Browse library</Link>
          </Button>
        }
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <ContentEmptyState
        compact
        icon={<Search aria-hidden />}
        title="No matching cards"
        description="Try a different search or switch the card type."
        action={
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <div className={styles.grid} aria-label="Knowledge cards">
      {filtered.map((card) => (
        <StudioCardTile
          key={card.key}
          card={card}
          onOpen={onOpen}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

type DialogIntent = { key: string; mode: "view" | "edit" | "delete" } | null;

export default function StudioCards() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const source = useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const cards = useMemo(
    () => buildStudioCards(source.summaries, source.annotations),
    [source.annotations, source.summaries]
  );
  const [filter, setFilter] = useState<StudioCardFilter>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogIntent>(null);
  const filtered = useMemo(() => filterStudioCards(cards, query, filter), [cards, filter, query]);
  const selectedCard = cards.find((card) => card.key === dialog?.key) ?? null;

  async function handleCopy(card: StudioCard) {
    try {
      await copyText(studioCardCopyText(card));
      toast.success("Knowledge card copied");
    } catch {
      toast.error("Clipboard access is unavailable");
    }
  }

  const open = (card: StudioCard, mode: NonNullable<DialogIntent>["mode"]) =>
    setDialog({ key: card.key, mode });

  return (
    <>
      <StudioFilterBar
        cards={cards}
        filteredCount={filtered.length}
        filter={filter}
        query={query}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
      />
      <div id="studio-panel" role="tabpanel" aria-label="Knowledge cards">
        <StudioResults
          cards={cards}
          filtered={filtered}
          onOpen={(card) => open(card, "view")}
          onCopy={(card) => void handleCopy(card)}
          onEdit={(card) => open(card, "edit")}
          onDelete={(card) => open(card, "delete")}
          onReset={() => {
            setQuery("");
            setFilter("all");
          }}
        />
      </div>
      {selectedCard && dialog ? (
        <StudioCardDialog
          key={`${dialog.key}:${dialog.mode}`}
          card={selectedCard}
          summaries={source.summaries}
          annotations={source.annotations}
          initialMode={dialog.mode}
          onCopy={(card) => void handleCopy(card)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
