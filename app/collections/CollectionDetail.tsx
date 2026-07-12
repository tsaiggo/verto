"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { removeDocFromCollection, type Collection } from "@/lib/collections";

function isExternalArticle(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function CollectionDocumentList({
  collection,
  documentTitles,
}: {
  collection: Collection;
  documentTitles: ReadonlyMap<string, string>;
}) {
  return (
    <ul className="col-doc-list">
      {collection.docHrefs.map((href) => {
        const title = collection.docTitles?.[href] ?? documentTitles.get(href) ?? "Saved document";
        const linkContent = (
          <>
            <span className="col-doc-title">
              {title}
              {isExternalArticle(href) && <ExternalLink aria-hidden />}
            </span>
            <span className="col-doc-path">{href}</span>
          </>
        );

        return (
          <li key={href} className="col-doc-item">
            {isExternalArticle(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="col-doc-link">
                {linkContent}
              </a>
            ) : (
              <Link href={href} className="col-doc-link">
                {linkContent}
              </Link>
            )}
            <button
              type="button"
              className="v-btn v-btn--sm col-doc-remove"
              onClick={() => removeDocFromCollection(collection.id, href)}
              aria-label={`Remove ${title}`}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
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
      <section className="v-card col-detail">
        <h2>Collection not found</h2>
        <p className="py-6 text-sm text-text-muted">
          This collection does not exist.
          <Link href="/collections" className="underline">
            Back to collections
          </Link>
        </p>
      </section>
    );
  }

  const total = collection.docHrefs.length;
  return (
    <section className="v-card col-detail">
      <div className="v-cardhead">
        <div>
          <h2>{collection.name}</h2>
          <p className="text-sm text-text-muted">
            {total} {total === 1 ? "item" : "items"}
          </p>
        </div>
        <Link href="/collections" className="v-btn v-btn--sm">
          Back
        </Link>
      </div>
      {total === 0 ? (
        <p className="py-6 text-sm text-text-muted">No saved items in this collection yet.</p>
      ) : (
        <CollectionDocumentList collection={collection} documentTitles={documentTitles} />
      )}
    </section>
  );
}
