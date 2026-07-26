"use client";

import { TriangleAlert } from "lucide-react";
import styles from "@/components/library/Library.module.css";
import { Button } from "@/components/ui/button";

export default function LibraryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.routeState}>
      <div className={styles.state} role="alert">
        <div className={styles.stateInner}>
          <span className={styles.stateIcon} aria-hidden>
            <TriangleAlert />
          </span>
          <h1 className={styles.stateTitle}>Library couldn’t be opened</h1>
          <p className={styles.stateCopy}>
            Verto couldn’t read the active content source. Your files are unchanged.
          </p>
          <div className={styles.stateActions}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.stateAction}
              onClick={reset}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
