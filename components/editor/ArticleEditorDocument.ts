"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  createBrowserArticle,
  findBrowserArticleByOriginSlug,
  readBrowserArticle,
  saveBrowserArticle,
  subscribeBrowserArticles,
  updateBrowserArticleMetadata,
  deleteBrowserArticle,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { loadActiveLocalFolder } from "@/lib/local-folder";
import { isTauri, readLocalFile, writeLocalFile } from "@/lib/tauri";

export type ArticleSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";
type LoadState = { kind: "loading" | "ready" } | { kind: "error"; message: string };
const EMPTY_SOURCE = "# Untitled\n\n";
export const ARTICLE_AUTOSAVE_DELAY = 600;

interface LoadedDocument {
  source: string;
  filename: string;
  fileId?: string;
  article?: BrowserArticle;
}

function defaultFilename(slug?: string) {
  return `${slug?.split("/").pop() || "untitled"}.mdx`;
}

async function loadSourceDocument(slug: string, desktop: boolean): Promise<LoadedDocument> {
  if (desktop) {
    const folder = loadActiveLocalFolder();
    if (!folder) throw new Error("No active folder selected. Use Connect Source first.");
    for (const ext of [".mdx", ".md"]) {
      const path = `${folder}/${slug}${ext}`;
      try {
        return {
          source: await readLocalFile(folder, path),
          filename: `${slug.split("/").pop()}${ext}`,
          fileId: path,
        };
      } catch {
        // Local documents may use either supported extension.
      }
    }
    throw new Error(`"${slug}" not found in ${folder}. Editing a new file.`);
  }
  const local = await findBrowserArticleByOriginSlug(slug);
  if (local) return { source: local.source, filename: local.filename, article: local };
  const response = await fetch(`/api/editor?slug=${encodeURIComponent(slug)}`);
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Error("This source is unavailable. Open a saved browser article or try again.");
  }
  const json = (await response.json()) as {
    source?: string;
    id?: string;
    ext?: string;
    error?: string;
  };
  if (!response.ok || json.error) throw new Error(json.error ?? `Error ${response.status}`);
  if (typeof json.source !== "string" || typeof json.ext !== "string")
    throw new Error("Unexpected API response.");
  return { source: json.source, filename: `${slug.split("/").pop() || "untitled"}${json.ext}` };
}

