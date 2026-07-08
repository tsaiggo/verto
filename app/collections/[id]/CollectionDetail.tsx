"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadCollections, subscribeCollections } from "@/lib/collections";
import PageHeader from "@/components/layout/PageHeader";

export default function CollectionDetail() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const collections = useSyncExternalStore(subscribeCollections, loadCollections, () => []);
  const collection = collections.find((c) => c.id === id) ?? null;

  if (!collection) {
    return (
      <div className="collections-page">
        <PageHeader title="Collection not found" />
        <div className="v-page">
          <p className="py-6 text-sm text-text-muted">
            This collection does not exist.{" "}
            <Link href="/collections" className="underline">
              Back to collections
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const docCount = collection.docHrefs.length;

  return (
    <div className="collections-page">
      <PageHeader
        title={collection.name}
        subtitle={`${docCount} ${docCount === 1 ? "document" : "documents"}`}
      />
      <div className="v-page">
        {docCount === 0 ? (
          <p className="py-6 text-sm text-text-muted">No documents in this collection yet.</p>
        ) : (
          <ul className="col-doc-list">
            {collection.docHrefs.map((href) => (
              <li key={href}>
                <Link href={href} className="col-doc-link">
                  {href}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
