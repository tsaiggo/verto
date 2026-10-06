"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, FileText, Search } from "lucide-react";
import { useBrowserArticles } from "@/components/articles/useBrowserArticles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requestAppNavigation } from "@/lib/app-navigation";
import {
  buildDocumentSwitcherEntries,
  loadDocumentVisits,
  recordDocumentVisit,
  selectDocumentSwitcherResults,
  subscribeDocumentVisits,
  type DocumentVisit,
  type SourceSwitcherDocument,
} from "@/lib/document-switcher";
import { hydrateReadingState, loadReadingState, type ReadingEntry } from "@/lib/reading-state";
import { getStateStore } from "@/lib/state-store";
import { isTauri } from "@/lib/tauri";
import { useImportedDocuments } from "./useImportedDocuments";
import DocumentSwitcherResults from "./DocumentSwitcherResults";
import styles from "./DocumentSwitcher.module.css";

export interface DocumentSwitcherProps {
  mode: "read" | "edit";
  currentId?: string;
  currentHref?: string;
  currentTitle?: string;
  sourceDocuments?: SourceSwitcherDocument[];
  compact?: boolean;
}

const emptySnapshot = () => "[]";
const visitsSnapshot = () => JSON.stringify(loadDocumentVisits());
const readingSnapshot = () => JSON.stringify(loadReadingState().recent);
const subscribeReading = (listener: () => void) => getStateStore().subscribe(listener);

