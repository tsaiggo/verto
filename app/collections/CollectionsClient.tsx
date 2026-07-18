"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { loadCollections, subscribeCollections, type Collection } from "@/lib/collections";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { Button } from "@/components/ui/button";
import {
  ContentEmptyState,
  ContentPanel,
  ContentRow,
  ContentSection,
  ContentStatus,
} from "@/components/ui/content-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollectionDeleteDialog, persistDeletedCollection } from "./CollectionDeleteDialog";
import { CollectionDetail } from "./CollectionDetail";
import {
  CreateCollectionDialog,
  RenameCollectionDialog,
  persistCreatedCollection,
  persistRenamedCollection,
} from "./CollectionDialogs";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
import styles from "./collections.module.css";

export interface FolderGroup {
  title: string;
  href: string;
  total: number;
}

export interface CollectionDocument {
  href: string;
  title: string;
}

interface Props {
  folderGroups: FolderGroup[];
  staticDocuments: CollectionDocument[];
}

const EMPTY_COLLECTIONS: Collection[] = [];

interface UserCollectionsProps {
  collections: Collection[];
  onCreate: () => void;
  onRename: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}

function UserCollections({ collections, onCreate, onRename, onDelete }: UserCollectionsProps) {
  if (collections.length === 0) {
    return (
      <ContentPanel variant="plain" aria-labelledby="collections-empty-title">
        <ContentEmptyState
          compact
          icon={<FolderPlus aria-hidden />}
          title={<span id="collections-empty-title">Make your first collection</span>}
          description="Keep articles and documents that belong together in one deliberate place."
          action={
            <Button type="button" size="sm" onClick={onCreate}>
              <Plus aria-hidden /> Create a collection
            </Button>
          }
        />
      </ContentPanel>
    );
  }

  return (
    <ContentPanel variant="plain">
      <ul className={styles.rows} aria-label="Your collections">
        {collections.map((collection) => {
          const total = collection.docHrefs.length;
          const itemLabel = `${total} ${total === 1 ? "item" : "items"}`;
          return (
            <li key={collection.id} className={styles.rowItem}>
              <ContentRow
                className={styles.row}
                leading={<FolderOpen aria-hidden />}
                title={
                  <Link
                    href={{ pathname: "/collections", query: { collection: collection.id } }}
                    className={styles.titleLink}
                    aria-label={`${collection.name} ${itemLabel}`}
                  >
                    {collection.name}
                  </Link>
                }
                description={`${itemLabel} saved`}
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.rowAction}
                        aria-label={`Actions for ${collection.name}`}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRename(collection)}>
                        <Pencil aria-hidden /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onDelete(collection)}
                        className={styles.dangerAction}
                      >
                        <Trash2 aria-hidden /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </li>
          );
        })}
      </ul>
    </ContentPanel>
  );
}

function CollectionRuntimeStatus({
  runtimeLocal,
  runtimeWorkspace,
}: {
  runtimeLocal: RuntimeLocalIndexState;
  runtimeWorkspace: HomeWorkspaceData | null;
}) {
  if (runtimeLocal.status === "loading") {
    return (
      <ContentStatus
        status="loading"
        title="Loading local library"
        description="Folder collections will appear after Verto finishes indexing."
      />
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <ContentStatus
        status="error"
        title="Could not read the selected local library"
        description="Reconnect the source before using folder collections."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">Manage sources</Link>
          </Button>
        }
      />
    );
  }

  if (!runtimeWorkspace) return null;
  const total = runtimeWorkspace.readableHrefs.length;
  return (
    <ContentStatus
      title="Local library active"
      description={`${total} readable ${total === 1 ? "file" : "files"}`}
    />
  );
}

function FolderCollections({ groups }: { groups: FolderGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <ContentSection
      title="By folder"
      description="Read-only groups from the active workspace structure."
    >
      <ContentPanel variant="plain">
        <ul className={styles.rows} aria-label="Folder collections">
          {groups.map((group) => {
            const documentLabel = `${group.total} ${group.total === 1 ? "document" : "documents"}`;
            return (
              <li key={group.href} className={styles.rowItem}>
                <ContentRow
                  className={styles.row}
                  leading={<BookOpen aria-hidden />}
                  title={
                    <Link
                      href={group.href}
                      className={styles.titleLink}
                      aria-label={`${group.title} ${documentLabel}`}
                    >
                      {group.title}
                    </Link>
                  }
                  description={documentLabel}
                  metadata={<span>Workspace</span>}
                  actions={<ArrowUpRight aria-hidden />}
                />
              </li>
            );
          })}
        </ul>
      </ContentPanel>
    </ContentSection>
  );
}

