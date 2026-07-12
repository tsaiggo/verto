"use client";

import Link from "next/link";
import { Check, FolderPlus, Plus } from "lucide-react";
import {
  addDocToCollection,
  loadCollections,
  removeDocFromCollection,
  subscribeCollections,
} from "@/lib/collections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSyncExternalStore } from "react";

/**
 * Adds the current document to one or more user collections from the reader.
 *
 * Collections are intentionally managed from their own page; this compact
 * control makes membership a one-click action at the point where a reader is
 * deciding what to keep.
 */
export function AddToCollectionButton({ href }: { href: string }) {
  const collections = useSyncExternalStore(subscribeCollections, loadCollections, () => []);
  const membershipCount = collections.filter((collection) =>
    collection.docHrefs.includes(href)
  ).length;
  const label =
    membershipCount === 0
      ? "Add to collection"
      : `In ${membershipCount} ${membershipCount === 1 ? "collection" : "collections"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="doc-copybtn" aria-label={label}>
          <FolderPlus size={14} aria-hidden />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Document collections">
        {collections.length === 0 ? (
          <>
            <DropdownMenuLabel>No collections yet</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/collections">
                <Plus aria-hidden /> Create a collection
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Add this document to</DropdownMenuLabel>
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
                    else addDocToCollection(collection.id, href);
                  }}
                >
                  <span className="doc-collection-check" aria-hidden>
                    {isIncluded && <Check />}
                  </span>
                  {collection.name}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
