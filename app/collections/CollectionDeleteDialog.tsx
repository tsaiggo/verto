"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Collection } from "@/lib/collections";

export function CollectionDeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Collection | null;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete collection?</DialogTitle>
          <DialogDescription>
            {target
              ? `“${target.name}” and its ${target.docHrefs.length} ${target.docHrefs.length === 1 ? "item" : "items"} will be removed. This does not delete the original documents.`
              : "This collection will be removed."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
            Delete collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
