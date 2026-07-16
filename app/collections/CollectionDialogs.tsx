"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Collection } from "@/lib/collections";
import styles from "./collections.module.css";

interface CreateDialogProps {
  open: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}

export function CreateCollectionDialog({
  open,
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
}: CreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
        </DialogHeader>
        <form className={styles.dialogForm} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label htmlFor="col-create-name">Name</label>
            <input
              id="col-create-name"
              className={styles.input}
              placeholder="My reading list"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
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
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function RenameCollectionDialog({
  target,
  name,
  onNameChange,
  onClose,
  onSubmit,
}: RenameDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename collection</DialogTitle>
        </DialogHeader>
        <form className={styles.dialogForm} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label htmlFor="col-rename-name">New name</label>
            <input
              id="col-rename-name"
              className={styles.input}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
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
