"use client";

import React, { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

export interface FolderGroup {
  title: string;
  href: string;
  total: number;
}

interface Props {
  folderGroups: FolderGroup[];
}

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

// ── Main component ───────────────────────────────────────────────────────────

export default function CollectionsClient({ folderGroups }: Props) {
  const collections = useSyncExternalStore(subscribeCollections, loadCollections, () => []);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameName, setRenameName] = useState("");

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
        {/* User-defined collections */}
        <section>
          {collections.length === 0 ? (
            <p className="py-6 text-sm text-text-muted">
              No collections yet. Click <strong>New Collection</strong> to get started.
            </p>
          ) : (
            <div className="col-grid">
              {collections.map((c) => (
                <div key={c.id} className="v-card col-card col-card--user">
                  <Link href={`/collections/${c.id}`} className="col-card-link">
                    <span className="col-card-name">{c.name}</span>
                    <span className="col-card-meta">
                      {c.docHrefs.length} {c.docHrefs.length === 1 ? "document" : "documents"}
                    </span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="v-btn v-btn--sm col-card-menu"
                        aria-label={`Actions for ${c.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRename(c)}>
                        <Pencil aria-hidden /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteCollection(c.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 aria-hidden /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Folder-derived groups — read-only */}
        {folderGroups.length > 0 && (
          <section className="col-section">
            <h2 className="col-section-title">By folder</h2>
            <div className="col-grid">
              {folderGroups.map((g) => (
                <Link key={g.href} href={g.href} className="v-card col-card">
                  <span className="col-card-name">{g.title}</span>
                  <span className="col-card-meta">{g.total} documents</span>
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
