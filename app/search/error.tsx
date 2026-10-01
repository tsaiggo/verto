"use client";

import Link from "next/link";
import { useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import styles from "@/components/search/Search.module.css";

/**
 * Error boundary for the Search & Library route. The index is built from the
 * active content source at request/build time; if that source is unreachable
 * this keeps the failure scoped to the page (preserving the navbar and rail)
 * instead of bubbling to the root boundary and replacing the whole shell.
 */
export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.surface}>
      <PageHeader
        title="Search"
        subtitle="Find pages, headings, and code in your active sources."
        frame="wide"
      />
      <div className={`search-page ${styles.page} ${styles.errorPage}`}>
        <div className="search-route-error" role="alert">
          <h2 className={styles.errorTitle}>Search is unavailable</h2>
          <p className={styles.errorDescription}>
            The library index couldn&apos;t be built from the connected source. It may be offline or
            misconfigured — try again in a moment.
          </p>
          <div className="search-route-actions">
            <button type="button" onClick={reset} className="v-btn v-btn--primary">
              Try again
            </button>
            <Link href="/" className="v-btn">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