export default function CollectionsClient({ folderGroups, staticDocuments }: Props) {
  const collections = useSyncExternalStore(
    subscribeCollections,
    loadCollections,
    () => EMPTY_COLLECTIONS
  );
  const runtimeLocal = useRuntimeLocalIndex();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCollectionId = searchParams?.get("collection") ?? "";
  const selectedCollection = selectedCollectionId
    ? (collections.find((collection) => collection.id === selectedCollectionId) ?? null)
    : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const createPendingRef = useRef(false);
  const renamePendingRef = useRef(false);
  const deletePendingRef = useRef(false);
  const runtimeWorkspace = useMemo(
    () =>
      runtimeLocal.status === "ready"
        ? runtimeHomeWorkspace(runtimeLocal.index.documents.map((document) => document.node))
        : null,
    [runtimeLocal]
  );
  const activeFolderGroups =
    runtimeWorkspace?.groups ?? (runtimeLocal.status === "idle" ? folderGroups : []);
  const documentTitles = useMemo(() => {
    const titles = new Map(staticDocuments.map((document) => [document.href, document.title]));
    for (const document of runtimeLocal.index?.documents ?? []) {
      titles.set(document.node.href, document.node.title);
    }
    return titles;
  }, [runtimeLocal.index, staticDocuments]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed || createPendingRef.current) return;
    createPendingRef.current = true;
    setCreating(true);
    try {
      if (await persistCreatedCollection(trimmed)) {
        setCreateName("");
        setCreateOpen(false);
      }
    } finally {
      createPendingRef.current = false;
      setCreating(false);
    }
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    const trimmed = renameName.trim();
    if (!renameTarget || !trimmed || renamePendingRef.current) return;
    const targetId = renameTarget.id;
    renamePendingRef.current = true;
    setRenaming(true);
    try {
      if (await persistRenamedCollection(targetId, trimmed)) {
        setRenameTarget(null);
        setRenameName("");
      }
    } finally {
      renamePendingRef.current = false;
      setRenaming(false);
    }
  }

  function openRename(collection: Collection) {
    setRenameTarget(collection);
    setRenameName(collection.name);
  }

  async function handleDelete() {
    if (!deleteTarget || deletePendingRef.current) return;
    const targetId = deleteTarget.id;
    deletePendingRef.current = true;
    setDeleting(true);
    try {
      if (await persistDeletedCollection(targetId)) {
        setDeleteTarget(null);
        router.replace("/collections");
      }
    } finally {
      deletePendingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <>
      <ContentPage width="standard">
        <ContentHeader
          icon={<FolderClosed />}
          title="Collections"
          description="Organize your knowledge into focused reading sets."
          actions={
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> New collection
            </Button>
          }
        />

        <CollectionRuntimeStatus runtimeLocal={runtimeLocal} runtimeWorkspace={runtimeWorkspace} />

        <CollectionDetail
          collectionId={selectedCollectionId}
          collection={selectedCollection}
          documentTitles={documentTitles}
        />

        <ContentSection
          title="Your collections"
          description={`${collections.length} ${collections.length === 1 ? "collection" : "collections"}`}
        >
          <UserCollections
            collections={collections}
            onCreate={() => setCreateOpen(true)}
            onRename={openRename}
            onDelete={setDeleteTarget}
          />
        </ContentSection>

        <FolderCollections groups={activeFolderGroups} />
      </ContentPage>

      <CreateCollectionDialog
        open={createOpen}
        name={createName}
        onNameChange={setCreateName}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        pending={creating}
      />
      <RenameCollectionDialog
        target={renameTarget}
        name={renameName}
        onNameChange={setRenameName}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRename}
        pending={renaming}
      />
      <CollectionDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        pending={deleting}
      />
    </>
  );
}
