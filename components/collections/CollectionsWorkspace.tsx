"use client";

import Link from "next/link";
import { ArrowLeft, FileText, FolderKanban, FolderOpen, Plus } from "lucide-react";
import type { Collection } from "@/lib/collections";
import type { HomeWorkspaceData } from "@/components/home/home-data";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { Button } from "@/components/ui/button";
import ProductUtilities from "@/components/layout/ProductUtilities";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import {
  CollectionActions,
  CollectionIndex,
  CollectionNavigator,
} from "@/components/collections/CollectionIndex";
import { CollectionLibraryContext } from "@/components/collections/CollectionLibraryContext";
import type { FolderGroup } from "@/components/collections/collection-types";
import styles from "@/components/collections/Collections.module.css";

export function CollectionsWorkspace({
  collections,
  selectedCollectionId,
  selectedCollection,
  documentTitles,
  runtimeLocal,
  runtimeWorkspace,
  bundledDocuments,
  folderGroups,
  onCreate,
  onRename,
  onDelete,
}: {
  collections: Collection[];
  selectedCollectionId: string;
  selectedCollection: Collection | null;
  documentTitles: ReadonlyMap<string, string>;
  runtimeLocal: RuntimeLocalIndexState;
  runtimeWorkspace: HomeWorkspaceData | null;
  bundledDocuments: number;
  folderGroups: FolderGroup[];
  onCreate: () => void;
  onRename: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}) {
  const itemCount = collections.reduce(
    (total, collection) => total + collection.docHrefs.length,
    0
  );

  return (
    <div className={styles.page}>
      <header className={styles.header} data-page-identity>
        <div className={styles.headerCopy}>
          <div className={styles.titleRow}>
            <FolderKanban aria-hidden />
            <h1>Collections</h1>
          </div>
          <p>Organize related documents without changing their local file structure.</p>
          <div className={styles.headerMeta} aria-label="Collections summary">
            <span>
              <FolderOpen aria-hidden />
              {collections.length} {collections.length === 1 ? "collection" : "collections"}
            </span>
            <span>
              <FileText aria-hidden />
              {itemCount} saved items
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button size="sm" onClick={onCreate}>
            <Plus aria-hidden />
            <span>New collection</span>
          </Button>
          <ProductUtilities />
        </div>
      </header>

      <div className={styles.divider} />

      <div className={styles.scroll} data-page-scroll>
        <div className={styles.workbench}>
          <section className={styles.main} aria-label="Collection documents">
            {selectedCollectionId ? (
              <>
                <Link href="/collections" className={styles.backLink}>
                  <ArrowLeft aria-hidden /> All collections
                </Link>
                <CollectionDetail
                  collectionId={selectedCollectionId}
                  collection={selectedCollection}
                  documentTitles={documentTitles}
                  actions={
                    selectedCollection ? (
                      <CollectionActions
                        collection={selectedCollection}
                        onRename={onRename}
                        onDelete={onDelete}
                      />
                    ) : null
                  }
                />
              </>
            ) : (
              <CollectionIndex
                collections={collections}
                onCreate={onCreate}
                onRename={onRename}
                onDelete={onDelete}
              />
            )}
          </section>

          <aside
            className={styles.contextPanel}
            aria-label="Collections context"
            data-context-panel
          >
            {selectedCollectionId ? (
              <CollectionNavigator collections={collections} selectedId={selectedCollectionId} />
            ) : null}
            <CollectionLibraryContext
              runtimeLocal={runtimeLocal}
              runtimeWorkspace={runtimeWorkspace}
              bundledDocuments={bundledDocuments}
              folderGroups={folderGroups}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
