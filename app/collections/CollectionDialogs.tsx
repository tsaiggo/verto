"use client";

import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCollection,
  loadCollections,
  renameCollection,
  type Collection,
} from "@/lib/collections";
import styles from "./collections.module.css";

export async function persistCreatedCollection(name: string): Promise<boolean> {
  const existingIds = new Set(loadCollections().map((collection) => collection.id));
  try {
    await createCollection(name);
    return true;
  } catch {
    const appliedLocally = loadCollections().some(
      (collection) => !existingIds.has(collection.id) && collection.name === name
    );
    if (!appliedLocally) {
      toast.error("Couldn't create collection", {
        description:
          "Your collection name is still here. Check that local storage is available, then retry.",
      });
    }
    return appliedLocally;
  }
}

export async function persistRenamedCollection(id: string, name: string): Promise<boolean> {
  try {
    await renameCollection(id, name);
    return true;
  } catch {
    const appliedLocally = loadCollections().some(
      (collection) => collection.id === id && collection.name === name
    );
    if (!appliedLocally) {
      toast.error("Couldn't rename collection", {
        description:
          "The original name is still saved. Your new name is still here; check local storage and retry.",
      });
    }
    return appliedLocally;
  }
}

interface CreateDialogProps {
  open: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
}

export function CreateCollectionDialog({
  open,
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
  pending,
}: CreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
        </DialogHeader>
        <form className={styles.dialogForm} onSubmit={onSubmit} aria-busy={pending}>
          <div className={styles.field}>
            <label htmlFor="col-create-name">Name</label>
            <input
              id="col-create-name"
              className={styles.input}
              placeholder="My reading list"
              value={name}
              disabled={pending}
              onChange={(event) => onNameChange(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? "Creating..." : "Create"}
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
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
}

export function RenameCollectionDialog({
  target,
  name,
  onNameChange,
  onClose,
  onSubmit,
  pending,
}: RenameDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Rename collection</DialogTitle>
        </DialogHeader>
        <form className={styles.dialogForm} onSubmit={onSubmit} aria-busy={pending}>
          <div className={styles.field}>
            <label htmlFor="col-rename-name">New name</label>
            <input
              id="col-rename-name"
              className={styles.input}
              value={name}
              disabled={pending}
              onChange={(event) => onNameChange(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
