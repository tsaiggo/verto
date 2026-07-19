"use client";

import { Check, FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const EMPTY_COLLECTIONS: Collection[] = [];
const getEmptyCollections = () => EMPTY_COLLECTIONS;

function collectionButtonLabel(collections: Collection[], href: string) {
  const count = collections.filter((collection) => collection.docHrefs.includes(href)).length;
  return count === 0
    ? "Add to collection"
    : `In ${count} ${count === 1 ? "collection" : "collections"}`;
}

async function createCollectionAndAddDocument(name: string, href: string, title: string) {
  let created = loadCollections().find((collection) => collection.name === name);
  if (!created) {
    try {
      await createCollection(name);
    } catch {
      // Re-read below: a desktop mirror failure may still be applied locally.
    }
    created = loadCollections().find((collection) => collection.name === name);
  }

  if (!created) {
    toast.error("Couldn't create collection", {
      description: "The collection wasn't created. Your name is still here; try again.",
    });
    return false;
  }

  const collectionId = created.id;
  try {
    await addDocToCollection(collectionId, href, title);
  } catch {
    const locallyAdded = loadCollections().some(
      (collection) => collection.id === collectionId && collection.docHrefs.includes(href)
    );
    if (!locallyAdded) {
      toast.error("Couldn't add to collection", {
        description: "The document wasn't added. Your collection name is still here; try again.",
      });
      return false;
    }
  }
  return true;
}

async function toggleCollectionMembership(collection: Collection, href: string, title: string) {
  const shouldInclude = !collection.docHrefs.includes(href);
  try {
    await (shouldInclude
      ? addDocToCollection(collection.id, href, title)
      : removeDocFromCollection(collection.id, href));
  } catch {
    const stored = loadCollections().find((item) => item.id === collection.id);
    const appliedLocally = (stored?.docHrefs.includes(href) ?? false) === shouldInclude;
    if (!appliedLocally) {
      toast.error(
        shouldInclude ? "Couldn't add to collection" : "Couldn't remove from collection",
        {
          description: shouldInclude
            ? `The document is not in ${collection.name}. Check local storage, then retry.`
            : `The document is still in ${collection.name}. Check local storage, then retry.`,
        }
      );
    }
  }
}

interface AddToCollectionButtonProps {
  href: string;
  title: string;
  className?: string;
  /** Uses a bottom-sheet selector on narrow reader layouts. */
  mobileSheet?: boolean;
}

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
}: AddToCollectionButtonProps) {
  const collections = useSyncExternalStore(
    subscribeCollections,
    loadCollections,
    getEmptyCollections
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingCollectionIds, setPendingCollectionIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const creatingRef = useRef(false);
  const pendingCollectionIdsRef = useRef(new Set<string>());
  const label = collectionButtonLabel(collections, href);

  async function createAndAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);

    try {
      if (await createCollectionAndAddDocument(name, href, title)) {
        setCollectionName("");
        setCreateOpen(false);
      }
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function openCreateDialog() {
    setMobileSheetOpen(false);
    setCreateOpen(true);
  }

  async function toggleCollection(collection: Collection) {
    if (pendingCollectionIdsRef.current.has(collection.id)) return;
    pendingCollectionIdsRef.current.add(collection.id);
    setPendingCollectionIds(new Set(pendingCollectionIdsRef.current));

    try {
      await toggleCollectionMembership(collection, href, title);
    } finally {
      pendingCollectionIdsRef.current.delete(collection.id);
      setPendingCollectionIds(new Set(pendingCollectionIdsRef.current));
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
        pendingCollectionIds={pendingCollectionIds}
        disabled={creating}
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
            disabled={creating}
            onClick={() => setMobileSheetOpen(true)}
          >
            <FolderPlus size={14} aria-hidden />
            <span className="doc-copybtn-label doc-copybtn-label--wide">{label}</span>
          </button>

          <MobileCollectionSheet
            open={mobileSheetOpen}
            onOpenChange={setMobileSheetOpen}
            title={title}
            href={href}
            collections={collections}
            pendingCollectionIds={pendingCollectionIds}
            creating={creating}
            onToggleCollection={toggleCollection}
            onCreateCollection={openCreateDialog}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && creating) return;
          setCreateOpen(open);
          if (!open) setCollectionName("");
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (creating) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (creating) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Create collection and add this document</DialogTitle>
            <DialogDescription>
              {title} will be added as soon as the collection is created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAndAdd} aria-busy={creating}>
            <label className="set-field" htmlFor="collection-name">
              <span className="set-field-label">Collection name</span>
              <input
                id="collection-name"
                className="set-input"
                placeholder="Project notes"
                value={collectionName}
                disabled={creating}
                onChange={(event) => setCollectionName(event.target.value)}
                autoFocus
              />
            </label>
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creating || !collectionName.trim()}>
                {creating ? "Creating and adding..." : "Create and add"}
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
  pendingCollectionIds,
  disabled,
  onToggleCollection,
  onCreateCollection,
}: {
  label: string;
  className?: string;
  mobileSheet: boolean;
  href: string;
  collections: Collection[];
  pendingCollectionIds: ReadonlySet<string>;
  disabled: boolean;
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
          disabled={disabled}
        >
          <FolderPlus size={14} aria-hidden />
          <span className="doc-copybtn-label doc-copybtn-label--wide">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Collections">
        {collections.length === 0 ? (
          <>
            <DropdownMenuLabel>No collections yet</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={disabled} onSelect={onCreateCollection}>
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
                  disabled={pendingCollectionIds.has(collection.id)}
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
            <DropdownMenuItem disabled={disabled} onSelect={onCreateCollection}>
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
  pendingCollectionIds,
  creating,
  onToggleCollection,
  onCreateCollection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  href: string;
  collections: Collection[];
  pendingCollectionIds: ReadonlySet<string>;
  creating: boolean;
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
                  aria-busy={pendingCollectionIds.has(collection.id)}
                  disabled={pendingCollectionIds.has(collection.id)}
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
            disabled={creating}
            onClick={onCreateCollection}
          >
            <Plus aria-hidden /> Create and add to collection
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