function routeToArticle(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("slug");
  url.searchParams.set("document", id);
  window.history.replaceState(window.history.state, "", url);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// One queue owns the successful revision. A queued write can use the revision
// from our preceding write, but never the revision returned by a conflict.
export function useArticleEditorDocument(slug?: string) {
  const desktop = isTauri();
  const searchParams = useSearchParams();
  const routeSearch = searchParams?.toString();
  // Managed app-library articles share the same lifecycle on Web and desktop.
  // Existing native source routes continue to write explicitly to their folder.
  const managed =
    !desktop || Boolean(searchParams?.get("document")) || searchParams?.get("managed") === "1";
  const [source, setSource] = useState(EMPTY_SOURCE);
  const [filename, setFilename] = useState(defaultFilename(slug));
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [saveStatus, setSaveStatus] = useState<ArticleSaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [article, setArticle] = useState<BrowserArticle | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [originSlug, setOriginSlug] = useState<string | undefined>(slug);
  const [revision, setRevision] = useState(0);
  const [baseline, setBaseline] = useState({
    source: EMPTY_SOURCE,
    filename: defaultFilename(slug),
  });
  const [reloadSequence, setReloadSequence] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const mountedRef = useRef(true);
  const readyRef = useRef(false);
  const generationRef = useRef(0);
  const snapshotRef = useRef({ source: EMPTY_SOURCE, filename: defaultFilename(slug) });
  const articleRef = useRef<BrowserArticle | null>(null);
  const candidateRef = useRef<BrowserArticle | null>(null);
  const originSlugRef = useRef<string | undefined>(slug);
  const conflictRef = useRef(false);
  const pendingRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeSavingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const adopt = useCallback((loaded: LoadedDocument) => {
    const next = { source: loaded.source, filename: loaded.filename };
    snapshotRef.current = next;
    articleRef.current = loaded.article ?? null;
    candidateRef.current = null;
    conflictRef.current = false;
    setSource(next.source);
    setFilename(next.filename);
    setBaseline(next);
    setArticle(loaded.article ?? null);
    setFileId(loaded.fileId ?? null);
    setLoadState({ kind: "ready" });
    setSaveStatus(loaded.article ? "saved" : "idle");
    setSaveError("");
    setRevision((current) => current + 1);
    readyRef.current = true;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch ?? window.location.search);
    const activeSlug = slug ?? (params.get("slug")?.trim() || undefined);
    const documentId = params.get("document")?.trim();
    // The first committed browser save replaces only the URL. It must not
    // reload the editor or reset its native textarea undo history.
    if (documentId && documentId === articleRef.current?.id && readyRef.current) return;
    const generation = ++generationRef.current;
    readyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    originSlugRef.current = activeSlug;
    setOriginSlug(activeSlug);
    setLoadState({ kind: "loading" });
    async function load() {
      try {
        if (documentId) {
          const local = await readBrowserArticle(documentId);
          if (!local)
            throw new Error(
              desktop
                ? "This article was removed or is stored in another desktop library."
                : "This article was removed or is stored at another browser address or profile."
            );
          if (generation !== generationRef.current || !mountedRef.current) return;
          originSlugRef.current = local.originSlug;
          setOriginSlug(local.originSlug);
          adopt({ source: local.source, filename: local.filename, article: local });
        } else if (activeSlug) {
          const loaded = await loadSourceDocument(activeSlug, desktop);
          if (generation !== generationRef.current || !mountedRef.current) return;
          adopt(loaded);
          if (loaded.article) routeToArticle(loaded.article.id);
        } else {
          adopt({ source: EMPTY_SOURCE, filename: "untitled.mdx" });
        }
      } catch (error) {
        if (generation !== generationRef.current || !mountedRef.current) return;
        if (!managed) adopt({ source: EMPTY_SOURCE, filename: defaultFilename(activeSlug) });
        setLoadState({ kind: "error", message: errorMessage(error) });
      }
    }
    void load();
  }, [adopt, desktop, managed, reloadSequence, routeSearch, slug]);

  const showConflict = useCallback(() => {
    conflictRef.current = true;
    setSaveStatus("conflict");
    setSaveError("This article changed in another window. Your text is kept here.");
  }, []);

  useEffect(() => {
    if (!managed) return;
    return subscribeBrowserArticles(() => {
      const current = articleRef.current;
      if (!current || !readyRef.current) return;
      const generation = generationRef.current;
      void readBrowserArticle(current.id)
        .then((stored) => {
          if (!mountedRef.current || generation !== generationRef.current || pendingRef.current > 0)
            return;
          if (!stored || stored.revision !== articleRef.current?.revision) showConflict();
        })
        .catch(() => {
          // The next save will surface an unavailable store without losing input.
        });
    });
  }, [managed, showConflict]);

  const persist = useCallback(
    (status?: "saved") => {
      if (!readyRef.current || conflictRef.current) return Promise.resolve();
      if (timerRef.current) clearTimeout(timerRef.current);
      const captured = { ...snapshotRef.current };
      const generation = generationRef.current;
      pendingRef.current += 1;
      setPendingCount(pendingRef.current);
      setSaveStatus("saving");
      setSaveError("");
      const write = async () => {
        try {
          if (generation !== generationRef.current || conflictRef.current) return;
          const current = articleRef.current;
          const candidate =
            current ??
            candidateRef.current ??
            createBrowserArticle({ ...captured, originSlug: originSlugRef.current });
          candidateRef.current = candidate;
          const result = await saveBrowserArticle(
            { ...candidate, ...captured, status: status ?? candidate.status },
            current?.revision ?? null
          );
          if (generation !== generationRef.current || !mountedRef.current) return;
          if (result.status !== "saved") {
            showConflict();
            return;
          }
          articleRef.current = result.article;
          candidateRef.current = null;
          setArticle(result.article);
          setBaseline(captured);
          routeToArticle(result.article.id);
          const latest = snapshotRef.current;
          setSaveStatus(
            pendingRef.current > 1
              ? "saving"
              : latest.source === captured.source && latest.filename === captured.filename
                ? "saved"
                : "idle"
          );
        } catch (error) {
          if (generation === generationRef.current && mountedRef.current) {
            setSaveStatus("error");
            setSaveError(`Could not save this article. ${errorMessage(error)}`);
          }
        } finally {
          pendingRef.current -= 1;
          if (mountedRef.current) setPendingCount(pendingRef.current);
        }
      };
      queueRef.current = queueRef.current.then(write, write);
      return queueRef.current;
    },
    [showConflict]
  );

  const change = (next: { source: string; filename: string }) => {
    if (
      next.source === snapshotRef.current.source &&
      next.filename === snapshotRef.current.filename
    )
      return;
    snapshotRef.current = next;
    setSource(next.source);
    setFilename(next.filename);
    setRevision((current) => current + 1);
    if (!conflictRef.current) setSaveStatus(pendingRef.current > 0 ? "saving" : "idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (managed && readyRef.current && !conflictRef.current)
      timerRef.current = setTimeout(() => void persist(), ARTICLE_AUTOSAVE_DELAY);
  };

  async function save() {
    if (
      !readyRef.current ||
      conflictRef.current ||
      pendingRef.current > 0 ||
      nativeSavingRef.current
    )
      return;
    if (managed) return persist("saved");
    nativeSavingRef.current = true;
    pendingRef.current += 1;
    setPendingCount(pendingRef.current);
    const generation = generationRef.current;
    setSaveStatus("saving");
    setSaveError("");
    const captured = { ...snapshotRef.current };
    const root = loadActiveLocalFolder();
    const path = fileId ?? (root ? `${root}/${captured.filename}` : null);
    try {
      if (!root || !path)
        throw new Error("No active folder. Use Connect Source to select a folder first.");
      await writeLocalFile(root, path, captured.source);
      if (mountedRef.current && generation === generationRef.current) {
        setFileId(path);
        setBaseline(captured);
        setSaveStatus("saved");
      }
    } catch (error) {
      const message = errorMessage(error);
      if (mountedRef.current && generation === generationRef.current) {
        setSaveStatus("error");
        setSaveError(message);
      }
      toast.error("Save failed — draft may not be on disk", { description: message });
    } finally {
      nativeSavingRef.current = false;
      pendingRef.current -= 1;
      if (mountedRef.current) setPendingCount(pendingRef.current);
    }
  }

  async function loadSavedVersion() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const generation = generationRef.current;
    const current = articleRef.current ?? candidateRef.current;
    if (!current) return;
    await queueRef.current;
    if (!mountedRef.current || generation !== generationRef.current) return;
    try {
      const stored = await readBrowserArticle(current.id);
      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        current.id !== (articleRef.current ?? candidateRef.current)?.id
      )
        return;
      if (!stored)
        throw new Error("The saved article was removed. Export your text to keep a copy.");
      adopt({ source: stored.source, filename: stored.filename, article: stored });
    } catch (error) {
      if (mountedRef.current && generation === generationRef.current)
        setSaveError(errorMessage(error));
    }
  }

  async function updateMetadata(patch: Partial<Pick<BrowserArticle, "title" | "parentId">>) {
    const current = articleRef.current;
    if (
      !current ||
      !readyRef.current ||
      conflictRef.current ||
      pendingRef.current > 0 ||
      snapshotRef.current.source !== current.source ||
      snapshotRef.current.filename !== current.filename
    )
      throw new Error("Save your current changes before organizing this page.");
    const generation = generationRef.current;
    pendingRef.current += 1;
    setPendingCount(pendingRef.current);
    setSaveStatus("saving");
    setSaveError("");
    const write = async () => {
      try {
        const result = await updateBrowserArticleMetadata(current.id, patch, current.revision);
        if (
          !mountedRef.current ||
          generation !== generationRef.current ||
          articleRef.current?.id !== current.id
        )
          return;
        if (result.status !== "saved") {
          showConflict();
          throw new Error(
            "This page changed in another window. Load its saved version before organizing it."
          );
        }
        articleRef.current = result.article;
        setArticle(result.article);
        const latest = snapshotRef.current;
        setSaveStatus(
          pendingRef.current > 1
            ? "saving"
            : latest.source === result.article.source && latest.filename === result.article.filename
              ? "saved"
              : "idle"
        );
      } catch (error) {
        if (mountedRef.current && generation === generationRef.current && !conflictRef.current) {
          setSaveStatus("error");
          setSaveError(errorMessage(error));
        }
        throw error;
      } finally {
        pendingRef.current -= 1;
        if (mountedRef.current) setPendingCount(pendingRef.current);
      }
    };
    const result = queueRef.current.then(write, write);
    queueRef.current = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  async function removePage() {
    const current = articleRef.current;
    if (
      !current ||
      !readyRef.current ||
      conflictRef.current ||
      pendingRef.current > 0 ||
      snapshotRef.current.source !== current.source ||
      snapshotRef.current.filename !== current.filename
    )
      throw new Error("Save your current changes before removing this page.");
    const generation = generationRef.current;
    pendingRef.current += 1;
    setPendingCount(pendingRef.current);
    setSaveStatus("saving");
    const write = async () => {
      try {
        const result = await deleteBrowserArticle(current.id, current.revision);
        if (!mountedRef.current || generation !== generationRef.current) return false;
        if (result.status === "conflict") {
          showConflict();
          throw new Error(
            "This page changed in another window. Load its saved version before removing it."
          );
        }
        if (result.status === "has-children")
          throw new Error("Move or remove the subpages first. This page was kept.");
        if (result.status === "missing") throw new Error("This page has already been removed.");
        readyRef.current = false;
        conflictRef.current = true;
        setSaveStatus("conflict");
        setSaveError("This saved page was removed. Export your text to keep a copy.");
        return true;
      } catch (error) {
        if (mountedRef.current && generation === generationRef.current && !conflictRef.current) {
          setSaveStatus("error");
          setSaveError(errorMessage(error));
        }
        throw error;
      } finally {
        pendingRef.current -= 1;
        if (mountedRef.current) setPendingCount(pendingRef.current);
      }
    };
    const result = queueRef.current.then(write, write);
    queueRef.current = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  const dirty = source !== baseline.source || filename !== baseline.filename;
  return {
    source,
    filename,
    article,
    fileId,
    originSlug,
    sessionId: generationRef.current,
    desktop,
    managed,
    revision,
    loadState,
    saveStatus,
    saveError,
    dirty,
    blockLeave: dirty || pendingCount > 0,
    readOnly: loadState.kind === "loading" || (managed && loadState.kind === "error"),
    canSave:
      loadState.kind !== "loading" &&
      (!managed || loadState.kind !== "error") &&
      saveStatus !== "saving" &&
      pendingCount === 0 &&
      saveStatus !== "conflict",
    changeSource: (next: string) => change({ ...snapshotRef.current, source: next }),
    changeFilename: (next: string) => change({ ...snapshotRef.current, filename: next }),
    save,
    loadSavedVersion,
    updateMetadata,
    removePage,
    retryLoad: () => setReloadSequence((current) => current + 1),
  };
}
