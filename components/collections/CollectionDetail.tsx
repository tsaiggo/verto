"use client";

// Collection details preserve the source identity of each saved item.

import Link from "next/link";
import { ExternalLink, FileText, FolderOpen, Globe2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { removeDocFromCollection, type Collection } from "@/lib/collections";
import { Button } from "@/components/ui/button";
import { collectionItemOrigin } from "@/components/collections/collection-view-model";
import styles from "@/components/collections/Collections.module.css";

function CollectionDocumentList({
  collection,
  documentTitles,
}: {
  collection: Collection;
  documentTitles: ReadonlyMap<string, string>;
}) {
  const [removingHref, setRemovingHref] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function removeItem(href: string, title: string) {
    if (removingHref) return;
    setRemovingHref(href);
    setRemoveError(null);
    try {
      await removeDocFromCollection(collection.id, href);
    } catch {
      setRemoveError(`Verto could not remove “${title}”. Try again.`);
    } finally {
      setRemovingHref(null);
    }
  }

  return (
    <>
      {removeError ? (
        <p className={styles.inlineError} role="alert">
          {removeError}
        </p>
      ) : null}
      <ul className={styles.documentList}>
        {collection.docHrefs.map((href) => {
          const title =
            collection.docTitles?.[href] ?? documentTitles.get(href) ?? "Saved document";
          const origin = collectionItemOrigin(href);
          const linkContent = (
            <>
              <span className={styles.documentIcon} aria-hidden>
                {origin.isExternal ? <Globe2 /> : <FileText />}
              </span>
              <span className={styles.documentCopy}>
                <strong>
                  {title}
                  {origin.isExternal ? <ExternalLink aria-hidden /> : null}
                </strong>
                <span>
                  <small>{origin.label}</small>
                  <span title={href}>{origin.path}</span>
                </span>
              </span>
            </>
          );

          return (
            <li key={href} className={styles.documentRow}>
              {origin.isExternal ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.documentLink}
                >
                  {linkContent}
                </a>
              ) : (
                <Link href={href} className={styles.documentLink}>
                  {linkContent}
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.removeButton}
                disabled={removingHref !== null}
                aria-label={`Remove ${title}`}
                onClick={() => void removeItem(href, title)}
              >
                {removingHref === href ? "Removing" : "Remove"}
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function CollectionDetail({
  collectionId,
  collection,
  documentTitles,
  actions,
}: {
  collectionId: string;
  collection: Collection | null;
  documentTitles: ReadonlyMap<string, string>;
  actions?: ReactNode;
}) {
  if (!collectionId) return null;
  if (!collection) {
    return (
      <section className={`col-detail ${styles.detailState}`} aria-labelledby="missing-collection">
        <span className={styles.stateIcon} aria-hidden>
          <FolderOpen />
        </span>
        <h2 id="missing-collection">Collection not found</h2>
        <p>This collection may have been deleted on another device or browser window.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/collections">Back to collections</Link>
        </Button>
      </section>
    );
  }

  const total = collection.docHrefs.length;
  return (
    <section className={`col-detail ${styles.detail}`} aria-labelledby="collection-detail-title">
      <header className={styles.detailHeader}>
        <div>
          <h2 id="collection-detail-title">{collection.name}</h2>
          <p>
            {total} {total === 1 ? "item" : "items"}
          </p>
        </div>
        {actions}
      </header>

      {total === 0 ? (
        <div className={styles.detailEmpty}>
          <span className={styles.stateIcon} aria-hidden>
            <FolderOpen />
          </span>
          <h3>No saved items yet</h3>
          <p>Open a document and choose “Add to collection” to keep it here.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/library">Browse library</Link>
          </Button>
        </div>
      ) : (
        <CollectionDocumentList collection={collection} documentTitles={documentTitles} />
      )}
    </section>
  );
}
