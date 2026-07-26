"use client";

import Link from "next/link";
import { FolderInput, Loader2, TriangleAlert } from "lucide-react";
import type { HomeWorkspaceData } from "@/components/home/home-data";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { Button } from "@/components/ui/button";
import type { FolderGroup } from "@/components/collections/collection-types";
import styles from "@/components/collections/Collections.module.css";

export function CollectionLibraryContext({
  runtimeLocal,
  runtimeWorkspace,
  bundledDocuments,
  folderGroups,
}: {
  runtimeLocal: RuntimeLocalIndexState;
  runtimeWorkspace: HomeWorkspaceData | null;
  bundledDocuments: number;
  folderGroups: FolderGroup[];
}) {
  const loading = runtimeLocal.status === "loading";
  const failed = runtimeLocal.status === "error";
  const local = runtimeLocal.status === "ready" && runtimeWorkspace;
  const total = local ? runtimeWorkspace.readableHrefs.length : bundledDocuments;

  return (
    <>
      <section className={styles.contextSection} aria-labelledby="collection-source-title">
        <div className={styles.contextHeading}>
          <h2 id="collection-source-title">Library source</h2>
        </div>
        <div
          className={`${styles.sourceStatus}${failed ? ` ${styles.sourceError}` : ""}`}
          role={loading || failed ? "status" : undefined}
        >
          <span className={styles.sourceIcon} aria-hidden>
            {loading ? (
              <Loader2 className={styles.spinner} />
            ) : failed ? (
              <TriangleAlert />
            ) : (
              <FolderInput />
            )}
          </span>
          <div>
            <strong>
              {loading
                ? "Opening local folder"
                : failed
                  ? "Local folder unavailable"
                  : local
                    ? "Local folder"
                    : "Included library"}
            </strong>
            <p>
              {failed
                ? "Reconnect the folder to restore its sections."
                : `${total} readable ${total === 1 ? "document" : "documents"}`}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className={styles.contextAction}>
          <Link href="/integrations">{failed ? "Reconnect source" : "Manage sources"}</Link>
        </Button>
      </section>

      <section className={styles.contextSection} aria-labelledby="folder-groups-title">
        <div className={styles.contextHeading}>
          <h2 id="folder-groups-title">By folder</h2>
        </div>
        {folderGroups.length === 0 ? (
          <p className={styles.contextEmpty}>No readable folders yet.</p>
        ) : (
          <ul className={styles.folderList}>
            {folderGroups.map((group) => (
              <li key={group.href}>
                <Link href={group.href}>
                  <span>{group.title}</span>
                  <small>
                    {group.total} {group.total === 1 ? "document" : "documents"}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
