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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  mobileSheet = false,
}: {
  href: string;
  title: string;
  className?: string;
  /** Uses a bottom-sheet selector on narrow reader layouts. */
  mobileSheet?: boolean;
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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const label =
    membershipCount === 0
      ? "Add to collection"
      : `In ${membershipCount} ${membershipCount === 1 ? "collection" : "collections"}`;

  async function createAndAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name) return;

    try {
      // A failed portable mirror leaves the optimistic collection in the
      // recoverable cache. Reuse it on retry instead of creating a duplicate.
      const created =
        collections.find((collection) => collection.name === name) ??
        (await createCollection(name)).find((collection) => collection.name === name);
      if (created) await addDocToCollection(created.id, href, title);
      setCollectionName("");
      setCreateOpen(false);
    } catch {
      // Keep the dialog open; the global notifier reports the storage error.
    }
  }

  function openCreateDialog() {
    setMobileSheetOpen(false);
    setCreateOpen(true);
  }

  async function toggleCollection(collection: Collection) {
    try {
      if (collection.docHrefs.includes(href)) {
        await removeDocFromCollection(collection.id, href);
      } else {
        await addDocToCollection(collection.id, href, title);
      }
    } catch {
      // The collection snapshot remains recoverable and the notifier explains
      // why its portable mirror did not complete.
    }
  }

  return (
    <>
      <CollectionDropdown
        label={label}
        className={className}
        mobileSheet={mobileSheet}
        href={href}
        collections={collections}
        onToggleCollection={toggleCollection}
        onCreateCollection={openCreateDialog}
      />

      {mobileSheet && (
        <>
          <button
            type="button"
            className={cn("doc-copybtn", "doc-collection-sheet-trigger", className)}
            aria-label={label}
            aria-expanded={mobileSheetOpen}
            aria-haspopup="dialog"
            onClick={() => setMobileSheetOpen(true)}
          >
            <FolderPlus size={14} aria-hidden />
            {label}
          </button>

          <MobileCollectionSheet
            open={mobileSheetOpen}
            onOpenChange={setMobileSheetOpen}
            title={title}
            href={href}
            collections={collections}
            onToggleCollection={toggleCollection}
            onCreateCollection={openCreateDialog}
          />
        </>
      )}

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

function CollectionDropdown({
  label,
  className,
  mobileSheet,
  href,
  collections,
  onToggleCollection,
  onCreateCollection,
}: {
  label: string;
  className?: string;
  mobileSheet: boolean;
  href: string;
  collections: Collection[];
  onToggleCollection: (collection: Collection) => void;
  onCreateCollection: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn("doc-copybtn", mobileSheet && "doc-collection-menu-trigger", className)}
          aria-label={label}
        >
          <FolderPlus size={14} aria-hidden />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Collections">
        {collections.length === 0 ? (
          <>
            <DropdownMenuLabel>No collections yet</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreateCollection}>
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
                  onSelect={() => onToggleCollection(collection)}
                >
                  <span className="doc-collection-check" aria-hidden>
                    {isIncluded && <Check />}
                  </span>
                  {collection.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreateCollection}>
              <Plus aria-hidden /> Create and add to collection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileCollectionSheet({
  open,
  onOpenChange,
  title,
  href,
  collections,
  onToggleCollection,
  onCreateCollection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  href: string;
  collections: Collection[];
  onToggleCollection: (collection: Collection) => void;
  onCreateCollection: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-label="Add this document to a collection"
        className="doc-collection-sheet"
      >
        <SheetHeader className="doc-collection-sheet-header">
          <SheetTitle>Add to collection</SheetTitle>
          <SheetDescription>
            Keep {title} with the notes and documents you want to return to.
          </SheetDescription>
        </SheetHeader>

        <div className="doc-collection-sheet-options">
          {collections.length === 0 ? (
            <p className="doc-collection-sheet-empty">
              Create your first collection to save this document.
            </p>
          ) : (
            collections.map((collection) => {
              const isIncluded = collection.docHrefs.includes(href);
              return (
                <button
                  key={collection.id}
                  type="button"
                  className={cn("doc-collection-sheet-option", isIncluded && "is-selected")}
                  aria-pressed={isIncluded}
                  onClick={() => onToggleCollection(collection)}
                >
                  <span>{collection.name}</span>
                  <span className="doc-collection-sheet-check" aria-hidden>
                    {isIncluded && <Check />}
                  </span>
                </button>
              );
            })
          )}

          <Button
            type="button"
            variant="outline"
            className="doc-collection-sheet-create"
            onClick={onCreateCollection}
          >
            <Plus aria-hidden /> Create and add to collection
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
