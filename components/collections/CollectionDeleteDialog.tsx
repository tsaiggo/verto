"use client";

// Destructive collection changes stay explicit and source files are never deleted.

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { Collection } from "@/lib/collections";
import styles from "@/components/collections/Collections.module.css";

export function CollectionDeleteDialog({
  target,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  target: Collection | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>Delete collection?</DialogTitle>
          <DialogDescription>
            {target
              ? `“${target.name}” and its ${target.docHrefs.length === 1 ? "item" : "items"} will be removed. This does not delete the original documents.`
              : "This collection will be removed."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Loader2 className={styles.spinner} aria-hidden /> Deleting
              </>
            ) : (
              "Delete collection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
