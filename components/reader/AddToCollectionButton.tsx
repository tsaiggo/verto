"use client";

import { Check, FolderPlus, Plus } from "lucide-react";
import {
  addDocToCollection,
  createCollection,
  loadCollections,
  removeDocFromCollection,
  subscribeCollections,
  type Collection,
} from "@/lib/collections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const EMPTY_COLLECTIONS: Collection[] = [];

/**
 * Adds the current reading item to one or more user collections from the reader.
 *
 * Collections are intentionally managed from their own page; this compact
 * control makes membership a one-click action at the point where a reader is
 * deciding what to keep.
 */
export function AddToCollectionButton({
  href,
  title,
  className,
}: {
  href: string;
  title: string;
  className?: string;
}) {
  const collections = useSyncExternalStore(
    subscribeCollections,
    loadCollections,
    () => EMPTY_COLLECTIONS
  );
  const membershipCount = collections.filter((collection) =>
    collection.docHrefs.includes(href)
  ).length;
  const [createOpen, setCreateOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const label =
    membershipCount === 0
      ? "Add to collection"
      : `In ${membershipCount} ${membershipCount === 1 ? "collection" : "collections"}`;

  function createAndAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name) return;

    const created = createCollection(name)[0];
    if (created) addDocToCollection(created.id, href, title);
    setCollectionName("");
    setCreateOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn("doc-copybtn", className)} aria-label={label}>
            <FolderPlus size={14} aria-hidden />
            {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label="Collections">
          {collections.length === 0 ? (
            <>
              <DropdownMenuLabel>No collections yet</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus aria-hidden /> Create and add to collection
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel>Add this item to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {collections.map((collection) => {
                const isIncluded = collection.docHrefs.includes(href);
                const actionLabel = `${isIncluded ? "Remove from" : "Add to"} ${collection.name}`;

                return (
                  <DropdownMenuItem
                    key={collection.id}
                    aria-label={actionLabel}
                    onSelect={() => {
                      if (isIncluded) removeDocFromCollection(collection.id, href);
                      else addDocToCollection(collection.id, href, title);
                    }}
                  >
                    <span className="doc-collection-check" aria-hidden>
                      {isIncluded && <Check />}
                    </span>
                    {collection.name}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus aria-hidden /> Create and add to collection
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCollectionName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create collection and add this document</DialogTitle>
            <DialogDescription>
              {title} will be added as soon as the collection is created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAndAdd}>
            <label className="set-field" htmlFor="collection-name">
              <span className="set-field-label">Collection name</span>
              <input
                id="collection-name"
                className="set-input"
                placeholder="Project notes"
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                autoFocus
              />
            </label>
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!collectionName.trim()}>
                Create and add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
