"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { requestAppNavigation } from "@/lib/app-navigation";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  readRuntimeLocalFileVersioned,
} from "@/lib/runtime-local-folder";
import {
  isLocalFileWriteConflict,
  isTauri,
  writeLocalFile,
  type LocalFileWriteConflictError,
} from "@/lib/tauri";
import { createVaultDocument } from "@/lib/vault-document";

export interface LocalVaultDocumentConflict {
  expectedRevision: string | null;
  actualRevision: string | null;
}

export type LocalVaultDocumentLoadState =
  | { status: "loading"; file: string }
  | {
      status: "ready";
      file: string;
      source: string;
      revision: string;
      conflict?: LocalVaultDocumentConflict;
    }
  | { status: "error"; file: string; message: string };

interface WorkspaceRouter {
  push(href: string): void;
  replace(href: string): void;
}

interface UseRuntimeLocalWorkspaceOptions {
  file: string;
  router: WorkspaceRouter;
}

interface WorkspaceBinding {
  folder: string | null;
  file: string;
  generation: number;
}

interface ReadyDocumentBinding {
  workspace: WorkspaceBinding;
  revision: string;
}

/** Owns local-file session state; the route component only composes the UI. */
// eslint-disable-next-line max-lines-per-function -- One hook owns the Vault/document generation so every async read and save shares one invalidation boundary.
export function useRuntimeLocalWorkspace({ file, router }: UseRuntimeLocalWorkspaceOptions) {
  const [state, setState] = useState<LocalVaultDocumentLoadState | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [vaultGeneration, setVaultGeneration] = useState(0);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const mountedRef = useRef(false);
  const latestFileRef = useRef(file);
  const workspaceBindingRef = useRef<WorkspaceBinding>({
    folder: loadActiveRuntimeLocalFolder(),
    file,
    generation: 0,
  });
  const readyDocumentRef = useRef<ReadyDocumentBinding | null>(null);
  latestFileRef.current = file;

  useEffect(() => setDesktop(isTauri()), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      readyDocumentRef.current = null;
    };
  }, []);

  useEffect(() => {
    const refreshFolder = () => {
      const nextFolder = loadActiveRuntimeLocalFolder();
      setFolder(nextFolder);
      const current = workspaceBindingRef.current;
      if (current.folder === nextFolder) return;

      workspaceBindingRef.current = {
        folder: nextFolder,
        file: latestFileRef.current,
        generation: current.generation + 1,
      };
      setVaultGeneration((generation) => generation + 1);
    };
    queueMicrotask(refreshFolder);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
    window.addEventListener("storage", refreshFolder);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
      window.removeEventListener("storage", refreshFolder);
    };
  }, []);

  const isCurrentWorkspaceBinding = useCallback(
    (binding: WorkspaceBinding): boolean =>
      mountedRef.current &&
      latestFileRef.current === binding.file &&
      loadActiveRuntimeLocalFolder() === binding.folder &&
      isLatestWorkspaceBinding(workspaceBindingRef.current, binding),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const activeFolder = loadActiveRuntimeLocalFolder();
    const binding = bindWorkspace(workspaceBindingRef.current, activeFolder, file);
    workspaceBindingRef.current = binding;
    if (!file) {
      readyDocumentRef.current = null;
      setState(null);
      return;
    }

    readyDocumentRef.current = null;
    setState({ status: "loading", file });
    readRuntimeLocalFileVersioned(file)
      .then(({ revision, source }) => {
        if (cancelled || !isCurrentWorkspaceBinding(binding)) return;
        readyDocumentRef.current = { workspace: binding, revision };
        setState((current) =>
          isLatestWorkspaceBinding(workspaceBindingRef.current, binding)
            ? { status: "ready", file, source, revision }
            : current
        );
      })
      .catch((error: unknown) => {
        if (cancelled || !isCurrentWorkspaceBinding(binding)) return;
        setState((current) =>
          isLatestWorkspaceBinding(workspaceBindingRef.current, binding)
            ? {
                status: "error",
                file,
                message: error instanceof Error ? error.message : String(error),
              }
            : current
        );
      });

    return () => {
      cancelled = true;
    };
  }, [file, isCurrentWorkspaceBinding, vaultGeneration]);

  const retryDocument = useCallback(async (): Promise<string> => {
    if (!file) throw new Error("Choose a local page before reloading it.");
    const binding = captureWorkspaceBinding(
      workspaceBindingRef.current,
      loadActiveRuntimeLocalFolder(),
      latestFileRef.current,
      file
    );
    if (!binding) throw workspaceChangedError();
    const readyDocument = readyDocumentRef.current;
    const keepCurrentDraftMounted =
      state?.status === "ready" &&
      state.file === file &&
      readyDocument !== null &&
      isLatestWorkspaceBinding(readyDocument.workspace, binding);
    setFolderError(null);
    if (!keepCurrentDraftMounted) setState({ status: "loading", file });

    try {
      const { revision, source } = await readRuntimeLocalFileVersioned(file);
      if (!isCurrentWorkspaceBinding(binding)) throw workspaceChangedError();
      readyDocumentRef.current = { workspace: binding, revision };
      setState((current) =>
        isLatestWorkspaceBinding(workspaceBindingRef.current, binding)
          ? { status: "ready", file, source, revision }
          : current
      );
      return source;
    } catch (error: unknown) {
      if (!isCurrentWorkspaceBinding(binding)) throw workspaceChangedError();
      if (!keepCurrentDraftMounted) {
        setState((current) =>
          isLatestWorkspaceBinding(workspaceBindingRef.current, binding)
            ? {
                status: "error",
                file,
                message: error instanceof Error ? error.message : String(error),
              }
            : current
        );
      }
      throw error;
    }
  }, [file, isCurrentWorkspaceBinding, state]);

  const chooseFolder = useCallback(async () => {
    if (isPickingFolder || !requestAppNavigation()) return;
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
    async ({ source, forceOverwrite = false }: { source: string; forceOverwrite?: boolean }) => {
      const activeFolder = loadActiveRuntimeLocalFolder();
      if (!desktop || !activeFolder || !file) {
        throw new Error(
          "Saving is available in the Verto desktop app after you choose a local folder."
        );
      }

      const binding = captureWorkspaceBinding(
        workspaceBindingRef.current,
        activeFolder,
        latestFileRef.current,
        file
      );
      const readyDocument = readyDocumentRef.current;
      if (
        !binding ||
        !binding.folder ||
        !readyDocument ||
        !isLatestWorkspaceBinding(readyDocument.workspace, binding)
      ) {
        throw workspaceChangedError();
      }

      try {
        const receipt = await writeLocalFile(binding.folder, binding.file, source, {
          expectedRevision: readyDocument.revision,
          force: forceOverwrite,
        });
        if (!isCurrentWorkspaceBinding(binding)) throw workspaceChangedError();
        readyDocumentRef.current = { workspace: binding, revision: receipt.revision };
        setState((current) =>
          isLatestWorkspaceBinding(workspaceBindingRef.current, binding) &&
          current?.status === "ready" &&
          current.file === binding.file
            ? {
                status: "ready",
                file: binding.file,
                source,
                revision: receipt.revision,
              }
            : current
        );
        window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
      } catch (error: unknown) {
        if (!isCurrentWorkspaceBinding(binding)) throw workspaceChangedError();
        if (isLocalFileWriteConflict(error)) {
          const conflict = conflictFromError(error);
          setState((current) =>
            isLatestWorkspaceBinding(workspaceBindingRef.current, binding) &&
            current?.status === "ready" &&
            current.file === binding.file
              ? { ...current, conflict }
              : current
          );
        }
        throw error;
      }
    },
    [desktop, file, isCurrentWorkspaceBinding]
  );

  const createPage = useCallback(async () => {
    const folder = loadActiveRuntimeLocalFolder();
    if (!desktop || !folder || isCreatingPage || !requestAppNavigation()) return;

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
        createVaultDocument({ title, body: `# ${title}\n\nStart writing…\n` }),
        { expectedRevision: null }
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

function bindWorkspace(
  current: WorkspaceBinding,
  folder: string | null,
  file: string
): WorkspaceBinding {
  if (current.folder === folder && current.file === file) return current;
  return { folder, file, generation: current.generation + 1 };
}

function captureWorkspaceBinding(
  current: WorkspaceBinding,
  activeFolder: string | null,
  latestFile: string,
  requestedFile: string
): WorkspaceBinding | null {
  return current.folder === activeFolder &&
    current.file === requestedFile &&
    latestFile === requestedFile
    ? current
    : null;
}

function isLatestWorkspaceBinding(current: WorkspaceBinding, candidate: WorkspaceBinding): boolean {
  return (
    current.folder === candidate.folder &&
    current.file === candidate.file &&
    current.generation === candidate.generation
  );
}

function workspaceChangedError(): Error {
  return new Error("The active local library or page changed before this operation finished.");
}

function conflictFromError(error: LocalFileWriteConflictError): LocalVaultDocumentConflict {
  return {
    expectedRevision: error.expectedRevision,
    actualRevision: error.actualRevision,
  };
}

function runtimeLocalHref(file: string, title: string, ext: string): string {
  const params = new URLSearchParams({ file, title, ext });
  return `/runtime/local?${params.toString()}`;
}