export default function DocumentSwitcher({
  mode,
  currentId,
  currentHref,
  currentTitle,
  sourceDocuments,
  compact = false,
}: DocumentSwitcherProps) {
  const articles = useBrowserArticles();
  const imported = useImportedDocuments();
  const [open, setOpen] = useDocumentSwitcherOpen(currentHref ?? currentId ?? "");
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useSearchFocus(inputRef, open);
  const listId = useId();
  const visits = useSyncExternalStore(subscribeDocumentVisits, visitsSnapshot, emptySnapshot);
  const reading = useSyncExternalStore(subscribeReading, readingSnapshot, emptySnapshot);
  const entries = useMemo(
    () =>
      buildDocumentSwitcherEntries({
        mode,
        currentId,
        currentHref,
        articles: articles.articles,
        importedDocuments: imported.documents,
        sourceDocuments,
        localSourceLabel: isTauri() ? "Desktop library" : "Browser library",
      }),
    [mode, currentId, currentHref, articles.articles, imported.documents, sourceDocuments]
  );
  const results = useMemo(
    () =>
      selectDocumentSwitcherResults(
        entries,
        query,
        JSON.parse(visits) as DocumentVisit[],
        JSON.parse(reading) as ReadingEntry[]
      ),
    [entries, query, visits, reading]
  );
  const current = entries.find((entry) => entry.current);
  const currentReadingHref = current?.readingHref;
  useEffect(() => {
    if (currentReadingHref) recordDocumentVisit(currentReadingHref);
  }, [currentReadingHref]);
  useEffect(() => {
    if (open) void hydrateReadingState().catch(() => {});
  }, [open]);

  const activeIndex = results.findIndex(({ entry }) => entry.key === activeKey);
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;
  useScrollActiveOption(listRef, open, activeId);

  const loading =
    articles.status === "loading" || (mode === "read" && imported.status === "loading");
  const errors = [
    ...(articles.status === "error" ? ["Saved articles couldn’t be loaded."] : []),
    ...(mode === "read" && imported.status === "error"
      ? ["Reading files couldn’t be loaded."]
      : []),
  ];
  const label = currentTitle?.trim() || current?.title || "Documents";

  function moveActive(direction: number) {
    if (!results.length) return;
    const next =
      activeIndex < 0
        ? direction > 0
          ? 0
          : results.length - 1
        : (activeIndex + direction + results.length) % results.length;
    setActiveKey(results[next].entry.key);
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, current = false) {
    documentNavigationHandler(event, current, { setOpen, inputRef, triggerRef });
  }

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActiveKey(null);
        }
      }}
    >
      <DocumentSwitcherTrigger compact={compact} label={label} triggerRef={triggerRef} />
      <PopoverContent
        align="start"
        className={styles.popover}
        aria-label="Switch document"
        data-document-switcher
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (!event.isComposing) {
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
      >
        <DocumentSwitcherSearch
          inputRef={inputRef}
          listId={listId}
          activeId={activeId}
          open={open}
          query={query}
          onChange={(value) => {
            setQuery(value);
            setActiveKey(null);
          }}
          onMove={moveActive}
          onPick={() => {
            if (results.length)
              listRef.current
                ?.querySelector<HTMLAnchorElement>(`[id="${listId}-${Math.max(activeIndex, 0)}"]`)
                ?.click();
          }}
        />
        <DocumentSwitcherResults
          listRef={listRef}
          listId={listId}
          loading={loading}
          errors={errors}
          results={results}
          activeKey={activeKey}
          query={query}
          mode={mode}
          onActivate={setActiveKey}
          onPick={(entry, event) => navigate(event, entry.current)}
          onRetry={() => {
            articles.retry();
            if (mode === "read") imported.retry();
          }}
        />
        <Link href="/library" prefetch={false} className={styles.library} onClick={navigate}>
          <span>Open Library</span>
          <ArrowUpRight aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function useSearchFocus(inputRef: RefObject<HTMLInputElement | null>, open: boolean) {
  useLayoutEffect(() => {
    if (open) inputRef.current?.focus();
  }, [inputRef, open]);
}

function documentNavigationHandler(
  event: MouseEvent<HTMLAnchorElement>,
  current: boolean,
  {
    setOpen,
    inputRef,
    triggerRef,
  }: {
    setOpen: (open: boolean) => void;
    inputRef: RefObject<HTMLInputElement | null>;
    triggerRef: RefObject<HTMLButtonElement | null>;
  }
) {
  if (isModifiedClick(event)) return;
  if (event.defaultPrevented || (!current && !requestAppNavigation())) {
    event.preventDefault();
    return inputRef.current?.focus();
  }
  if (current) {
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
    return;
  }
  const href = event.currentTarget.getAttribute("href");
  if (isInPlaceDocumentSwitch(href)) {
    event.preventDefault();
    // These static routes load documents from search params. Next's patched
    // history preserves the workspace and updates the active document together.
    window.history.pushState(null, "", href);
  }
}

function isInPlaceDocumentSwitch(href: string | null): href is string {
  const pathname = window.location.pathname;
  return (
    !!href &&
    ["/editor", "/read/local", "/read/file"].includes(pathname) &&
    href.startsWith(`${pathname}?document=`)
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function useDocumentSwitcherOpen(documentKey: string) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  return [
    openFor === documentKey,
    (open: boolean) => setOpenFor(open ? documentKey : null),
  ] as const;
}

function useScrollActiveOption(
  listRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  activeId?: string
) {
  useEffect(() => {
    if (open && activeId) {
      listRef.current?.querySelector<HTMLElement>(`[id="${activeId}"]`)?.scrollIntoView?.({
        block: "nearest",
      });
    }
  }, [listRef, open, activeId]);
}

function DocumentSwitcherSearch({
  inputRef,
  listId,
  activeId,
  open,
  query,
  onChange,
  onMove,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  activeId?: string;
  open: boolean;
  query: string;
  onChange: (query: string) => void;
  onMove: (direction: number) => void;
  onPick: () => void;
}) {
  return (
    <div className={styles.search}>
      <Search aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search documents"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        placeholder="Search documents"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onMove(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Enter") {
            event.preventDefault();
            onPick();
          }
        }}
      />
    </div>
  );
}

function DocumentSwitcherTrigger({
  compact,
  label,
  triggerRef,
}: {
  compact: boolean;
  label: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        data-compact={compact}
        data-document-switcher-trigger
        aria-label="Switch document"
        title={`Switch document · ${label}`}
      >
        {compact ? <ChevronDown aria-hidden /> : <FileText aria-hidden />}
        {!compact ? (
          <>
            <span className={styles.currentTitle}>{label}</span>
            <ChevronDown aria-hidden className={styles.chevron} />
          </>
        ) : null}
      </button>
    </PopoverTrigger>
  );
}
