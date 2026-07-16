"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
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
import {
  createCollection,
  deleteCollection,
  loadCollections,
  renameCollection,
  subscribeCollections,
  type Collection,
} from "@/lib/collections";
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
import { CollectionDeleteDialog } from "./CollectionDeleteDialog";
import { CollectionDetail } from "./CollectionDetail";
import { CreateCollectionDialog, RenameCollectionDialog } from "./CollectionDialogs";
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
      <ContentPanel variant="outlined" aria-labelledby="collections-empty-title">
        <ContentEmptyState
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
    if (!trimmed) return;
    try {
      await createCollection(trimmed);
      setCreateName("");
      setCreateOpen(false);
    } catch {
      // StateStoreErrorNotifier reports durable-write failures.
    }
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    try {
      await renameCollection(renameTarget.id, renameName.trim());
      setRenameTarget(null);
      setRenameName("");
    } catch {
      // Keep the dialog open so the user can retry.
    }
  }

  function openRename(collection: Collection) {
    setRenameTarget(collection);
    setRenameName(collection.name);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCollection(deleteTarget.id);
      setDeleteTarget(null);
      router.replace("/collections");
    } catch {
      // Keep the confirmation open so the user can retry.
    }
  }

  return (
    <>
      <ContentPage width="wide">
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
      />
      <RenameCollectionDialog
        target={renameTarget}
        name={renameName}
        onNameChange={setRenameName}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRename}
      />
      <CollectionDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
