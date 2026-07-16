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
import type { Subscription } from "@/lib/subscriptions";

export interface SubscriptionRemovalTarget {
  subscription: Subscription;
  cachedArticleCount: number;
}

export default function SubscriptionDeleteDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: SubscriptionRemovalTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = target?.cachedArticleCount ?? 0;

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove subscription?</DialogTitle>
          <DialogDescription>
            {target
              ? `This permanently removes “${target.subscription.title}” and its ${count} cached ${count === 1 ? "article" : "articles"} from this device. This cannot be undone.`
              : "This permanently removes the feed and its cached articles from this device."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
            Remove permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
