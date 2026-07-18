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

export interface InboxDeletionTarget {
  id: string;
  title: string;
}

export default function InboxDeleteDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: InboxDeletionTarget | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Delete article permanently?</DialogTitle>
          <DialogDescription>
            {target
              ? `This permanently removes "${target.title}" from Inbox on this device. This cannot be undone.`
              : "This permanently removes the article from Inbox on this device."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            aria-label={
              target ? `Delete ${target.title} permanently` : "Delete article permanently"
            }
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
