"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCollection, loadCollections, type Collection } from "@/lib/collections";

export async function persistDeletedCollection(id: string): Promise<boolean> {
  try {
    await deleteCollection(id);
    return true;
  } catch {
    const appliedLocally = !loadCollections().some((collection) => collection.id === id);
    if (!appliedLocally) {
      toast.error("Couldn't delete collection", {
        description:
          "The collection is still here. Check that local storage is available, then retry.",
      });
    }
    return appliedLocally;
  }
}

export function CollectionDeleteDialog({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: Collection | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
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
          <DialogTitle>Delete collection?</DialogTitle>
          <DialogDescription>
            {target
              ? `“${target.name}” and its ${target.docHrefs.length} ${target.docHrefs.length === 1 ? "item" : "items"} will be removed. This does not delete the original documents.`
              : "This collection will be removed."}
          </DialogDescription>
        </DialogHeader>
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
            {pending ? "Deleting..." : "Delete collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
