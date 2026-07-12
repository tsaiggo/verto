"use client";

import React, { useMemo, useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  FolderPlus,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  loadCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  subscribeCollections,
  type Collection,
} from "@/lib/collections";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";
import { CollectionDetail } from "./CollectionDetail";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";

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

const INPUT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// ── Dialog sub-components ────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  name: string;
  onNameChange: (v: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function CreateDialog({ open, name, onNameChange, onOpenChange, onSubmit }: CreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="col-create-name">
              Name
            </label>
            <input
              id="col-create-name"
              className={INPUT_CLASS}
              placeholder="My reading list"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RenameDialogProps {
  target: Collection | null;
  name: string;
  onNameChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function RenameDialog({ target, name, onNameChange, onClose, onSubmit }: RenameDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="col-rename-name">
              New name
            </label>
            <input
              id="col-rename-name"
              className={INPUT_CLASS}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UserCollectionsProps {
  collections: Collection[];
  onCreate: () => void;
  onRename: (collection: Collection) => void;
}

function UserCollections({ collections, onCreate, onRename }: UserCollectionsProps) {
  if (collections.length === 0) {
    return (
      <section className="v-card col-empty" aria-labelledby="collections-empty-title">
        <div className="col-empty-intro">
          <span className="col-empty-mark" aria-hidden>
            <FolderPlus />
          </span>
          <div>
            <p className="col-empty-kicker">A calmer way to organize</p>
            <h2 id="collections-empty-title">Make your first collection</h2>
            <p className="col-empty-copy">
              Keep the articles and documents that belong together in one deliberate place. You can
              add items from any reader when they matter.
            </p>
          </div>
        </div>
        <ol className="col-empty-steps">
          <li>
            <span>1</span>
            <p>Name a collection for a project, topic, or reading list.</p>
          </li>
          <li>
            <span>2</span>
            <p>
              <BookOpen aria-hidden /> Save reading items from their reader as you go.
            </p>
          </li>
        </ol>
        <button type="button" className="v-btn v-btn--primary col-empty-action" onClick={onCreate}>
          <Plus aria-hidden /> Create a collection
        </button>
      </section>
    );
  }

  return (
    <div className="col-grid">
      {collections.map((collection) => (
        <div key={collection.id} className="v-card col-card col-card--user">
          <Link
            href={{ pathname: "/collections", query: { collection: collection.id } }}
            className="col-card-link"
          >
            <span className="col-card-name">{collection.name}</span>
            <span className="col-card-meta">
              {collection.docHrefs.length} {collection.docHrefs.length === 1 ? "item" : "items"}
            </span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="v-btn v-btn--sm col-card-menu"
                aria-label={`Actions for ${collection.name}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(collection)}>
                <Pencil aria-hidden /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteCollection(collection.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
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
      <div className="col-runtime-status is-loading" role="status">
        <Loader2 aria-hidden /> Loading the selected local library…
      </div>
    );
  }
  if (runtimeLocal.status === "error") {
    return (
      <div className="col-runtime-status is-error" role="status">
        <TriangleAlert aria-hidden />
        <span>Could not read the selected local library.</span>
        <Link href="/integrations">Manage sources</Link>
      </div>
    );
  }
  if (!runtimeWorkspace) return null;

  const total = runtimeWorkspace.readableHrefs.length;
  return (
    <div className="col-runtime-status is-ready" role="status">
      <FolderOpen aria-hidden />
      <span>
        Local library active · {total} readable{total === 1 ? " file" : " files"}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CollectionsClient({ folderGroups, staticDocuments }: Props) {
  const collections = useSyncExternalStore(
    subscribeCollections,
    loadCollections,
    () => EMPTY_COLLECTIONS
  );
  const runtimeLocal = useRuntimeLocalIndex();
  const searchParams = useSearchParams();
  const selectedCollectionId = searchParams?.get("collection") ?? "";
  const selectedCollection = selectedCollectionId
    ? (collections.find((c) => c.id === selectedCollectionId) ?? null)
    : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameName, setRenameName] = useState("");
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

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed) return;
    createCollection(trimmed);
    setCreateName("");
    setCreateOpen(false);
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    renameCollection(renameTarget.id, renameName.trim());
    setRenameTarget(null);
    setRenameName("");
  }

  function openRename(c: Collection) {
    setRenameTarget(c);
    setRenameName(c.name);
  }

  return (
    <div className="collections-page">
      <PageHeader
        title="Collections"
        subtitle="Organize your knowledge into collections."
        tools={
          <button type="button" className="v-btn v-btn--sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden /> New Collection
          </button>
        }
      />

      <div className="v-page">
        <CollectionRuntimeStatus runtimeLocal={runtimeLocal} runtimeWorkspace={runtimeWorkspace} />
        <CollectionDetail
          collectionId={selectedCollectionId}
          collection={selectedCollection}
          documentTitles={documentTitles}
        />
        {/* User-defined collections */}
        <section>
          <UserCollections
            collections={collections}
            onCreate={() => setCreateOpen(true)}
            onRename={openRename}
          />
        </section>

        {/* Folder-derived groups — read-only */}
        {activeFolderGroups.length > 0 && (
          <section className="col-section">
            <h2 className="col-section-title">By folder</h2>
            <div className="col-grid">
              {activeFolderGroups.map((g) => (
                <Link key={g.href} href={g.href} className="v-card col-card">
                  <span className="col-card-name">{g.title}</span>
                  <span className="col-card-meta">
                    {g.total} {g.total === 1 ? "document" : "documents"}
                  </span>
                  <span className="col-card-updated">In your workspace</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        name={createName}
        onNameChange={setCreateName}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
      <RenameDialog
        target={renameTarget}
        name={renameName}
        onNameChange={setRenameName}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRename}
      />
    </div>
  );
}
