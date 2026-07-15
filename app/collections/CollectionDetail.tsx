"use client";

import Link from "next/link";
import { ExternalLink, FileText, Globe2 } from "lucide-react";
import { removeDocFromCollection, type Collection } from "@/lib/collections";

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
      return { isExternal: true, label: "Web article", path: `${hostname} · ${path}` };
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
    <ul className="col-doc-list">
      {collection.docHrefs.map((href) => {
        const title = collection.docTitles?.[href] ?? documentTitles.get(href) ?? "Saved document";
        const origin = collectionItemOrigin(href);
        const linkContent = (
          <>
            <span className="col-doc-title">
              {title}
              {origin.isExternal && <ExternalLink aria-hidden />}
            </span>
            <span className="col-doc-meta">
              <span className={`col-doc-source${origin.isExternal ? " is-external" : ""}`}>
                {origin.isExternal ? <Globe2 aria-hidden /> : <FileText aria-hidden />}
                {origin.label}
              </span>
              <span className="col-doc-path" title={href}>
                {origin.path}
              </span>
            </span>
          </>
        );

        return (
          <li key={href} className="col-doc-item">
            {origin.isExternal ? (
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
              onClick={() => void removeDocFromCollection(collection.id, href).catch(() => {})}
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
