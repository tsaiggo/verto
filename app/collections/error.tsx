"use client";

import Link from "next/link";
import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/collections/Collections.module.css";

export default function CollectionsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.routeError}>
      <section className={styles.detailState} aria-labelledby="collections-error-title">
        <span className={styles.stateIcon} aria-hidden>
          <FolderX />
        </span>
        <h1 id="collections-error-title">Collections could not be opened</h1>
        <p>Verto could not read the collection index. Your original documents are unchanged.</p>
        <div className={styles.stateActions}>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/library">Open library</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
