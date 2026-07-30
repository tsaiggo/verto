"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { FolderOpen, HardDrive, LoaderCircle, Plus, Search, X } from "lucide-react";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
import type { RuntimeLocalIndexedDocument } from "@/lib/runtime-local-index";
import { buildVaultSidebarTree, vaultName } from "./VaultSidebarData";
import { VaultSidebarDocumentRow, VaultSidebarTree } from "./VaultSidebarTree";

/**
 * A compact local-first page navigator for a Verto workspace. It owns the
 * runtime-index subscription, while pin persistence is intentionally lifted to
 * the workspace that embeds it so a vault can store that state in `.verto/`.
 */
export interface VaultSidebarProps {
  /** Optional DOM id for a responsive drawer trigger. */
  id?: string;
  /** Adds layout classes when the sidebar is placed in a larger shell. */
  className?: string;
  /** Marks a page as selected when its opaque local file id matches. */
  activeFileId?: string | null;
  /** Controlled list of locally pinned pages, in display order. */
  pinnedFileIds?: readonly string[];
  /** Initial pins for an uncontrolled sidebar. */
  defaultPinnedFileIds?: readonly string[];
  /** Called after a page is pinned or unpinned. */
  onPinnedFileIdsChange?: (fileIds: string[]) => void;
  /** Opens the host's native local-folder picker. */
  onChooseFolder?: () => void;
  /** Creates a new page inside the active local folder. */
  onCreatePage?: () => void;
  /** Whether the active host can currently create a page. */
  canCreatePage?: boolean;
  /** Indicates that the native folder picker is open. */
  isChoosingFolder?: boolean;
  /** Indicates that a page is being written to disk. */
  isCreatingPage?: boolean;
  /** Reports the latest folder or page action failure without hiding the library. */
  actionError?: string | null;
  /**
   * Lets a host route pages through a custom reader. By default every document
   * opens the local runtime reader at `/runtime/local?file=...`.
   */
  hrefForDocument?: (document: RuntimeLocalIndexedDocument) => string;
  /**
   * Allows an embedding workspace to supply an already-built local index.
   * The hook still runs so this remains safe when an override is removed.
   */
  runtimeOverride?: RuntimeLocalIndexState;
}

const iconProps = { size: 15, strokeWidth: 1.65 } as const;

