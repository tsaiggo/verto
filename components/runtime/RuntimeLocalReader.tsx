"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import VaultSidebar from "@/components/workspace/VaultSidebar";
import { estimateReadingTime } from "@/lib/reading-time";
import { extractTOC } from "@/lib/toc";
import { readVertoDocumentMetadata } from "@/lib/vault-document";

import {
  extensionFromPath,
  formatFromExt,
  LocalVaultAgentRail,
  LocalVaultDocumentCanvas,
  LocalVaultLoadingCanvas,
  LocalVaultOutlineRail,
  titleFromPath,
} from "./LocalVaultWorkspaceChrome";
import styles from "./RuntimeLocalReader.module.css";
import { LOCAL_VAULT_DESIGN_PREVIEW } from "./local-vault-design-preview";
import {
  type LocalVaultDocumentLoadState,
  useRuntimeLocalWorkspace,
} from "./useRuntimeLocalWorkspace";

/**
 * The desktop local vault is deliberately a route-owned workspace instead of
 * a dressed-up document reader. Its only source of truth remains the selected
 * MD/MDX folder; OneDrive and similar tools can synchronize that folder
 * independently without a Verto account or server-side database.
 */
// eslint-disable-next-line complexity, max-lines-per-function -- This route coordinates responsive panels, local I/O, and design-preview state at one route boundary.
export default function RuntimeLocalReader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeFile = searchParams?.get("file") ?? "";
  const showDesignPreview =
    process.env.NODE_ENV !== "production" && searchParams?.get("preview") === "workspace";
  const preview = useLocalVaultDesignPreview(routeFile, showDesignPreview);
  const file = preview.file ?? routeFile;
  const requestedTitle = searchParams?.get("title") ?? titleFromPath(file);
  const ext = searchParams?.get("ext") ?? extensionFromPath(file);
  const documentScrollRef = useRef<HTMLDivElement>(null);
  const workspace = useRuntimeLocalWorkspace({ file: showDesignPreview ? "" : routeFile, router });
  const {
    chooseFolder,
    createPage,
    desktop,
    folderError,
    hasVault,
    isCreatingPage,
    isPickingFolder,
    retryDocument,
    saveDocument,
    state,
  } = workspace;
  const visibleState = useMemo(() => preview.state ?? state, [preview.state, state]);
  const [contextOpen, setContextOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const visibleHasVault = showDesignPreview || hasVault || visibleState?.status === "ready";
  const canEdit = showDesignPreview || desktop;
  const saveVisibleDocument = preview.saveDocument ?? saveDocument;

  const documentTitle = useMemo(() => {
    if (visibleState?.status !== "ready") return requestedTitle || "Untitled";
    return (
      readVertoDocumentMetadata(visibleState.source)?.title || requestedTitle || titleFromPath(file)
    );
  }, [file, requestedTitle, visibleState]);

  const format = formatFromExt(ext || file);
  const toc = useMemo(
    () => (visibleState?.status === "ready" ? extractTOC(visibleState.source) : []),
    [visibleState]
  );
  const readingMinutes = useMemo(
    () => (visibleState?.status === "ready" ? estimateReadingTime(visibleState.source) : 0),
    [visibleState]
  );
  const documentRef = useMemo(
    () => ({
      href: runtimeLocalHref(file, documentTitle, ext || extensionFromPath(file)),
      slug: ["runtime-local", file || documentTitle],
      title: documentTitle,
    }),
    [documentTitle, ext, file]
  );

  const scrollToHeading = useCallback((id: string) => {
    const target = documentScrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const compactContext = window.matchMedia("(max-width: 1279px)");
    const syncResponsivePanels = () => {
      setContextOpen(!compactContext.matches);
      setLibraryOpen(false);
    };

    syncResponsivePanels();
    compactContext.addEventListener("change", syncResponsivePanels);
    return () => {
      compactContext.removeEventListener("change", syncResponsivePanels);
    };
  }, []);

  useEffect(() => {
    const closeTransientPanels = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") return;
      setContextOpen(false);
      setLibraryOpen(false);
    };

    window.addEventListener("keydown", closeTransientPanels);
    return () => window.removeEventListener("keydown", closeTransientPanels);
  }, []);

  return (
    <div className={styles.workspace}>
      <div className={styles.shell} data-library-open={libraryOpen}>
        <VaultSidebar
          id="local-library-sidebar"
          activeFileId={file || null}
          canCreatePage={desktop && visibleHasVault}
          className={styles.sidebar}
          isChoosingFolder={isPickingFolder}
          isCreatingPage={isCreatingPage}
          actionError={folderError}
          onChooseFolder={() => void chooseFolder()}
          onCreatePage={() => void createPage()}
          defaultPinnedFileIds={
            showDesignPreview ? LOCAL_VAULT_DESIGN_PREVIEW.pinnedFileIds : undefined
          }
          runtimeOverride={
            showDesignPreview
              ? {
                  status: "ready",
                  folder: LOCAL_VAULT_DESIGN_PREVIEW.index.folder,
                  index: LOCAL_VAULT_DESIGN_PREVIEW.index,
                  error: null,
                }
              : undefined
          }
          hrefForDocument={
            showDesignPreview ? (document) => `${document.node.href}&preview=workspace` : undefined
          }
        />

        <section className={styles.workSurface} aria-label="Local library workspace">
          <button
            type="button"
            className={styles.mobileLibraryToggle}
            aria-controls="local-library-sidebar"
            aria-expanded={libraryOpen}
            onClick={() => {
              setLibraryOpen((current) => !current);
              if (window.matchMedia("(max-width: 1279px)").matches) {
                setContextOpen(false);
              }
            }}
            title={libraryOpen ? "Close local library" : "Open local library"}
          >
            {libraryOpen ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
            <span className="sr-only">
              {libraryOpen ? "Close local library" : "Open local library"}
            </span>
          </button>
          {libraryOpen ? (
            <button
              type="button"
              className={styles.libraryBackdrop}
              aria-label="Close local library"
              onClick={() => setLibraryOpen(false)}
            />
          ) : null}
          {contextOpen ? (
            <button
              type="button"
              className={styles.contextBackdrop}
              aria-label="Close Agent"
              onClick={() => setContextOpen(false)}
            />
          ) : null}
          <div
            className={styles.workspaceBody}
            data-context-open={contextOpen}
            data-reader-workbench
          >
            <LocalVaultOutlineRail
              file={file}
              format={format}
              readingMinutes={readingMinutes}
              source={visibleState?.status === "ready" ? visibleState.source : null}
              toc={toc}
              onSelectHeading={scrollToHeading}
            />

            <section className={styles.documentPane} aria-label="Document" data-reader-document>
              <div ref={documentScrollRef} className={styles.documentScroll} data-page-scroll>
                <LocalVaultDocumentCanvas
                  desktop={canEdit}
                  documentTitle={documentTitle}
                  file={file}
                  folderError={folderError}
                  format={format}
                  hasVault={visibleHasVault}
                  isPickingFolder={isPickingFolder}
                  onChooseFolder={() => void chooseFolder()}
                  onRetry={() => retryDocument()}
                  onSave={saveVisibleDocument}
                  state={visibleState}
                />
              </div>
            </section>

            <LocalVaultAgentRail
              document={documentRef}
              open={contextOpen}
              onClose={() => setContextOpen(false)}
              onOpen={() => {
                setLibraryOpen(false);
                setContextOpen(true);
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function useLocalVaultDesignPreview(
  routeFile: string,
  enabled: boolean
): {
  file: string | null;
  saveDocument: ((payload: { source: string; forceOverwrite?: boolean }) => Promise<void>) | null;
  state: LocalVaultDocumentLoadState | null;
} {
  const [sources, setSources] = useState<Record<string, string>>({});
  const document = useMemo(() => {
    if (!enabled) return null;
    return (
      LOCAL_VAULT_DESIGN_PREVIEW.index.documents.find(
        (candidate) => candidate.entry.id === routeFile
      ) ?? LOCAL_VAULT_DESIGN_PREVIEW.document
    );
  }, [enabled, routeFile]);
  const source = document ? (sources[document.entry.id] ?? document.raw) : null;
  const state = useMemo<LocalVaultDocumentLoadState | null>(
    () =>
      document && source
        ? { status: "ready", file: document.entry.id, source, revision: "design-preview" }
        : null,
    [document, source]
  );
  const saveDocument = useCallback(
    async ({ source }: { source: string }) => {
      if (!document) return;
      setSources((current) => ({ ...current, [document.entry.id]: source }));
    },
    [document, setSources]
  );

  return { file: document?.entry.id ?? null, saveDocument: enabled ? saveDocument : null, state };
}

/** Matches the local-vault shell while the route's search params hydrate. */
export function RuntimeLocalWorkspaceFallback() {
  return (
    <div className={styles.workspace} aria-busy="true" aria-live="polite">
      <div className={styles.shell}>
        <section className={styles.workSurface}>
          <LocalVaultLoadingCanvas title="local workspace" />
        </section>
      </div>
      <span className="sr-only">Loading local workspace…</span>
    </div>
  );
}

function runtimeLocalHref(file: string, title: string, ext: string): string {
  if (!file) return "/runtime/local";
  const params = new URLSearchParams({ file, title, ext });
  return `/runtime/local?${params.toString()}`;
}
