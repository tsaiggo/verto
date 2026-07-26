"use client";

import { useCallback, useEffect, useState } from "react";

import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  readRuntimeLocalFile,
} from "@/lib/runtime-local-folder";
import { isTauri, writeLocalFile } from "@/lib/tauri";
import { createVaultDocument } from "@/lib/vault-document";

export type LocalVaultDocumentLoadState =
  | { status: "loading"; file: string }
  | { status: "ready"; file: string; source: string }
  | { status: "error"; file: string; message: string };

interface WorkspaceRouter {
  push(href: string): void;
  replace(href: string): void;
}

interface UseRuntimeLocalWorkspaceOptions {
  file: string;
  router: WorkspaceRouter;
}

/** Owns local-file session state; the route component only composes the UI. */
export function useRuntimeLocalWorkspace({ file, router }: UseRuntimeLocalWorkspaceOptions) {
  const [state, setState] = useState<LocalVaultDocumentLoadState | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [readRevision, setReadRevision] = useState(0);

  useEffect(() => setDesktop(isTauri()), []);

  useEffect(() => {
    const refreshFolder = () => setFolder(loadActiveRuntimeLocalFolder());
    queueMicrotask(refreshFolder);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
    window.addEventListener("storage", refreshFolder);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
      window.removeEventListener("storage", refreshFolder);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setState(null);
      return;
    }

    setState({ status: "loading", file });
    readRuntimeLocalFile(file)
      .then((source) => {
        if (!cancelled) setState({ status: "ready", file, source });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            file,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, readRevision]);

  const retryDocument = useCallback(() => {
    if (!file) return;
    setFolderError(null);
    setReadRevision((revision) => revision + 1);
  }, [file]);

  const chooseFolder = useCallback(async () => {
    if (isPickingFolder) return;
    setIsPickingFolder(true);
    setFolderError(null);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (selection) {
        setFolder(selection.folder);
        router.replace("/runtime/local");
      }
    } catch (error: unknown) {
      setFolderError(
        error instanceof Error ? error.message : "Could not open the local folder picker."
      );
    } finally {
      setIsPickingFolder(false);
    }
  }, [isPickingFolder, router]);

  const saveDocument = useCallback(
    async ({ source }: { source: string }) => {
      const folder = loadActiveRuntimeLocalFolder();
      if (!desktop || !folder || !file) {
        throw new Error(
          "Saving is available in the Verto desktop app after you choose a local folder."
        );
      }

      await writeLocalFile(folder, file, source);
      setState((current) =>
        current?.status === "ready" && current.file === file ? { ...current, source } : current
      );
      window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
    },
    [desktop, file]
  );

  const createPage = useCallback(async () => {
    const folder = loadActiveRuntimeLocalFolder();
    if (!desktop || !folder || isCreatingPage) return;

    setIsCreatingPage(true);
    setFolderError(null);
    try {
      const suffix =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().slice(0, 8)
          : String(Date.now());
      const title = "Untitled";
      const fileId = `untitled-${suffix}.mdx`;
      await writeLocalFile(
        folder,
        fileId,
        createVaultDocument({ title, body: `# ${title}\n\nStart writing…\n` })
      );
      window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
      router.push(runtimeLocalHref(fileId, title, ".mdx"));
    } catch (error: unknown) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "The file could not be written to the selected folder.";
      setFolderError(`Could not create a new page. ${detail}`);
    } finally {
      setIsCreatingPage(false);
    }
  }, [desktop, isCreatingPage, router]);

  return {
    chooseFolder,
    createPage,
    desktop,
    folderError,
    hasVault: folder !== null,
    isCreatingPage,
    isPickingFolder,
    retryDocument,
    saveDocument,
    state,
  };
}

function runtimeLocalHref(file: string, title: string, ext: string): string {
  const params = new URLSearchParams({ file, title, ext });
  return `/runtime/local?${params.toString()}`;
}
