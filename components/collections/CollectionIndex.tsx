"use client";

import Link from "next/link";
import { FolderKanban, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { Collection } from "@/lib/collections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatCollectionDate } from "@/components/collections/collection-view-model";
import styles from "@/components/collections/Collections.module.css";

export function CollectionActions({
  collection,
  onRename,
  onDelete,
}: {
  collection: Collection;
  onRename: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Actions for ${collection.name}`}
        >
          <MoreHorizontal aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onRename(collection)}>
          <Pencil aria-hidden /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDelete(collection)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 aria-hidden /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CollectionIndex({
  collections,
  onCreate,
  onRename,
  onDelete,
}: {
  collections: Collection[];
  onCreate: () => void;
  onRename: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}) {
  if (collections.length === 0) {
    return (
      <section className={styles.emptyState} aria-labelledby="collections-empty-title">
        <span className={styles.stateIcon} aria-hidden>
          <FolderKanban />
        </span>
        <h2 id="collections-empty-title">Make your first collection</h2>
        <p>
          Group documents for a project, topic, or reading list. Add items from the reader without
          moving the original files.
        </p>
        <Button size="sm" onClick={onCreate}>
          <Plus aria-hidden /> Create a collection
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="collection-index-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="collection-index-title">Your collections</h2>
          <p>
            {collections.length === 1
              ? "1 saved collection"
              : `${collections.length} saved collections`}
          </p>
        </div>
      </div>
      <ul className={styles.collectionList}>
        {collections.map((collection) => (
          <li key={collection.id} className={styles.collectionRow}>
            <Link
              href={{ pathname: "/collections", query: { collection: collection.id } }}
              className={styles.collectionLink}
            >
              <span className={styles.rowIcon} aria-hidden>
                <FolderOpen />
              </span>
              <span className={styles.rowCopy}>
                <strong>{collection.name}</strong>
                <span>
                  {collection.docHrefs.length} {collection.docHrefs.length === 1 ? "item" : "items"}
                </span>
              </span>
              <span className={styles.rowDate}>{formatCollectionDate(collection.createdAt)}</span>
            </Link>
            <CollectionActions collection={collection} onRename={onRename} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CollectionNavigator({
  collections,
  selectedId,
}: {
  collections: Collection[];
  selectedId: string;
}) {
  return (
    <section className={styles.contextSection} aria-labelledby="collection-navigation-title">
      <div className={styles.contextHeading}>
        <h2 id="collection-navigation-title">Collections</h2>
        <Link href="/collections">View all</Link>
      </div>
      {collections.length === 0 ? (
        <p className={styles.contextEmpty}>No collections saved.</p>
      ) : (
        <ul className={styles.contextLinks}>
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={{ pathname: "/collections", query: { collection: collection.id } }}
                aria-current={collection.id === selectedId ? "page" : undefined}
              >
                <span>{collection.name}</span>
                <small>
                  {collection.docHrefs.length} {collection.docHrefs.length === 1 ? "item" : "items"}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