/** Main local-vault sidebar. It reads the active runtime folder via the index hook. */
// eslint-disable-next-line complexity -- The sidebar renders the explicit idle, loading, error, search, pinned, and tree states in one navigation landmark.
export default function VaultSidebar({
  actionError = null,
  activeFileId,
  canCreatePage = false,
  className,
  defaultPinnedFileIds = [],
  hrefForDocument = runtimeLocalHref,
  id,
  isChoosingFolder = false,
  isCreatingPage = false,
  onChooseFolder,
  onCreatePage,
  onPinnedFileIdsChange,
  pinnedFileIds,
  runtimeOverride,
}: VaultSidebarProps) {
  const liveRuntime = useRuntimeLocalIndex({ enabled: runtimeOverride === undefined });
  const runtime = runtimeOverride ?? liveRuntime;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [uncontrolledPins, setUncontrolledPins] = useState<string[]>(() => [
    ...new Set(defaultPinnedFileIds),
  ]);
  const isControlled = pinnedFileIds !== undefined;
  const pins = isControlled ? [...new Set(pinnedFileIds)] : uncontrolledPins;
  const [openedFileId, setOpenedFileId] = useState<string | null>(null);

  const updatePins = (recipe: (current: string[]) => string[]) => {
    const next = recipe([...pins]);
    if (!isControlled) setUncontrolledPins(next);
    onPinnedFileIdsChange?.(next);
  };

  return (
    <aside
      id={id}
      aria-label="Local library"
      className={joinClasses(
        "flex min-h-0 w-full flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text)]",
        className
      )}
    >
      <VaultHeader
        runtime={runtime}
        isChoosingFolder={isChoosingFolder}
        onChooseFolder={onChooseFolder}
      />

      {onCreatePage ? (
        <>
          <button
            type="button"
            onClick={onCreatePage}
            disabled={!canCreatePage || isCreatingPage}
            className="mx-2 mb-1 flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:opacity-65"
            title={
              canCreatePage
                ? "Create a Markdown or MDX page"
                : "Choose a local folder in the desktop app first"
            }
          >
            {isCreatingPage ? (
              <LoaderCircle {...iconProps} className="animate-spin" aria-hidden />
            ) : (
              <Plus {...iconProps} aria-hidden />
            )}
            <span>{isCreatingPage ? "Creating page…" : "New page"}</span>
          </button>
          {actionError && canCreatePage ? (
            <p
              className="mx-3 mb-2 break-words text-[12px] leading-5 text-[var(--destructive)]"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="px-2 pb-2 pt-1">
        <label className="sr-only" htmlFor="vault-sidebar-search">
          Filter pages in this library
        </label>
        <div className="relative">
          <Search
            {...iconProps}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            id="vault-sidebar-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages"
            className="h-8 w-full rounded-lg border border-transparent bg-[var(--bg-muted)] py-1 pl-8 pr-8 text-[13px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:bg-[var(--bg)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)]"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
              aria-label="Clear page search"
            >
              <X {...iconProps} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <VaultContent
        activeFileId={activeFileId ?? openedFileId}
        deferredQuery={deferredQuery}
        hrefForDocument={hrefForDocument}
        onOpenDocument={setOpenedFileId}
        onTogglePin={(fileId) =>
          updatePins((current) =>
            current.includes(fileId)
              ? current.filter((candidate) => candidate !== fileId)
              : [...current, fileId]
          )
        }
        onChooseFolder={onChooseFolder}
        pinnedFileIds={pins}
        runtime={runtime}
      />
    </aside>
  );
}

function VaultHeader({
  isChoosingFolder,
  onChooseFolder,
  runtime,
}: {
  isChoosingFolder: boolean;
  onChooseFolder?: () => void;
  runtime: RuntimeLocalIndexState;
}) {
  const folder = runtime.status === "idle" ? null : runtime.folder;
  const label = folder ? vaultName(folder) : "Local library";
  const detail = folder ?? "Choose a folder to begin";
  const count = runtime.status === "ready" ? runtime.index.documents.length : null;

  return (
    <header className="flex items-center gap-2.5 px-3 pb-2 pt-3">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center text-[var(--text-muted)]"
      >
        <HardDrive {...iconProps} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[13px] font-semibold tracking-[-0.01em]">{label}</h2>
          {count !== null ? (
            <span className="font-mono text-[11px] leading-none text-[var(--text-muted)]">
              {count}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]" title={detail}>
          {detail}
        </p>
      </div>
      {onChooseFolder && folder ? (
        <button
          type="button"
          onClick={onChooseFolder}
          disabled={isChoosingFolder}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-wait disabled:opacity-60"
          aria-label="Change local library folder"
          title="Change local library folder"
        >
          {isChoosingFolder ? (
            <LoaderCircle {...iconProps} className="animate-spin" aria-hidden />
          ) : (
            <FolderOpen {...iconProps} aria-hidden />
          )}
        </button>
      ) : null}
    </header>
  );
}

interface VaultContentProps {
  activeFileId: string | null | undefined;
  deferredQuery: string;
  hrefForDocument: (document: RuntimeLocalIndexedDocument) => string;
  onOpenDocument: (fileId: string) => void;
  onChooseFolder?: () => void;
  onTogglePin: (fileId: string) => void;
  pinnedFileIds: readonly string[];
  runtime: RuntimeLocalIndexState;
}

function VaultContent({
  activeFileId,
  deferredQuery,
  hrefForDocument,
  onOpenDocument,
  onChooseFolder,
  onTogglePin,
  pinnedFileIds,
  runtime,
}: VaultContentProps) {
  if (runtime.status === "idle") return <NoVaultState onChooseFolder={onChooseFolder} />;
  if (runtime.status === "loading") return <VaultLoadingState />;
  if (runtime.status === "error") return <VaultErrorState error={runtime.error} />;

  const matchingDocuments = runtime.index.documents.filter((document) =>
    documentMatches(document, deferredQuery)
  );
  const tree = buildVaultSidebarTree(matchingDocuments);
  const pinnedById = new Map(
    runtime.index.documents.map((document) => [document.entry.id, document])
  );
  const pinned = pinnedFileIds
    .map((fileId) => pinnedById.get(fileId))
    .filter((document): document is RuntimeLocalIndexedDocument => document !== undefined)
    .filter((document) => documentMatches(document, deferredQuery));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      {pinned.length > 0 ? (
        <section aria-label="Pinned pages" className="mb-3">
          <SectionLabel>Pinned</SectionLabel>
          <ul className="mt-1 space-y-0.5">
            {pinned.map((document) => (
              <VaultSidebarDocumentRow
                key={`pin:${document.entry.id}`}
                active={activeFileId === document.entry.id}
                document={document}
                href={hrefForDocument(document)}
                onOpen={onOpenDocument}
                onTogglePin={onTogglePin}
                pinned
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Pages">
        <SectionLabel>{deferredQuery ? "Results" : "Pages"}</SectionLabel>
        {matchingDocuments.length > 0 ? (
          <VaultSidebarTree
            activeFileId={activeFileId}
            forcedOpen={Boolean(deferredQuery)}
            hrefForDocument={hrefForDocument}
            onOpenDocument={onOpenDocument}
            onTogglePin={onTogglePin}
            pinnedFileIds={pinnedFileIds}
            tree={tree}
          />
        ) : (
          <EmptyPages query={deferredQuery} hasDocuments={runtime.index.documents.length > 0} />
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="px-2 text-[12px] font-semibold leading-6 text-[var(--text-muted)]">
      {children}
    </h3>
  );
}

function NoVaultState({ onChooseFolder }: { onChooseFolder?: () => void }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-[13px] font-medium text-[var(--text)]">No local folder selected</p>
      <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
        Choose a Markdown or MDX folder to see its pages here.
      </p>
      {onChooseFolder ? (
        <button
          type="button"
          onClick={onChooseFolder}
          className="mt-3 inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[12px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          Choose folder
        </button>
      ) : (
        <Link
          href="/integrations"
          className="mt-3 inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[12px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          Choose folder
        </Link>
      )}
    </div>
  );
}

function VaultLoadingState() {
  return (
    <div className="space-y-3 px-4 py-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading local vault pages</span>
      <div className="h-2 w-12 rounded bg-[var(--bg-muted)]" />
      <div className="space-y-2">
        <div className="h-7 rounded-md bg-[var(--bg-muted)]" />
        <div className="h-7 rounded-md bg-[var(--bg-muted)]" />
        <div className="h-7 w-4/5 rounded-md bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}

function VaultErrorState({ error }: { error: string }) {
  return (
    <div className="px-4 py-6" role="alert">
      <p className="text-[13px] font-medium text-[var(--destructive)]">
        Could not read this library
      </p>
      <p className="mt-1 break-words text-[12px] leading-5 text-[var(--text-muted)]">{error}</p>
    </div>
  );
}

function EmptyPages({ hasDocuments, query }: { hasDocuments: boolean; query: string }) {
  const message = query
    ? `No pages match “${query}”.`
    : hasDocuments
      ? "No pages are visible in this folder."
      : "This folder has no Markdown or MDX pages yet.";
  return <p className="px-2 py-3 text-[12px] leading-5 text-[var(--text-muted)]">{message}</p>;
}

function documentMatches(document: RuntimeLocalIndexedDocument, query: string): boolean {
  if (!query) return true;
  const haystack = [
    document.node.title,
    document.entry.path.join("/"),
    ...(document.node.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function runtimeLocalHref(document: RuntimeLocalIndexedDocument): string {
  const params = new URLSearchParams({
    file: document.entry.id,
    title: document.node.title,
    ext: document.node.ext,
  });
  return `/runtime/local?${params.toString()}`;
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
