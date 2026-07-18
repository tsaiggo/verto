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
  pending,
  onCancel,
  onConfirm,
}: {
  target: SubscriptionRemovalTarget | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = target?.cachedArticleCount ?? 0;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Remove subscription?</DialogTitle>
          <DialogDescription>
            {target
              ? `This permanently removes “${target.subscription.title}” and its ${count} cached ${count === 1 ? "article" : "articles"} from this device. This cannot be undone.`
              : "This permanently removes the feed and its cached articles from this device."}
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
              target
                ? `Remove ${target.subscription.title} permanently`
                : "Remove subscription permanently"
            }
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending ? "Removing…" : "Remove permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
