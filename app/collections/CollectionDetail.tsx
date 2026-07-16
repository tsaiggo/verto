"use client";

import Link from "next/link";
import { ExternalLink, FileText, Globe2, Trash2 } from "lucide-react";
import { removeDocFromCollection, type Collection } from "@/lib/collections";
import { Button } from "@/components/ui/button";
import {
  ContentEmptyState,
  ContentPanel,
  ContentRow,
  ContentSection,
  ContentStatus,
} from "@/components/ui/content-primitives";
import styles from "./collections.module.css";

interface CollectionItemOrigin {
  isExternal: boolean;
  label: string;
  path: string;
}

function collectionItemOrigin(href: string): CollectionItemOrigin {
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const hostname = url.hostname.replace(/^www\./, "");
      const path = `${url.pathname}${url.search}${url.hash}` || "/";
      return { isExternal: true, label: "Web article", path: `${hostname}${path}` };
    }
  } catch {
    // Local reader paths are intentionally kept as-is below.
  }

  return { isExternal: false, label: "Library document", path: href };
}

function CollectionDocumentList({
  collection,
  documentTitles,
}: {
  collection: Collection;
  documentTitles: ReadonlyMap<string, string>;
}) {
  return (
    <ContentPanel variant="plain">
      <ul className={styles.rows} aria-label={`Documents in ${collection.name}`}>
        {collection.docHrefs.map((href) => {
          const title =
            collection.docTitles?.[href] ?? documentTitles.get(href) ?? "Saved document";
          const origin = collectionItemOrigin(href);
          const titleLink = origin.isExternal ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
              {title} <ExternalLink aria-hidden />
            </a>
          ) : (
            <Link href={href} className={styles.titleLink}>
              {title}
            </Link>
          );

          return (
            <li key={href} className={styles.rowItem}>
              <ContentRow
                className={styles.row}
                leading={origin.isExternal ? <Globe2 aria-hidden /> : <FileText aria-hidden />}
                title={titleLink}
                description={
                  <span className={styles.path} title={href}>
                    {origin.path}
                  </span>
                }
                metadata={
                  <span className={styles.source}>
                    {origin.isExternal ? <Globe2 aria-hidden /> : <FileText aria-hidden />}
                    {origin.label}
                  </span>
                }
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={styles.rowAction}
                    onClick={() =>
                      void removeDocFromCollection(collection.id, href).catch(() => {})
                    }
                    aria-label={`Remove ${title}`}
                    title="Remove from collection"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            </li>
          );
        })}
      </ul>
    </ContentPanel>
  );
}

export function CollectionDetail({
  collectionId,
  collection,
  documentTitles,
}: {
  collectionId: string;
  collection: Collection | null;
  documentTitles: ReadonlyMap<string, string>;
}) {
  if (!collectionId) return null;
  if (!collection) {
    return (
      <ContentSection className={`col-detail ${styles.detail}`} title="Collection not found">
        <ContentStatus
          status="error"
          title="This collection does not exist"
          description="It may have been deleted in another window."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/collections">Back to collections</Link>
            </Button>
          }
        />
      </ContentSection>
    );
  }

  const total = collection.docHrefs.length;
  return (
    <ContentSection
      className={`col-detail ${styles.detail}`}
      title={collection.name}
      description={`${total} ${total === 1 ? "item" : "items"}`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/collections">Back</Link>
        </Button>
      }
    >
      {total === 0 ? (
        <ContentPanel variant="outlined">
          <ContentEmptyState
            compact
            icon={<FileText aria-hidden />}
            title="No saved items"
            description="Add documents from the reader to keep them in this collection."
          />
        </ContentPanel>
      ) : (
        <CollectionDocumentList collection={collection} documentTitles={documentTitles} />
      )}
    </ContentSection>
  );
}
