"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  createCollection,
  deleteCollection,
  loadCollections,
  renameCollection,
  subscribeCollections,
  type Collection,
} from "@/lib/collections";
import { runtimeHomeWorkspace } from "@/components/home/home-data";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
import { CollectionMutationDialogs } from "@/components/collections/CollectionMutationDialogs";
import { CollectionsWorkspace } from "@/components/collections/CollectionsWorkspace";
import type { CollectionDocument, FolderGroup } from "@/components/collections/collection-types";

interface Props {
  folderGroups: FolderGroup[];
  staticDocuments: CollectionDocument[];
}

const EMPTY_COLLECTIONS: Collection[] = [];

function collectionDocumentTitles(
  staticDocuments: CollectionDocument[],
  runtime: RuntimeLocalIndexState
): Map<string, string> {
  const titles = new Map(staticDocuments.map((document) => [document.href, document.title]));
  for (const document of runtime.index?.documents ?? []) {
    titles.set(document.node.href, document.node.title);
  }
  return titles;
}

function findSelectedCollection(
  collections: Collection[],
  collectionId: string
): Collection | null {
  if (!collectionId) return null;
  return collections.find((collection) => collection.id === collectionId) ?? null;
}

function collectionFolderGroups(
  runtime: RuntimeLocalIndexState,
  workspace: ReturnType<typeof runtimeHomeWorkspace> | null,
  bundled: FolderGroup[]
): FolderGroup[] {
  return workspace?.groups ?? (runtime.status === "idle" ? bundled : []);
}

export default function CollectionsClient({ folderGroups, staticDocuments }: Props) {
  const collections = useSyncExternalStore(
    subscribeCollections,
    loadCollections,
    () => EMPTY_COLLECTIONS
  );
  const runtimeLocal = useRuntimeLocalIndex();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedCollectionId = searchParams?.get("collection") ?? "";
  const selectedCollection = findSelectedCollection(collections, selectedCollectionId);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runtimeWorkspace = useMemo(
    () =>
      runtimeLocal.status === "ready"
        ? runtimeHomeWorkspace(runtimeLocal.index.documents.map((document) => document.node))
        : null,
    [runtimeLocal]
  );
  const activeFolderGroups = collectionFolderGroups(runtimeLocal, runtimeWorkspace, folderGroups);
  const documentTitles = useMemo(
    () => collectionDocumentTitles(staticDocuments, runtimeLocal),
    [runtimeLocal, staticDocuments]
  );

  function openCreate() {
    setCreateName("");
    setCreateError(null);
    setCreateOpen(true);
  }

  function openRename(collection: Collection) {
    setRenameTarget(collection);
    setRenameName(collection.name);
    setRenameError(null);
  }

  function openDelete(collection: Collection) {
    setDeleteTarget(collection);
    setDeleteError(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = createName.trim();
    if (!name || createPending) return;

    setCreatePending(true);
    setCreateError(null);
    try {
      await createCollection(name);
      setCreateName("");
      setCreateOpen(false);
    } catch {
      setCreateError(
        "Verto could not save this collection. Check the local library and try again."
      );
    } finally {
      setCreatePending(false);
    }
  }

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    const name = renameName.trim();
    if (!renameTarget || !name || renamePending) return;

    setRenamePending(true);
    setRenameError(null);
    try {
      await renameCollection(renameTarget.id, name);
      setRenameTarget(null);
      setRenameName("");
    } catch {
      setRenameError("Verto could not rename this collection. Try again.");
    } finally {
      setRenamePending(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deletePending) return;

    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteCollection(deleteTarget.id);
      setDeleteTarget(null);
      router.replace("/collections");
    } catch {
      setDeleteError("Verto could not delete this collection. Try again.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <CollectionsWorkspace
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        selectedCollection={selectedCollection}
        documentTitles={documentTitles}
        runtimeLocal={runtimeLocal}
        runtimeWorkspace={runtimeWorkspace}
        bundledDocuments={staticDocuments.length}
        folderGroups={activeFolderGroups}
        onCreate={openCreate}
        onRename={openRename}
        onDelete={openDelete}
      />
      <CollectionMutationDialogs
        create={{
          open: createOpen,
          name: createName,
          pending: createPending,
          error: createError,
          onNameChange: setCreateName,
          onOpenChange: (open) => {
            if (!createPending) setCreateOpen(open);
            if (!open) setCreateError(null);
          },
          onSubmit: handleCreate,
        }}
        rename={{
          target: renameTarget,
          name: renameName,
          pending: renamePending,
          error: renameError,
          onNameChange: setRenameName,
          onOpenChange: (open) => {
            if (!open && !renamePending) setRenameTarget(null);
            if (!open) setRenameError(null);
          },
          onSubmit: handleRename,
        }}
        remove={{
          target: deleteTarget,
          pending: deletePending,
          error: deleteError,
          onClose: () => {
            if (!deletePending) setDeleteTarget(null);
            setDeleteError(null);
          },
          onConfirm: handleDelete,
        }}
      />
    </>
  );
}
